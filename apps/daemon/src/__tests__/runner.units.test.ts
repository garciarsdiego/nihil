/**
 * Focused unit tests for the small pure/observable pieces of the runner.
 * Coverage areas:
 *  - config-policy: touchesWorkflowConfig + configPathOf for every action kind
 *  - feedback.ts: FeedbackCollector (error/warning/info, isEmpty, serialize, ordering)
 *  - serial-queue.ts: SerialQueue (submission order, rejected jobs don't block later ones, idle)
 *  - packageBaseName from runner.ts (scope handling, version stripping)
 *  - observer wiring (onActionStart, onActionResult, onCommit, onProse) via FakeTarget/FakeGitBackend
 *  - plan action path: <nihil-plan> fires onPlan, no disk write, no commit
 */

import { describe, it, expect, vi } from "vitest";
import { serializeOutput } from "@nihil/protocol";
import { touchesWorkflowConfig, configPathOf } from "../agent/config-policy.js";
import { FeedbackCollector } from "../agent/feedback.js";
import { SerialQueue } from "../agent/serial-queue.js";
import { packageBaseName, ProjectRunner } from "../agent/runner.js";
import {
  FakeGitBackend,
  FakeTarget,
  MemoryProject,
  singleChunk,
} from "./fakes/memory-project.js";
import type { NihilAction } from "@nihil/protocol";

// ── helpers shared across suites ───────────────────────────────────────────

function makeRunner(
  seed: Record<string, string> = {},
  opts: { applyEnabled?: boolean; observer?: ConstructorParameters<typeof ProjectRunner>[0]["observer"] } = {},
) {
  const project = new MemoryProject();
  project.seed(seed);
  const target = new FakeTarget(project);
  const git = new FakeGitBackend(project);
  const runner = new ProjectRunner({
    target,
    git,
    applyEnabled: opts.applyEnabled ?? true,
    observer: opts.observer,
  });
  return { project, target, git, runner };
}

// ── config-policy: touchesWorkflowConfig ──────────────────────────────────

describe("touchesWorkflowConfig", () => {
  it("returns true for write to nihil.config.json", () => {
    const action: NihilAction = { kind: "write", path: "nihil.config.json", content: "{}" };
    expect(touchesWorkflowConfig(action)).toBe(true);
  });

  it("returns false for write to another path", () => {
    const action: NihilAction = { kind: "write", path: "src/App.tsx", content: "x" };
    expect(touchesWorkflowConfig(action)).toBe(false);
  });

  it("returns true for edit to nihil.config.json", () => {
    const action: NihilAction = {
      kind: "edit",
      path: "nihil.config.json",
      blocks: [{ search: "a", replace: "b" }],
    };
    expect(touchesWorkflowConfig(action)).toBe(true);
  });

  it("returns false for edit to another path", () => {
    const action: NihilAction = {
      kind: "edit",
      path: "src/index.ts",
      blocks: [{ search: "a", replace: "b" }],
    };
    expect(touchesWorkflowConfig(action)).toBe(false);
  });

  it("returns true for delete of nihil.config.json", () => {
    const action: NihilAction = { kind: "delete", path: "nihil.config.json" };
    expect(touchesWorkflowConfig(action)).toBe(true);
  });

  it("returns false for delete of another path", () => {
    const action: NihilAction = { kind: "delete", path: "src/unused.ts" };
    expect(touchesWorkflowConfig(action)).toBe(false);
  });

  it("returns true for rename from nihil.config.json", () => {
    const action: NihilAction = { kind: "rename", from: "nihil.config.json", to: "nihil.config.json.bak" };
    expect(touchesWorkflowConfig(action)).toBe(true);
  });

  it("returns true for rename to nihil.config.json", () => {
    const action: NihilAction = { kind: "rename", from: "nihil.config.json.new", to: "nihil.config.json" };
    expect(touchesWorkflowConfig(action)).toBe(true);
  });

  it("returns false for rename where neither side is nihil.config.json", () => {
    const action: NihilAction = { kind: "rename", from: "src/a.ts", to: "src/b.ts" };
    expect(touchesWorkflowConfig(action)).toBe(false);
  });

  it("returns true for copy from nihil.config.json", () => {
    const action: NihilAction = { kind: "copy", from: "nihil.config.json", to: "nihil.config.backup.json" };
    expect(touchesWorkflowConfig(action)).toBe(true);
  });

  it("returns true for copy to nihil.config.json", () => {
    const action: NihilAction = { kind: "copy", from: "staging.json", to: "nihil.config.json" };
    expect(touchesWorkflowConfig(action)).toBe(true);
  });

  it("returns false for copy where neither side is nihil.config.json", () => {
    const action: NihilAction = { kind: "copy", from: "src/a.ts", to: "src/b.ts" };
    expect(touchesWorkflowConfig(action)).toBe(false);
  });

  it("returns false for add-dependency", () => {
    const action: NihilAction = { kind: "add-dependency", packages: ["react"] };
    expect(touchesWorkflowConfig(action)).toBe(false);
  });

  it("returns false for remove-dependency", () => {
    const action: NihilAction = { kind: "remove-dependency", packages: ["lodash"] };
    expect(touchesWorkflowConfig(action)).toBe(false);
  });

  it("returns false for run", () => {
    const action: NihilAction = { kind: "run", workflow: "dev" };
    expect(touchesWorkflowConfig(action)).toBe(false);
  });

  it("returns false for plan", () => {
    const action: NihilAction = { kind: "plan", title: "Plan", body: "steps" };
    expect(touchesWorkflowConfig(action)).toBe(false);
  });
});

// ── config-policy: configPathOf ────────────────────────────────────────────

describe("configPathOf", () => {
  it("returns nihil.config.json for a write action", () => {
    const action: NihilAction = { kind: "write", path: "nihil.config.json", content: "{}" };
    expect(configPathOf(action)).toBe("nihil.config.json");
  });

  it("returns nihil.config.json for an edit action", () => {
    const action: NihilAction = {
      kind: "edit",
      path: "nihil.config.json",
      blocks: [{ search: "a", replace: "b" }],
    };
    expect(configPathOf(action)).toBe("nihil.config.json");
  });

  it("returns nihil.config.json for a delete action", () => {
    const action: NihilAction = { kind: "delete", path: "nihil.config.json" };
    expect(configPathOf(action)).toBe("nihil.config.json");
  });

  it("returns 'to' path when rename target is nihil.config.json", () => {
    const action: NihilAction = { kind: "rename", from: "staged.json", to: "nihil.config.json" };
    expect(configPathOf(action)).toBe("nihil.config.json");
  });

  it("returns 'from' path when rename source is nihil.config.json (moving away)", () => {
    // from = nihil.config.json, to != nihil.config.json → returns from
    const action: NihilAction = { kind: "rename", from: "nihil.config.json", to: "nihil.config.json.bak" };
    expect(configPathOf(action)).toBe("nihil.config.json");
  });

  it("returns 'to' path when copy target is nihil.config.json", () => {
    const action: NihilAction = { kind: "copy", from: "staging.json", to: "nihil.config.json" };
    expect(configPathOf(action)).toBe("nihil.config.json");
  });

  it("returns 'from' path when copy source is nihil.config.json", () => {
    const action: NihilAction = { kind: "copy", from: "nihil.config.json", to: "nihil.config.backup.json" };
    expect(configPathOf(action)).toBe("nihil.config.json");
  });
});

// ── FeedbackCollector ──────────────────────────────────────────────────────

describe("FeedbackCollector", () => {
  it("is empty initially", () => {
    const fc = new FeedbackCollector();
    expect(fc.isEmpty()).toBe(true);
  });

  it("is not empty after adding an error", () => {
    const fc = new FeedbackCollector();
    fc.error("something broke");
    expect(fc.isEmpty()).toBe(false);
  });

  it("error() produces a valid serializeOutput string with type=error", () => {
    const fc = new FeedbackCollector();
    fc.error("edit failed", { code: "EDIT_NO_MATCH", action: 2, path: "src/x.ts" });
    const serialized = fc.serialize();
    const expected = serializeOutput({
      type: "error",
      message: "edit failed",
      code: "EDIT_NO_MATCH",
      action: 2,
      path: "src/x.ts",
    });
    expect(serialized).toBe(expected);
  });

  it("warning() produces a valid serializeOutput string with type=warning", () => {
    const fc = new FeedbackCollector();
    fc.warning("heads up", { code: "PLAN_MODE_VIOLATION", action: 0 });
    const serialized = fc.serialize();
    const expected = serializeOutput({
      type: "warning",
      message: "heads up",
      code: "PLAN_MODE_VIOLATION",
      action: 0,
    });
    expect(serialized).toBe(expected);
  });

  it("info() produces a valid serializeOutput string with type=info", () => {
    const fc = new FeedbackCollector();
    fc.info("config changed", { action: 1, path: "nihil.config.json" });
    const serialized = fc.serialize();
    const expected = serializeOutput({
      type: "info",
      message: "config changed",
      action: 1,
      path: "nihil.config.json",
    });
    expect(serialized).toBe(expected);
  });

  it("serialize() joins multiple outputs with newline in insertion order", () => {
    const fc = new FeedbackCollector();
    fc.error("first error");
    fc.warning("second warning");
    fc.info("third info");
    const serialized = fc.serialize();
    const parts = serialized.split("\n");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toContain('type="error"');
    expect(parts[1]).toContain('type="warning"');
    expect(parts[2]).toContain('type="info"');
  });

  it("serialize() returns empty string when no outputs have been added", () => {
    const fc = new FeedbackCollector();
    expect(fc.serialize()).toBe("");
  });

  it("preserves insertion order across mixed types", () => {
    const fc = new FeedbackCollector();
    fc.info("info first");
    fc.error("error second");
    fc.warning("warning third");
    const list = fc.list();
    expect(list[0].type).toBe("info");
    expect(list[1].type).toBe("error");
    expect(list[2].type).toBe("warning");
    expect(list[0].message).toBe("info first");
    expect(list[1].message).toBe("error second");
    expect(list[2].message).toBe("warning third");
  });

  it("body is escaped via serializeOutput", () => {
    const fc = new FeedbackCollector();
    fc.error("msg", { body: "content with <tags> & 'quotes'" });
    const serialized = fc.serialize();
    // body is XML-escaped inside the element
    expect(serialized).toContain("&lt;tags&gt;");
    expect(serialized).toContain("&amp;");
  });

  it("message with XML special chars is escaped in attribute", () => {
    const fc = new FeedbackCollector();
    fc.error('file "src/x.ts" & more');
    const serialized = fc.serialize();
    expect(serialized).toContain("&quot;");
    expect(serialized).toContain("&amp;");
  });
});

// ── SerialQueue ────────────────────────────────────────────────────────────

describe("SerialQueue", () => {
  it("runs jobs in submission order", async () => {
    const queue = new SerialQueue();
    const order: number[] = [];
    const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    queue.run(async () => {
      await delay(10);
      order.push(1);
    });
    queue.run(async () => {
      order.push(2);
    });
    queue.run(async () => {
      order.push(3);
    });

    await queue.idle();
    expect(order).toEqual([1, 2, 3]);
  });

  it("later jobs run even when an earlier job rejects", async () => {
    const queue = new SerialQueue();
    const order: number[] = [];

    queue.run(async () => {
      order.push(1);
      throw new Error("job 1 failed");
    });
    queue.run(async () => {
      order.push(2);
    });
    queue.run(async () => {
      order.push(3);
    });

    await queue.idle();
    expect(order).toEqual([1, 2, 3]);
  });

  it("idle() resolves immediately when no jobs are queued", async () => {
    const queue = new SerialQueue();
    await expect(queue.idle()).resolves.toBeUndefined();
  });

  it("idle() resolves after all settled jobs (including rejected)", async () => {
    const queue = new SerialQueue();
    const settled: string[] = [];

    queue.run(async () => {
      settled.push("reject");
      throw new Error("fail");
    });
    queue.run(async () => {
      settled.push("resolve");
    });

    await queue.idle();
    expect(settled).toEqual(["reject", "resolve"]);
  });

  it("run() returns the job result", async () => {
    const queue = new SerialQueue();
    const promise = queue.run(async () => 42);
    await expect(promise).resolves.toBe(42);
  });

  it("run() propagates rejection to caller but queue keeps running", async () => {
    const queue = new SerialQueue();
    const p1 = queue.run(async () => {
      throw new Error("boom");
    });
    const afterSettled: number[] = [];
    queue.run(async () => {
      afterSettled.push(1);
    });

    await expect(p1).rejects.toThrow("boom");
    await queue.idle();
    expect(afterSettled).toEqual([1]);
  });
});

// ── packageBaseName ────────────────────────────────────────────────────────

describe("packageBaseName", () => {
  it("strips version specifier from a bare package name", () => {
    expect(packageBaseName("zustand@^4")).toBe("zustand");
  });

  it("strips version from scoped package", () => {
    expect(packageBaseName("@scope/pkg@1.2")).toBe("@scope/pkg");
  });

  it("returns bare package name unchanged", () => {
    expect(packageBaseName("lodash")).toBe("lodash");
  });

  it("returns scoped package without version unchanged", () => {
    expect(packageBaseName("@scope/pkg")).toBe("@scope/pkg");
  });

  it("strips version from double-at scoped package", () => {
    expect(packageBaseName("@scope/pkg@^2.0.0")).toBe("@scope/pkg");
  });

  it("strips version from package with prerelease", () => {
    expect(packageBaseName("react@19.0.0-rc.1")).toBe("react");
  });

  it("returns single @ prefix alone (edge: @scope only, no slash)", () => {
    // @scope-only (no slash, no version) should return as-is
    expect(packageBaseName("@types")).toBe("@types");
  });

  it("handles empty-like spec with no @ at all", () => {
    expect(packageBaseName("react")).toBe("react");
  });
});

// ── Observer wiring via runner ─────────────────────────────────────────────

describe("ProjectRunner observer wiring", () => {
  it("onActionStart fires once per action with correct actionId and meta", async () => {
    const starts: { id: string; actionId: number; meta: { kind: string } }[] = [];
    const { runner } = makeRunner({}, {
      observer: {
        onActionStart: (id, actionId, meta) => starts.push({ id, actionId, meta }),
      },
    });

    const msg = `<nihil-write path="src/Foo.tsx">
export const Foo = () => null;
</nihil-write>`;

    await runner.runMessage("m-obs-1", singleChunk(msg));

    expect(starts).toHaveLength(1);
    expect(starts[0].id).toBe("m-obs-1");
    expect(starts[0].actionId).toBe(0);
    expect(starts[0].meta.kind).toBe("write");
  });

  it("onActionResult fires once per action with the outcome", async () => {
    const results: { id: string; outcome: { kind: string; ok: boolean } }[] = [];
    const { runner } = makeRunner({}, {
      observer: {
        onActionResult: (id, outcome) => results.push({ id, outcome }),
      },
    });

    const msg = `<nihil-write path="src/Bar.tsx">
export const Bar = () => null;
</nihil-write>`;

    await runner.runMessage("m-obs-2", singleChunk(msg));

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("m-obs-2");
    expect(results[0].outcome.kind).toBe("write");
    expect(results[0].outcome.ok).toBe(true);
  });

  it("onCommit fires with a non-empty ref when changes were committed", async () => {
    const commits: { id: string; ref: string }[] = [];
    const { runner } = makeRunner({}, {
      observer: {
        onCommit: (id, ref) => commits.push({ id, ref }),
      },
    });

    const msg = `<nihil-write path="src/Component.tsx">
export const C = () => null;
</nihil-write>`;

    await runner.runMessage("m-obs-3", singleChunk(msg));

    expect(commits).toHaveLength(1);
    expect(commits[0].id).toBe("m-obs-3");
    expect(commits[0].ref).toBeTruthy();
  });

  it("onCommit does NOT fire when nothing changed (no disk writes)", async () => {
    const commits: string[] = [];
    const { runner } = makeRunner({}, {
      observer: {
        onCommit: (id) => commits.push(id),
      },
    });

    // prose-only message — no action tags
    const msg = "Here is a plan for the refactor.";

    await runner.runMessage("m-obs-4", singleChunk(msg));

    expect(commits).toHaveLength(0);
  });

  it("onProse fires for plain text before and after action tags", async () => {
    const proses: { id: string; text: string }[] = [];
    const { runner } = makeRunner({}, {
      observer: {
        onProse: (id, text) => proses.push({ id, text }),
      },
    });

    const msg = `Hello world
<nihil-write path="x.txt">
hi
</nihil-write>
Done.`;

    await runner.runMessage("m-obs-5", singleChunk(msg));

    // At least one prose event should have fired
    expect(proses.length).toBeGreaterThan(0);
    expect(proses.every((p) => p.id === "m-obs-5")).toBe(true);
  });

  it("onActionResult fires with ok=false when edit target file does not exist", async () => {
    const results: { outcome: { kind: string; ok: boolean; code?: string } }[] = [];
    const { runner } = makeRunner({}, {
      observer: {
        onActionResult: (_id, outcome) => results.push({ outcome }),
      },
    });

    const msg = `<nihil-edit path="nonexistent.ts">
<<<<<<< SEARCH
const x = 1;
=======
const x = 2;
>>>>>>> REPLACE
</nihil-edit>`;

    await runner.runMessage("m-obs-6", singleChunk(msg));

    expect(results).toHaveLength(1);
    expect(results[0].outcome.ok).toBe(false);
    expect(results[0].outcome.code).toBe("FILE_NOT_FOUND");
  });

  it("fires both onActionStart and onActionResult for two actions in one message", async () => {
    const starts: number[] = [];
    const results: number[] = [];

    const { runner } = makeRunner({}, {
      observer: {
        onActionStart: (_id, actionId) => starts.push(actionId),
        onActionResult: (_id, outcome) => results.push(outcome.actionId),
      },
    });

    const msg = `<nihil-write path="a.txt">
alpha
</nihil-write>
<nihil-write path="b.txt">
beta
</nihil-write>`;

    await runner.runMessage("m-obs-7", singleChunk(msg));

    expect(starts).toHaveLength(2);
    expect(results).toHaveLength(2);
    // actionIds are assigned 0-based in stream order
    expect(starts).toContain(0);
    expect(starts).toContain(1);
    expect(results).toContain(0);
    expect(results).toContain(1);
  });

  it("onConfigChange fires when nihil.config.json is written", async () => {
    const configChanges: { actionId: number; path: string }[] = [];
    const { runner } = makeRunner({}, {
      observer: {
        onConfigChange: (_id, info) => configChanges.push(info),
      },
    });

    const msg = `<nihil-write path="nihil.config.json">
{ "workflows": { "build": { "command": "tsc" } } }
</nihil-write>`;

    await runner.runMessage("m-obs-8", singleChunk(msg));

    expect(configChanges).toHaveLength(1);
    expect(configChanges[0].path).toBe("nihil.config.json");
    expect(configChanges[0].actionId).toBe(0);
  });
});

// ── Plan action path ───────────────────────────────────────────────────────

describe("plan action path", () => {
  it("onPlan is called with title and body from <nihil-plan>", async () => {
    const plans: { id: string; plan: { title: string; body: string } }[] = [];
    const { runner } = makeRunner({}, {
      observer: {
        onPlan: (id, plan) => plans.push({ id, plan }),
      },
    });

    const msg = `<nihil-plan title="Refactor Auth">
Step 1: Extract the auth module.
Step 2: Add tests.
</nihil-plan>`;

    await runner.runMessage("m-plan-1", singleChunk(msg));

    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe("m-plan-1");
    expect(plans[0].plan.title).toBe("Refactor Auth");
    expect(plans[0].plan.body).toContain("Step 1");
  });

  it("<nihil-plan> does not write to disk", async () => {
    const { project, runner } = makeRunner({});

    const msg = `<nihil-plan title="No Disk Write">
Just planning, not writing.
</nihil-plan>`;

    const before = new Map(project.files);
    await runner.runMessage("m-plan-2", singleChunk(msg));

    // Working tree must be unchanged
    expect(project.files).toEqual(before);
  });

  it("<nihil-plan> alone does not produce a commit", async () => {
    const commits: string[] = [];
    const { project, runner } = makeRunner({}, {
      observer: {
        onCommit: (id) => commits.push(id),
      },
    });

    const initialHead = project.head;

    const msg = `<nihil-plan title="Plan Only">
Thinking out loud.
</nihil-plan>`;

    const result = await runner.runMessage("m-plan-3", singleChunk(msg));

    expect(result.committed).toBe(false);
    expect(commits).toHaveLength(0);
    expect(project.head).toBe(initialHead);
  });

  it("<nihil-plan> does not fire onActionResult", async () => {
    const results: unknown[] = [];
    const { runner } = makeRunner({}, {
      observer: {
        onActionResult: (_id, outcome) => results.push(outcome),
      },
    });

    const msg = `<nihil-plan title="Quiet Plan">
No observable side effects expected.
</nihil-plan>`;

    await runner.runMessage("m-plan-4", singleChunk(msg));

    expect(results).toHaveLength(0);
  });

  it("<nihil-plan> mixed with a write in one message: protocol rejects the write (PLAN_MODE_VIOLATION)", async () => {
    // SPEC §4.7 / parser enforces: a <nihil-plan> may not share a message with
    // action tags.  When plan appears first, the subsequent write is rejected
    // at the parser boundary with PLAN_MODE_VIOLATION — it never reaches the runner.
    const plans: { title: string }[] = [];
    const { project, runner } = makeRunner({}, {
      observer: {
        onPlan: (_id, plan) => plans.push({ title: plan.title }),
      },
    });

    const msg = `<nihil-plan title="Add file">
Adding a helper file.
</nihil-plan>
<nihil-write path="helper.ts">
export const helper = () => {};
</nihil-write>`;

    const result = await runner.runMessage("m-plan-5", singleChunk(msg));

    // The plan fires — it was first
    expect(plans).toHaveLength(1);
    expect(plans[0].title).toBe("Add file");
    // The write was rejected by the parser as PLAN_MODE_VIOLATION, so no disk write
    expect(project.files.has("helper.ts")).toBe(false);
    // No commit because nothing was written to disk
    expect(result.committed).toBe(false);
    // Feedback should contain the PLAN_MODE_VIOLATION error
    expect(result.feedback).toContain("PLAN_MODE_VIOLATION");
  });
});
