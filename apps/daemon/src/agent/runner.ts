import {
  NihilStreamParser,
  applyEditBlocks,
  type NihilAction,
  type ProtocolError,
} from "@nihil/protocol";
import type { ExecutionTarget } from "../exec/target.js";
import { parseWorkflowConfig, resolveWorkflow, type NihilConfig } from "../exec/workflows.js";
import type { GitBackend } from "../git/transaction.js";
import {
  configPathOf,
  RESERVED_DIR,
  touchesReservedNamespace,
  touchesWorkflowConfig,
} from "./config-policy.js";
import { FeedbackCollector } from "./feedback.js";
import type { RunnerObserver } from "./observer.js";
import { ProjectLock } from "./serial-lock.js";
import { SerialQueue } from "./serial-queue.js";
import type { ActionOutcome, MessageResult } from "./types.js";

export interface RunnerDeps {
  target: ExecutionTarget;
  git: GitBackend;
  observer?: RunnerObserver;
  /** Plan-mode gate (DECISIONS #16): false rejects every action tag without
   * touching disk. Defaults to true (build mode). */
  applyEnabled?: boolean;
}

export interface RunOptions {
  signal?: AbortSignal;
}

interface RunContext {
  messageId: string;
  snapshotRef: string;
  created: Set<string>;
  collectedAdds: string[];
  collectedRemoves: string[];
  runs: { actionId: number; workflow: string; args?: string }[];
  outcomes: ActionOutcome[];
  feedback: FeedbackCollector;
  configChanged: boolean;
}

/** Processes one model message per project: consumes parser events, applies
 * actions through the target, and wraps the whole message in a git transaction. */
export class ProjectRunner {
  readonly #target: ExecutionTarget;
  readonly #git: GitBackend;
  readonly #observer: RunnerObserver;
  readonly #applyEnabled: boolean;
  readonly #lock = new ProjectLock();

  constructor(deps: RunnerDeps) {
    this.#target = deps.target;
    this.#git = deps.git;
    this.#observer = deps.observer ?? {};
    this.#applyEnabled = deps.applyEnabled ?? true;
  }

  /**
   * Runs one message. `chunks` yields the full accumulated text each time more
   * arrives (parser is re-entrant). Serialized per project: a second call waits
   * for the first; aborting the signal while still queued cancels it outright,
   * aborting while running rolls the transaction back.
   */
  async runMessage(
    messageId: string,
    chunks: AsyncIterable<string>,
    opts: RunOptions = {},
  ): Promise<MessageResult> {
    await this.#lock.acquire(opts.signal);
    try {
      return await this.#process(messageId, chunks, opts.signal);
    } finally {
      this.#lock.release();
    }
  }

  async #process(
    messageId: string,
    chunks: AsyncIterable<string>,
    signal?: AbortSignal,
  ): Promise<MessageResult> {
    const snapshot = await this.#git.snapshot();
    await this.#git.beginTxn({ snapshotRef: snapshot.ref, messageId, startedAt: Date.now() });

    const ctx: RunContext = {
      messageId,
      snapshotRef: snapshot.ref,
      created: new Set(),
      collectedAdds: [],
      collectedRemoves: [],
      runs: [],
      outcomes: [],
      feedback: new FeedbackCollector(),
      configChanged: false,
    };
    const queue = new SerialQueue();
    const parser = this.#buildParser(ctx, queue);

    let aborted = false;
    let lastText = "";
    try {
      for await (const text of chunks) {
        if (signal?.aborted) {
          aborted = true;
          break;
        }
        lastText = text;
        parser.parse(messageId, text);
      }
      if (!aborted) {
        // The returned STREAM_TRUNCATED errors are already delivered via the
        // onProtocolError callback (which feeds ctx.feedback), so the array is
        // intentionally not re-processed here.
        parser.finalize(messageId, lastText);
      }
      await queue.idle();
    } catch (error) {
      // An unexpected infra failure mid-stream voids the message. Preserve the
      // original cause even if the rollback itself then fails.
      await queue.idle();
      try {
        await this.#rollback(ctx);
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], "message failed and rollback failed");
      }
      throw error;
    }

    if (aborted || signal?.aborted) {
      return this.#rollback(ctx);
    }
    return this.#finishPhaseTwo(ctx);
  }

  #buildParser(ctx: RunContext, queue: SerialQueue): NihilStreamParser {
    return new NihilStreamParser({
      onProse: (id, text) => this.#observer.onProse?.(id, text),
      onActionOpen: (id, actionId, meta) => this.#observer.onActionStart?.(id, actionId, meta),
      onActionClose: (id, actionId, action) => {
        this.#routeAction(ctx, queue, actionId, action);
      },
      onProtocolError: (id, error) => this.#onProtocolError(ctx, error),
    });
  }

  #routeAction(
    ctx: RunContext,
    queue: SerialQueue,
    actionId: number,
    action: NihilAction,
  ): void {
    if (action.kind === "plan") {
      this.#observer.onPlan?.(ctx.messageId, { title: action.title, body: action.body });
      return;
    }
    if (!this.#applyEnabled) {
      // Plan-mode gate: reject any action tag without touching disk.
      ctx.feedback.warning(
        `<nihil-${action.kind}> ignored: this is a plan-mode message — no actions are applied`,
        { code: "PLAN_MODE_VIOLATION", action: actionId },
      );
      this.#record(ctx, { actionId, kind: action.kind, ok: false, code: "PLAN_MODE_VIOLATION" });
      return;
    }
    if (touchesReservedNamespace(action)) {
      // .nihil/ is daemon-owned (crash-recovery marker); never let a model
      // file action write into it.
      ctx.feedback.error(`<nihil-${action.kind}> rejected: ${RESERVED_DIR}/ is reserved for the daemon`, {
        code: "PATH_FORBIDDEN",
        action: actionId,
      });
      this.#record(ctx, { actionId, kind: action.kind, ok: false, code: "PATH_FORBIDDEN" });
      return;
    }
    switch (action.kind) {
      case "write":
      case "edit":
      case "rename":
      case "delete":
      case "copy":
        void queue.run(() => this.#applyFileAction(ctx, actionId, action)).catch(() => undefined);
        return;
      case "add-dependency":
        ctx.collectedAdds.push(...action.packages);
        return;
      case "remove-dependency":
        ctx.collectedRemoves.push(...action.packages);
        return;
      case "run":
        ctx.runs.push({ actionId, workflow: action.workflow, args: action.args });
        return;
    }
  }

  async #applyFileAction(ctx: RunContext, actionId: number, action: NihilAction): Promise<void> {
    try {
      switch (action.kind) {
        case "write":
          await this.#applyWrite(ctx, actionId, action);
          break;
        case "edit":
          await this.#applyEdit(ctx, actionId, action);
          break;
        case "rename":
          await this.#applyRename(ctx, actionId, action);
          break;
        case "copy":
          await this.#applyCopy(ctx, actionId, action);
          break;
        case "delete":
          await this.#applyDelete(ctx, actionId, action);
          break;
        default:
          return;
      }
    } catch (error) {
      ctx.feedback.error(`<nihil-${action.kind}> failed: ${(error as Error).message}`, {
        action: actionId,
      });
      this.#record(ctx, { actionId, kind: action.kind, ok: false });
    }
  }

  async #applyWrite(
    ctx: RunContext,
    actionId: number,
    action: Extract<NihilAction, { kind: "write" }>,
  ): Promise<void> {
    const isNew = !(await this.#git.existsAt(ctx.snapshotRef, action.path));
    await this.#target.writeFiles({ [action.path]: action.content });
    if (isNew) {
      ctx.created.add(action.path);
    }
    this.#succeed(ctx, actionId, action, action.path);
  }

  async #applyEdit(
    ctx: RunContext,
    actionId: number,
    action: Extract<NihilAction, { kind: "edit" }>,
  ): Promise<void> {
    let content: string;
    try {
      content = await this.#target.readFile(action.path);
    } catch {
      ctx.feedback.error(`Cannot edit ${action.path}: file does not exist`, {
        code: "FILE_NOT_FOUND",
        action: actionId,
        path: action.path,
      });
      this.#record(ctx, { actionId, kind: "edit", ok: false, code: "FILE_NOT_FOUND", path: action.path });
      return;
    }
    const result = applyEditBlocks(content, action.blocks);
    if (!result.ok && result.error) {
      ctx.feedback.error(result.error.message, {
        code: result.error.code,
        action: actionId,
        path: action.path,
        body: `Current content of ${action.path}:\n${fileExcerpt(content)}`,
      });
      this.#record(ctx, {
        actionId,
        kind: "edit",
        ok: false,
        code: result.error.code,
        path: action.path,
      });
      return;
    }
    await this.#target.writeFiles({ [action.path]: result.content });
    this.#succeed(ctx, actionId, action, action.path);
  }

  async #applyRename(
    ctx: RunContext,
    actionId: number,
    action: Extract<NihilAction, { kind: "rename" }>,
  ): Promise<void> {
    const toIsNew = !(await this.#git.existsAt(ctx.snapshotRef, action.to));
    try {
      await this.#target.rename(action.from, action.to);
    } catch {
      ctx.feedback.error(`Cannot rename ${action.from}: file does not exist`, {
        code: "FILE_NOT_FOUND",
        action: actionId,
        path: action.from,
      });
      this.#record(ctx, { actionId, kind: "rename", ok: false, code: "FILE_NOT_FOUND", path: action.from });
      return;
    }
    // Follow the move: the old path is gone, the new path is what rollback deletes.
    ctx.created.delete(action.from);
    if (toIsNew) {
      ctx.created.add(action.to);
    }
    this.#succeed(ctx, actionId, action, action.to);
  }

  async #applyCopy(
    ctx: RunContext,
    actionId: number,
    action: Extract<NihilAction, { kind: "copy" }>,
  ): Promise<void> {
    const toIsNew = !(await this.#git.existsAt(ctx.snapshotRef, action.to));
    try {
      await this.#target.copy(action.from, action.to);
    } catch {
      ctx.feedback.error(`Cannot copy ${action.from}: file does not exist`, {
        code: "FILE_NOT_FOUND",
        action: actionId,
        path: action.from,
      });
      this.#record(ctx, { actionId, kind: "copy", ok: false, code: "FILE_NOT_FOUND", path: action.from });
      return;
    }
    if (toIsNew) {
      ctx.created.add(action.to);
    }
    this.#succeed(ctx, actionId, action, action.to);
  }

  async #applyDelete(
    ctx: RunContext,
    actionId: number,
    action: Extract<NihilAction, { kind: "delete" }>,
  ): Promise<void> {
    try {
      await this.#target.deleteFile(action.path);
    } catch {
      ctx.feedback.error(`Cannot delete ${action.path}: file does not exist`, {
        code: "FILE_NOT_FOUND",
        action: actionId,
        path: action.path,
      });
      this.#record(ctx, { actionId, kind: "delete", ok: false, code: "FILE_NOT_FOUND", path: action.path });
      return;
    }
    ctx.created.delete(action.path);
    this.#succeed(ctx, actionId, action, action.path);
  }

  #succeed(ctx: RunContext, actionId: number, action: NihilAction, path: string): void {
    this.#record(ctx, { actionId, kind: action.kind, ok: true, path });
    if (touchesWorkflowConfig(action)) {
      ctx.configChanged = true;
      const configPath = configPathOf(action);
      this.#observer.onConfigChange?.(ctx.messageId, { actionId, path: configPath });
      ctx.feedback.info(
        "Workflow configuration changed; <nihil-run> targets may have been redefined this message.",
        { action: actionId, path: configPath },
      );
    }
  }

  #onProtocolError(ctx: RunContext, error: ProtocolError): void {
    // Parser-side errors (UNKNOWN_TAG, MALFORMED_TAG, PATH_FORBIDDEN,
    // PLAN_MODE_VIOLATION, STREAM_TRUNCATED) are all skip-and-continue: the
    // offending action never reached the runner. Surface them for next turn.
    const type = error.severity === "error" ? "error" : "warning";
    ctx.feedback[type](error.message, {
      code: error.code,
      action: error.actionId,
      path: error.path,
    });
  }

  async #finishPhaseTwo(ctx: RunContext): Promise<MessageResult> {
    await this.#applyDependencyBatches(ctx);
    const commit = await this.#git.commitAll({
      subject: commitSubject(ctx.outcomes),
      body: commitBody(ctx.outcomes),
      messageId: ctx.messageId,
    });
    if (commit.committed && commit.ref !== undefined) {
      this.#observer.onCommit?.(ctx.messageId, commit.ref);
    }
    await this.#runWorkflows(ctx);
    await this.#git.endTxn();
    return {
      committed: commit.committed,
      commitRef: commit.ref,
      rolledBack: false,
      outcomes: ctx.outcomes,
      feedback: ctx.feedback.serialize(),
      configChanged: ctx.configChanged,
    };
  }

  async #applyDependencyBatches(ctx: RunContext): Promise<void> {
    const removes = unique(ctx.collectedRemoves);
    const removeBase = new Set(removes.map(packageBaseName));
    // remove wins on conflict (DECISIONS #15): drop a removed package from adds.
    const adds = unique(ctx.collectedAdds).filter((spec) => {
      if (removeBase.has(packageBaseName(spec))) {
        ctx.feedback.warning(
          `Package "${packageBaseName(spec)}" was both added and removed; removal wins`,
        );
        return false;
      }
      return true;
    });

    if (adds.length > 0) {
      const result = await this.#target.installPackages(adds);
      if (!result.ok) {
        ctx.feedback.error(`Dependency install failed (exit ${result.exitCode ?? "?"})`, {
          code: "INSTALL_FAILED",
          body: result.logTail,
        });
      }
    }
    if (removes.length > 0) {
      const result = await this.#target.removePackages(removes);
      if (!result.ok) {
        ctx.feedback.error(`Dependency removal failed (exit ${result.exitCode ?? "?"})`, {
          code: "INSTALL_FAILED",
          body: result.logTail,
        });
      }
    }
  }

  async #runWorkflows(ctx: RunContext): Promise<void> {
    if (ctx.runs.length === 0) {
      return;
    }
    const config = await this.#loadWorkflowConfig();
    const immediate: typeof ctx.runs = [];
    const deferred: typeof ctx.runs = [];
    for (const run of ctx.runs) {
      let longRunning = false;
      try {
        longRunning = resolveWorkflow(config, { workflow: run.workflow, args: run.args }).longRunning;
      } catch {
        // resolution failure handled when we execute below
      }
      (longRunning ? deferred : immediate).push(run);
    }
    for (const run of immediate) {
      await this.#executeRun(ctx, run, false);
    }
    // longRunning workflows (dev server) start last and keep running detached.
    for (const run of deferred) {
      await this.#executeRun(ctx, run, true);
    }
  }

  async #executeRun(
    ctx: RunContext,
    run: { actionId: number; workflow: string; args?: string },
    longRunning: boolean,
  ): Promise<void> {
    let handle;
    try {
      handle = this.#target.exec({ workflow: run.workflow, args: run.args });
    } catch (error) {
      const code = (error as { code?: string }).code === "UNKNOWN_WORKFLOW"
        ? "UNKNOWN_WORKFLOW"
        : "WORKFLOW_FAILED";
      ctx.feedback.error((error as Error).message, { code, action: run.actionId });
      this.#record(ctx, { actionId: run.actionId, kind: "run", ok: false, code });
      return;
    }
    if (longRunning) {
      // Detach: the dev server outlives the transaction (DECISIONS #18).
      handle.exited.catch(() => undefined);
      this.#record(ctx, { actionId: run.actionId, kind: "run", ok: true });
      return;
    }
    const exit = await handle.exited;
    if (exit.code === 0) {
      this.#record(ctx, { actionId: run.actionId, kind: "run", ok: true });
    } else {
      ctx.feedback.error(`Workflow "${run.workflow}" exited with code ${exit.code ?? "?"}`, {
        code: "WORKFLOW_FAILED",
        action: run.actionId,
      });
      this.#record(ctx, { actionId: run.actionId, kind: "run", ok: false, code: "WORKFLOW_FAILED" });
    }
  }

  async #loadWorkflowConfig(): Promise<NihilConfig> {
    try {
      const raw = await this.#target.readFile("nihil.config.json");
      return parseWorkflowConfig(raw);
    } catch {
      return { workflows: {} };
    }
  }

  async #rollback(ctx: RunContext): Promise<MessageResult> {
    await this.#git.restore(ctx.snapshotRef);
    let allDeleted = true;
    for (const path of ctx.created) {
      // reset --hard restored tracked files; delete the untracked ones the
      // message created. node_modules is never in `created`, so it survives.
      try {
        await this.#target.deleteFile(path);
      } catch (error) {
        // A path already removed by a later same-message op is fine; a genuine
        // I/O failure (locked file, EPERM) means the tree is NOT clean.
        if (!isNotFound(error)) {
          allDeleted = false;
          ctx.feedback.warning(`Rollback could not remove ${path}: ${(error as Error).message}`);
        }
      }
    }
    // Keep the crash-recovery marker when rollback was incomplete, so a later
    // reattach surfaces the dirty state (DECISIONS #17) instead of trusting it.
    if (allDeleted) {
      await this.#git.endTxn();
    }
    ctx.feedback.warning("Message aborted; all changes were rolled back to the snapshot");
    return {
      committed: false,
      rolledBack: true,
      outcomes: ctx.outcomes,
      feedback: ctx.feedback.serialize(),
      configChanged: ctx.configChanged,
    };
  }

  #record(ctx: RunContext, outcome: ActionOutcome): void {
    ctx.outcomes.push(outcome);
    this.#observer.onActionResult?.(ctx.messageId, outcome);
  }
}

// ── pure helpers ───────────────────────────────────────────────────────────

function fileExcerpt(content: string, maxLines = 40): string {
  const lines = content.split("\n");
  if (lines.length <= maxLines) {
    return content;
  }
  return `${lines.slice(0, maxLines).join("\n")}\n… (${lines.length - maxLines} more lines)`;
}

export function packageBaseName(spec: string): string {
  if (spec.startsWith("@")) {
    const at = spec.indexOf("@", 1);
    return at === -1 ? spec : spec.slice(0, at);
  }
  const at = spec.indexOf("@");
  return at === -1 ? spec : spec.slice(0, at);
}

function isNotFound(error: unknown): boolean {
  const code = (error as { code?: string }).code;
  return code === "FILE_NOT_FOUND" || code === "ENOENT";
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function commitSubject(outcomes: readonly ActionOutcome[]): string {
  // Workflow runs are side effects, not committed content — keep them out of
  // the commit subject (a run-only message stages nothing and never commits).
  const ok = outcomes.filter((o) => o.ok && o.kind !== "run");
  if (ok.length === 0) {
    // No authored file changes — any staged content came from a dependency op.
    return "chore: update project";
  }
  const counts = new Map<string, number>();
  for (const o of ok) {
    counts.set(o.kind, (counts.get(o.kind) ?? 0) + 1);
  }
  const parts = [...counts].map(([kind, n]) => `${kind} ${n}`);
  return `feat: ${parts.join(", ")}`;
}

function commitBody(outcomes: readonly ActionOutcome[]): string {
  return outcomes
    .filter((o) => o.ok && o.kind !== "run" && o.path !== undefined)
    .map((o) => `- ${o.kind} ${o.path}`)
    .join("\n");
}
