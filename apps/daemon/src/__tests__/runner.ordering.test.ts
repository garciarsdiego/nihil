/**
 * runner.ordering.test.ts — action routing, ordering, dependency batching,
 * and run deferral via the FAKE target.
 *
 * Coverage:
 *   - Stream order of file ops (write → edit → rename → delete → copy in one
 *     message all apply, in order)
 *   - add-dependency batching across MULTIPLE tags merged into ONE installPackages
 *     call
 *   - remove-dependency batched into ONE removePackages call
 *   - install batch runs BEFORE remove batch (DECISIONS #15)
 *   - Package in BOTH add and remove → warning feedback + removal wins
 *   - run actions: non-longRunning exit 0 → ok
 *   - run actions: non-zero exit → WORKFLOW_FAILED feedback
 *   - UNKNOWN_WORKFLOW → UNKNOWN_WORKFLOW feedback
 *   - longRunning workflow → deferred, recorded ok without awaiting
 */

import { ProjectRunner } from "../agent/runner.js";
import {
  FakeGitBackend,
  FakeTarget,
  MemoryProject,
  singleChunk,
  chunks,
} from "./fakes/memory-project.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeRunner(seed: Record<string, string> = {}, applyEnabled = true) {
  const project = new MemoryProject();
  project.seed(seed);
  const target = new FakeTarget(project);
  const git = new FakeGitBackend(project);
  const runner = new ProjectRunner({ target, git, applyEnabled });
  return { project, target, git, runner };
}

/**
 * Minimal nihil.config.json seeding helpers.
 */
function configWithWorkflows(
  workflows: Record<string, { command: string; longRunning?: boolean }>,
): string {
  return JSON.stringify({ workflows });
}

// ── file-operation ordering ───────────────────────────────────────────────────

describe("ProjectRunner — file-operation ordering", () => {
  it("applies write, edit, rename, delete, copy in stream order in one message", async () => {
    /**
     * Message pipeline (all 5 action types in a single message):
     *   1. write   → creates alpha.txt
     *   2. edit    → patches alpha.txt
     *   3. rename  → alpha.txt → beta.txt
     *   4. copy    → beta.txt  → gamma.txt
     *   5. delete  → beta.txt
     *
     * Expected final state: only gamma.txt remains with the edited content.
     * Outcomes list must be exactly 5 entries, all ok, in submission order.
     */
    const { project, runner } = makeRunner();

    const msg = [
      '<nihil-write path="alpha.txt">',
      "hello",
      "</nihil-write>",
      '<nihil-edit path="alpha.txt">',
      "<<<<<<< SEARCH",
      "hello",
      "=======",
      "hello world",
      ">>>>>>> REPLACE",
      "</nihil-edit>",
      '<nihil-rename from="alpha.txt" to="beta.txt"/>',
      '<nihil-copy from="beta.txt" to="gamma.txt"/>',
      '<nihil-delete path="beta.txt"/>',
    ].join("\n");

    const result = await runner.runMessage("m-order", singleChunk(msg));

    expect(result.committed).toBe(true);
    expect(result.rolledBack).toBe(false);

    // Final filesystem state
    expect(project.files.has("alpha.txt")).toBe(false);
    expect(project.files.has("beta.txt")).toBe(false);
    expect(project.files.get("gamma.txt")).toBe("hello world");

    // Exactly 5 outcomes in order
    expect(result.outcomes).toHaveLength(5);
    expect(result.outcomes[0]).toMatchObject({ kind: "write", ok: true, path: "alpha.txt" });
    expect(result.outcomes[1]).toMatchObject({ kind: "edit", ok: true, path: "alpha.txt" });
    expect(result.outcomes[2]).toMatchObject({ kind: "rename", ok: true, path: "beta.txt" });
    expect(result.outcomes[3]).toMatchObject({ kind: "copy", ok: true, path: "gamma.txt" });
    expect(result.outcomes[4]).toMatchObject({ kind: "delete", ok: true, path: "beta.txt" });
  });

  it("edit after write in same message sees the write's content", async () => {
    /**
     * The SerialQueue guarantees that edit N executes after write N-1 has
     * already mutated the working tree. The edit searches for the written
     * content — if order were wrong, EDIT_NO_MATCH would fire.
     */
    const { project, runner } = makeRunner();

    const msg = [
      '<nihil-write path="counter.ts">',
      "let count = 0;",
      "</nihil-write>",
      '<nihil-edit path="counter.ts">',
      "<<<<<<< SEARCH",
      "let count = 0;",
      "=======",
      "let count = 10;",
      ">>>>>>> REPLACE",
      "</nihil-edit>",
    ].join("\n");

    const result = await runner.runMessage("m-edit-after-write", singleChunk(msg));

    expect(result.feedback).not.toContain("EDIT_NO_MATCH");
    expect(project.files.get("counter.ts")).toBe("let count = 10;");
    expect(result.outcomes).toHaveLength(2);
    expect(result.outcomes[0]).toMatchObject({ kind: "write", ok: true });
    expect(result.outcomes[1]).toMatchObject({ kind: "edit", ok: true });
  });

  it("delete after rename removes the renamed path (not the original)", async () => {
    const { project, runner } = makeRunner({ "old.ts": "content" });

    const msg = [
      '<nihil-rename from="old.ts" to="new.ts"/>',
      '<nihil-delete path="new.ts"/>',
    ].join("\n");

    const result = await runner.runMessage("m-delete-after-rename", singleChunk(msg));

    expect(result.outcomes).toHaveLength(2);
    expect(result.outcomes[0]).toMatchObject({ kind: "rename", ok: true });
    expect(result.outcomes[1]).toMatchObject({ kind: "delete", ok: true });
    expect(project.files.has("old.ts")).toBe(false);
    expect(project.files.has("new.ts")).toBe(false);
  });
});

// ── dependency batching ───────────────────────────────────────────────────────

describe("ProjectRunner — dependency batching", () => {
  it("merges multiple add-dependency tags into exactly ONE installPackages call", async () => {
    const { target, runner } = makeRunner();

    const msg = [
      '<nihil-add-dependency packages="react react-dom"/>',
      '<nihil-add-dependency packages="typescript"/>',
      '<nihil-add-dependency packages="vitest"/>',
    ].join("\n");

    await runner.runMessage("m-add-batch", singleChunk(msg));

    // Exactly one installPackages call
    expect(target.calls.installs).toHaveLength(1);
    // All packages in that single call
    expect(target.calls.installs[0]).toEqual(
      expect.arrayContaining(["react", "react-dom", "typescript", "vitest"]),
    );
    expect(target.calls.installs[0]).toHaveLength(4);
  });

  it("merges multiple remove-dependency tags into exactly ONE removePackages call", async () => {
    const { target, runner } = makeRunner();

    const msg = [
      '<nihil-remove-dependency packages="lodash"/>',
      '<nihil-remove-dependency packages="moment dayjs"/>',
    ].join("\n");

    await runner.runMessage("m-remove-batch", singleChunk(msg));

    // Exactly one removePackages call
    expect(target.calls.removes).toHaveLength(1);
    expect(target.calls.removes[0]).toEqual(
      expect.arrayContaining(["lodash", "moment", "dayjs"]),
    );
    expect(target.calls.removes[0]).toHaveLength(3);
  });

  it("de-duplicates packages listed more than once across tags", async () => {
    const { target, runner } = makeRunner();

    const msg = [
      '<nihil-add-dependency packages="react"/>',
      '<nihil-add-dependency packages="react react-dom"/>',
    ].join("\n");

    await runner.runMessage("m-dedup", singleChunk(msg));

    expect(target.calls.installs).toHaveLength(1);
    // "react" appears twice in input but must be de-duplicated to one
    expect(target.calls.installs[0]).toHaveLength(2);
    expect(target.calls.installs[0]).toEqual(expect.arrayContaining(["react", "react-dom"]));
  });

  it("install batch runs BEFORE remove batch (DECISIONS #15)", async () => {
    /**
     * Observe ordering by tracking the sequence of calls against the
     * FakeTarget.  We extend FakeTarget with a recording overlay via a spy
     * on the project's calls object.
     *
     * DECISIONS #15: "ordered install batch → remove batch"
     */
    const project = new MemoryProject();
    const target = new FakeTarget(project);
    const git = new FakeGitBackend(project);

    const callOrder: string[] = [];
    const origInstall = target.installPackages.bind(target);
    const origRemove = target.removePackages.bind(target);
    target.installPackages = async (pkgs) => {
      callOrder.push("install");
      return origInstall(pkgs);
    };
    target.removePackages = async (pkgs) => {
      callOrder.push("remove");
      return origRemove(pkgs);
    };

    const runner = new ProjectRunner({ target, git });

    const msg = [
      '<nihil-add-dependency packages="axios"/>',
      '<nihil-remove-dependency packages="node-fetch"/>',
    ].join("\n");

    await runner.runMessage("m-order-deps", singleChunk(msg));

    expect(callOrder).toEqual(["install", "remove"]);
  });

  it("package in both add and remove: removal wins, warning emitted", async () => {
    const { target, runner } = makeRunner();

    const msg = [
      '<nihil-add-dependency packages="lodash@^4 react"/>',
      '<nihil-remove-dependency packages="lodash"/>',
    ].join("\n");

    const result = await runner.runMessage("m-conflict", singleChunk(msg));

    // Warning feedback about conflict
    expect(result.feedback).toContain("removal wins");

    // "lodash" must NOT appear in the install call (removal wins)
    expect(target.calls.installs).toHaveLength(1);
    expect(target.calls.installs[0]).not.toContain("lodash@^4");
    expect(target.calls.installs[0]).toContain("react");

    // "lodash" MUST appear in the remove call
    expect(target.calls.removes).toHaveLength(1);
    expect(target.calls.removes[0]).toContain("lodash");
  });

  it("package in both add and remove: versioned spec matches bare name (packageBaseName)", async () => {
    /**
     * packageBaseName("@scope/pkg@^2") === "@scope/pkg"
     * packageBaseName("lodash@^4") === "lodash"
     * The remove entry is the bare name — it must still win over the versioned add.
     */
    const { target, runner } = makeRunner();

    const msg = [
      '<nihil-add-dependency packages="@scope/pkg@^2"/>',
      '<nihil-remove-dependency packages="@scope/pkg"/>',
    ].join("\n");

    const result = await runner.runMessage("m-scoped-conflict", singleChunk(msg));

    expect(result.feedback).toContain("removal wins");
    // install was skipped entirely (only conflicting pkg → adds list empty after filter)
    expect(target.calls.installs).toHaveLength(0);
    expect(target.calls.removes).toHaveLength(1);
    expect(target.calls.removes[0]).toContain("@scope/pkg");
  });

  it("no installPackages call when only removes are present", async () => {
    const { target, runner } = makeRunner();

    const msg = '<nihil-remove-dependency packages="old-lib"/>';

    await runner.runMessage("m-only-remove", singleChunk(msg));

    expect(target.calls.installs).toHaveLength(0);
    expect(target.calls.removes).toHaveLength(1);
  });

  it("no removePackages call when only adds are present", async () => {
    const { target, runner } = makeRunner();

    const msg = '<nihil-add-dependency packages="new-lib"/>';

    await runner.runMessage("m-only-add", singleChunk(msg));

    expect(target.calls.removes).toHaveLength(0);
    expect(target.calls.installs).toHaveLength(1);
  });

  it("INSTALL_FAILED feedback when installPackages returns ok=false", async () => {
    const project = new MemoryProject();
    const target = new FakeTarget(project);
    target.installResult = { ok: false, exitCode: 1, logTail: "npm ERR! 404 not found" };
    const git = new FakeGitBackend(project);
    const runner = new ProjectRunner({ target, git });

    const msg = '<nihil-add-dependency packages="nonexistent-pkg-xyz"/>';

    const result = await runner.runMessage("m-install-fail", singleChunk(msg));

    expect(result.feedback).toContain('code="INSTALL_FAILED"');
    expect(result.feedback).toContain("Dependency install failed");
  });
});

// ── run action routing ────────────────────────────────────────────────────────

describe("ProjectRunner — run action routing", () => {
  const buildConfig = configWithWorkflows({
    build: { command: "pnpm build" },
    test: { command: "pnpm test" },
    dev: { command: "vite", longRunning: true },
    "dev-server": { command: "node server.js", longRunning: true },
  });

  it("non-longRunning workflow with exit 0 records ok outcome", async () => {
    const { target, runner } = makeRunner({
      "nihil.config.json": buildConfig,
    });

    const msg = '<nihil-run workflow="build"/>';

    const result = await runner.runMessage("m-run-ok", singleChunk(msg));

    expect(target.calls.execs).toHaveLength(1);
    expect(target.calls.execs[0]).toMatchObject({ workflow: "build" });
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]).toMatchObject({ kind: "run", ok: true });
    expect(result.feedback).not.toContain("WORKFLOW_FAILED");
  });

  it("non-longRunning workflow with non-zero exit → WORKFLOW_FAILED feedback", async () => {
    const project = new MemoryProject();
    project.seed({ "nihil.config.json": buildConfig });
    const target = new FakeTarget(project);
    target.execExit.set("test", 1);
    const git = new FakeGitBackend(project);
    const runner = new ProjectRunner({ target, git });

    const msg = '<nihil-run workflow="test"/>';

    const result = await runner.runMessage("m-run-fail", singleChunk(msg));

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]).toMatchObject({ kind: "run", ok: false, code: "WORKFLOW_FAILED" });
    expect(result.feedback).toContain('code="WORKFLOW_FAILED"');
    // feedback is XML-escaped, so double-quotes appear as &quot; in the attribute
    expect(result.feedback).toContain("exited with code 1");
  });

  it("UNKNOWN_WORKFLOW when workflow name is not in nihil.config.json", async () => {
    const { runner } = makeRunner({
      "nihil.config.json": configWithWorkflows({
        build: { command: "pnpm build" },
      }),
    });

    const msg = '<nihil-run workflow="deploy"/>';

    const result = await runner.runMessage("m-unknown-wf", singleChunk(msg));

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]).toMatchObject({ kind: "run", ok: false, code: "UNKNOWN_WORKFLOW" });
    expect(result.feedback).toContain('code="UNKNOWN_WORKFLOW"');
  });

  it("UNKNOWN_WORKFLOW when nihil.config.json is absent (no workflows)", async () => {
    // No nihil.config.json seeded → runner falls back to empty config
    const { runner } = makeRunner();

    const msg = '<nihil-run workflow="anything"/>';

    const result = await runner.runMessage("m-no-config", singleChunk(msg));

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]).toMatchObject({ kind: "run", ok: false, code: "UNKNOWN_WORKFLOW" });
    expect(result.feedback).toContain('code="UNKNOWN_WORKFLOW"');
  });

  it("longRunning workflow is deferred and records ok without blocking", async () => {
    /**
     * DECISIONS #18: longRunning dev server detaches at the tail.
     * The runner must not await the process exit — it records ok immediately.
     * We verify this by using a process handle whose exited promise never
     * resolves (a longRunning dev server). If the runner awaited it the test
     * would hang; completion proves the detach path.
     *
     * We override FakeTarget.exec to return a never-resolving exited promise
     * only for the "dev" workflow, but ensure the workflow IS found in config.
     */
    const project = new MemoryProject();
    project.seed({ "nihil.config.json": buildConfig });
    const target = new FakeTarget(project);
    const git = new FakeGitBackend(project);

    // Replace exec to hand back a never-settling handle for "dev"
    const origExec = target.exec.bind(target);
    target.exec = (cmd) => {
      const ref = typeof cmd === "string" ? { workflow: "(raw)" } : cmd;
      if (ref.workflow === "dev") {
        target.calls.execs.push(ref);
        return {
          pid: 99,
          command: "vite",
          logs: { async *[Symbol.asyncIterator]() {} },
          exited: new Promise(() => { /* never resolves */ }),
          kill: async () => {},
        };
      }
      return origExec(cmd);
    };

    const runner = new ProjectRunner({ target, git });
    const msg = '<nihil-run workflow="dev"/>';

    // This must resolve promptly, not hang waiting for the dev server
    const result = await runner.runMessage("m-deferred", singleChunk(msg));

    expect(target.calls.execs).toHaveLength(1);
    expect(target.calls.execs[0]).toMatchObject({ workflow: "dev" });
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]).toMatchObject({ kind: "run", ok: true });
    expect(result.feedback).not.toContain("WORKFLOW_FAILED");
  });

  it("non-longRunning run completes before the message result is returned", async () => {
    /**
     * Verifies the runner actually awaits non-longRunning runs.
     * We track whether exec's exited promise resolved before result returned.
     */
    const project = new MemoryProject();
    project.seed({ "nihil.config.json": buildConfig });
    const target = new FakeTarget(project);
    const git = new FakeGitBackend(project);
    let exitedResolved = false;

    const origExec = target.exec.bind(target);
    target.exec = (cmd) => {
      const handle = origExec(cmd);
      return {
        ...handle,
        exited: handle.exited.then((exit) => {
          exitedResolved = true;
          return exit;
        }),
      };
    };

    const runner = new ProjectRunner({ target, git });
    const msg = '<nihil-run workflow="build"/>';

    await runner.runMessage("m-awaited", singleChunk(msg));
    expect(exitedResolved).toBe(true);
  });

  it("multiple runs in one message: non-longRunning executes before longRunning", async () => {
    /**
     * DECISIONS #18: longRunning workflows start last (deferred after the commit).
     * Message contains: build (short) then dev (long).
     * The runner should execute build first, then dev.
     */
    const project = new MemoryProject();
    project.seed({ "nihil.config.json": buildConfig });
    const target = new FakeTarget(project);
    const git = new FakeGitBackend(project);
    const execOrder: string[] = [];

    const origExec = target.exec.bind(target);
    target.exec = (cmd) => {
      const ref = typeof cmd === "string" ? { workflow: "(raw)" } : cmd;
      execOrder.push(ref.workflow);
      if (ref.workflow === "dev") {
        target.calls.execs.push(ref);
        return {
          pid: 99,
          command: "vite",
          logs: { async *[Symbol.asyncIterator]() {} },
          exited: new Promise(() => {}),
          kill: async () => {},
        };
      }
      return origExec(cmd);
    };

    const runner = new ProjectRunner({ target, git });
    // build first (non-longRunning), dev second (longRunning)
    const msg = [
      '<nihil-run workflow="build"/>',
      '<nihil-run workflow="dev"/>',
    ].join("\n");

    await runner.runMessage("m-exec-order", singleChunk(msg));

    // build must run before dev regardless of stream order
    expect(execOrder[0]).toBe("build");
    expect(execOrder[1]).toBe("dev");
  });

  it("run with unknown workflow does not block other successful file ops", async () => {
    const { project, runner } = makeRunner({
      "nihil.config.json": configWithWorkflows({
        build: { command: "pnpm build" },
      }),
    });

    const msg = [
      '<nihil-write path="app.ts">',
      "export {}",
      "</nihil-write>",
      '<nihil-run workflow="nonexistent"/>',
    ].join("\n");

    const result = await runner.runMessage("m-fail-run-ok-file", singleChunk(msg));

    // File write succeeded
    expect(project.files.get("app.ts")).toBe("export {}");
    // Run failed
    const runOutcome = result.outcomes.find((o) => o.kind === "run");
    expect(runOutcome).toMatchObject({ ok: false, code: "UNKNOWN_WORKFLOW" });
    // Message still committed (file changed)
    expect(result.committed).toBe(true);
  });
});

// ── streaming / chunked delivery ─────────────────────────────────────────────

describe("ProjectRunner — chunked streaming of file ops", () => {
  it("write split across multiple chunks applies correctly", async () => {
    const { project, runner } = makeRunner();

    // Simulate progressive streaming: each chunk is the full accumulated text so far
    const accumulated1 = '<nihil-write path="split.txt">\nhello ';
    const accumulated2 = '<nihil-write path="split.txt">\nhello world';
    const accumulated3 = '<nihil-write path="split.txt">\nhello world\n</nihil-write>';

    const result = await runner.runMessage("m-chunked", chunks(accumulated1, accumulated2, accumulated3));

    expect(result.committed).toBe(true);
    expect(project.files.get("split.txt")).toBe("hello world");
  });
});

// ── outcome recording completeness ───────────────────────────────────────────

describe("ProjectRunner — outcome recording", () => {
  it("records actionIds in ascending order matching stream order", async () => {
    const { runner } = makeRunner({
      "nihil.config.json": configWithWorkflows({ build: { command: "pnpm build" } }),
      "src/a.ts": "const a = 1;\n",
    });

    const msg = [
      '<nihil-write path="x.ts">',
      "const x = 1;",
      "</nihil-write>",
      '<nihil-edit path="src/a.ts">',
      "<<<<<<< SEARCH",
      "const a = 1;",
      "=======",
      "const a = 2;",
      ">>>>>>> REPLACE",
      "</nihil-edit>",
      '<nihil-add-dependency packages="zod"/>',
      '<nihil-run workflow="build"/>',
    ].join("\n");

    const result = await runner.runMessage("m-ids", singleChunk(msg));

    // write (0), edit (1) → file outcomes
    const fileOutcomes = result.outcomes.filter((o) => o.kind === "write" || o.kind === "edit");
    expect(fileOutcomes).toHaveLength(2);
    expect(fileOutcomes[0].actionId).toBeLessThan(fileOutcomes[1].actionId);

    // run outcome has a higher actionId than both file actions
    const runOutcome = result.outcomes.find((o) => o.kind === "run");
    expect(runOutcome).toBeDefined();
  });

  it("failed file op is recorded with ok=false but succeeds do not lose their ok=true", async () => {
    const { runner } = makeRunner({
      "exists.ts": "const x = 1;\n",
    });

    const msg = [
      // This write will succeed
      '<nihil-write path="new.ts">',
      "const n = 1;",
      "</nihil-write>",
      // This edit targets a non-existent file → FILE_NOT_FOUND
      '<nihil-edit path="does-not-exist.ts">',
      "<<<<<<< SEARCH",
      "foo",
      "=======",
      "bar",
      ">>>>>>> REPLACE",
      "</nihil-edit>",
    ].join("\n");

    const result = await runner.runMessage("m-mixed-ok", singleChunk(msg));

    const writeOutcome = result.outcomes.find((o) => o.kind === "write");
    const editOutcome = result.outcomes.find((o) => o.kind === "edit");
    expect(writeOutcome).toMatchObject({ ok: true });
    expect(editOutcome).toMatchObject({ ok: false, code: "FILE_NOT_FOUND" });
  });
});
