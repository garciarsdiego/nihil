import { normalizeProjectPath } from "@nihil/protocol";
import { parseWorkflowConfig, resolveWorkflow } from "../../exec/workflows.js";
import type {
  ExecutionTarget,
  FileMap,
  LogEvent,
  ProcessHandle,
  Result,
  SnapshotRef,
  TemplateRef,
  WorkflowRef,
} from "../../exec/target.js";
import { TargetError } from "../../exec/target.js";
import type { CommitOptions, CommitResult, GitBackend, TxnMarker } from "../../git/transaction.js";

/**
 * In-memory model of a project + its git history shared by FakeTarget and
 * FakeGitBackend, so unit tests exercise the runner without spawning git or
 * touching disk. The working tree is `files`; commits snapshot it by ref.
 */
export class MemoryProject {
  files = new Map<string, string>();
  readonly commits = new Map<string, Map<string, string>>();
  head: string;
  #seq = 0;

  constructor() {
    this.head = this.#newRef();
    this.commits.set(this.head, new Map());
  }

  /** Seed pre-existing files into both the working tree and the HEAD commit. */
  seed(files: Record<string, string>): void {
    for (const [path, content] of Object.entries(files)) {
      this.files.set(norm(path), content);
    }
    this.commits.set(this.head, new Map(this.files));
  }

  existsAt(ref: string, path: string): boolean {
    return this.commits.get(ref)?.has(norm(path)) ?? false;
  }

  commit(): CommitResult {
    const headFiles = this.commits.get(this.head);
    if (headFiles !== undefined && mapsEqual(headFiles, this.files)) {
      return { committed: false };
    }
    const ref = this.#newRef();
    this.commits.set(ref, new Map(this.files));
    this.head = ref;
    return { committed: true, ref };
  }

  restore(ref: string): void {
    const snapshot = this.commits.get(ref);
    if (snapshot === undefined) {
      throw new Error(`unknown ref ${ref}`);
    }
    this.files = new Map(snapshot);
    this.head = ref;
  }

  #newRef(): string {
    return `commit-${this.#seq++}`;
  }
}

function norm(path: string): string {
  const result = normalizeProjectPath(path);
  if (!result.ok) {
    throw new TargetError("PATH_FORBIDDEN", `forbidden path "${path}": ${result.reason ?? "invalid"}`);
  }
  return result.path;
}

function mapsEqual(a: Map<string, string>, b: Map<string, string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const [k, v] of a) {
    if (b.get(k) !== v) {
      return false;
    }
  }
  return true;
}

export interface FakeTargetCalls {
  installs: string[][];
  removes: string[][];
  execs: WorkflowRef[];
}

/** In-memory ExecutionTarget. Records package/exec calls; exec resolves the
 * workflow from the seeded nihil.config.json and reports a configurable exit. */
export class FakeTarget implements ExecutionTarget {
  readonly calls: FakeTargetCalls = { installs: [], removes: [], execs: [] };
  /** Per-workflow exit code for non-longRunning runs (default 0). */
  execExit = new Map<string, number>();
  installResult: Result = { ok: true, exitCode: 0, logTail: "" };
  removeResult: Result = { ok: true, exitCode: 0, logTail: "" };

  constructor(readonly project: MemoryProject) {}

  async init(_template: TemplateRef): Promise<void> {}

  async readFile(path: string): Promise<string> {
    const content = this.project.files.get(norm(path));
    if (content === undefined) {
      throw new TargetError("FILE_NOT_FOUND", `file not found: ${path}`);
    }
    return content;
  }

  async writeFiles(files: FileMap): Promise<void> {
    for (const [path, content] of Object.entries(files)) {
      this.project.files.set(norm(path), content);
    }
  }

  async deleteFile(path: string): Promise<void> {
    if (!this.project.files.delete(norm(path))) {
      throw new TargetError("FILE_NOT_FOUND", `file not found: ${path}`);
    }
  }

  async rename(from: string, to: string): Promise<void> {
    const content = this.project.files.get(norm(from));
    if (content === undefined) {
      throw new TargetError("FILE_NOT_FOUND", `file not found: ${from}`);
    }
    this.project.files.delete(norm(from));
    this.project.files.set(norm(to), content);
  }

  async copy(from: string, to: string): Promise<void> {
    const content = this.project.files.get(norm(from));
    if (content === undefined) {
      throw new TargetError("FILE_NOT_FOUND", `file not found: ${from}`);
    }
    this.project.files.set(norm(to), content);
  }

  async listFiles(prefix?: string): Promise<string[]> {
    const all = [...this.project.files.keys()];
    const filtered = prefix ? all.filter((p) => p === prefix || p.startsWith(`${prefix}/`)) : all;
    return filtered.sort();
  }

  exec(cmd: WorkflowRef | string): ProcessHandle {
    const ref: WorkflowRef = typeof cmd === "string" ? { workflow: "(raw)" } : cmd;
    this.calls.execs.push(ref);
    if (typeof cmd !== "string") {
      // Mirror the real target: resolve from config, throw UNKNOWN_WORKFLOW.
      const raw = this.project.files.get("nihil.config.json") ?? '{"workflows":{}}';
      resolveWorkflow(parseWorkflowConfig(raw), cmd);
    }
    const code = this.execExit.get(ref.workflow) ?? 0;
    return {
      pid: 1,
      command: ref.workflow,
      logs: emptyLogs(),
      exited: Promise.resolve({ code, signal: null }),
      kill: async () => {},
    };
  }

  async installPackages(pkgs: string[]): Promise<Result> {
    this.calls.installs.push([...pkgs]);
    return this.installResult;
  }

  async removePackages(pkgs: string[]): Promise<Result> {
    this.calls.removes.push([...pkgs]);
    return this.removeResult;
  }

  async getPreviewUrl(): Promise<string> {
    return "http://127.0.0.1:0";
  }

  streamLogs(): AsyncIterable<LogEvent> {
    return emptyLogs();
  }

  async snapshot(): Promise<SnapshotRef> {
    return { kind: "git", ref: this.project.head };
  }

  async destroy(): Promise<void> {}
}

function emptyLogs(): AsyncIterable<LogEvent> {
  return {
    async *[Symbol.asyncIterator]() {
      // no events
    },
  };
}

/** In-memory GitBackend backed by the same MemoryProject as the FakeTarget. */
export class FakeGitBackend implements GitBackend {
  marker: TxnMarker | null = null;

  constructor(readonly project: MemoryProject) {}

  async snapshot(): Promise<SnapshotRef> {
    return { kind: "git", ref: this.project.head };
  }

  async existsAt(ref: string, path: string): Promise<boolean> {
    return this.project.existsAt(ref, path);
  }

  async commitAll(_opts: CommitOptions): Promise<CommitResult> {
    return this.project.commit();
  }

  async restore(ref: string): Promise<void> {
    this.project.restore(ref);
  }

  async beginTxn(marker: TxnMarker): Promise<void> {
    this.marker = marker;
  }

  async endTxn(): Promise<void> {
    this.marker = null;
  }

  async pendingTxn(): Promise<TxnMarker | null> {
    return this.marker;
  }
}

/** Builds an async iterable that yields one full-text chunk (single-shot). */
export function singleChunk(text: string): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      yield text;
    },
  };
}

/** Yields a sequence of accumulated-text snapshots (progressive streaming). */
export function chunks(...accumulated: string[]): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const text of accumulated) {
        yield text;
      }
    },
  };
}
