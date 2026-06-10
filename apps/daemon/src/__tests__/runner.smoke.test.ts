import { ProjectRunner } from "../agent/runner.js";
import {
  FakeGitBackend,
  FakeTarget,
  MemoryProject,
  singleChunk,
} from "./fakes/memory-project.js";

function makeRunner(seed: Record<string, string> = {}, applyEnabled = true) {
  const project = new MemoryProject();
  project.seed(seed);
  const target = new FakeTarget(project);
  const git = new FakeGitBackend(project);
  const runner = new ProjectRunner({ target, git, applyEnabled });
  return { project, target, git, runner };
}

describe("ProjectRunner — core flow", () => {
  it("applies a write and commits with a result", async () => {
    const { project, runner } = makeRunner();
    const msg = `Here is a component.
<nihil-write path="src/Hero.tsx">
export const Hero = () => <h1>Hi</h1>;
</nihil-write>`;

    const result = await runner.runMessage("m1", singleChunk(msg));

    expect(result.committed).toBe(true);
    expect(result.rolledBack).toBe(false);
    expect(project.files.get("src/Hero.tsx")).toContain("export const Hero");
    expect(result.outcomes).toEqual([
      { actionId: 0, kind: "write", ok: true, path: "src/Hero.tsx" },
    ]);
  });

  it("applies an exact-match edit against a seeded file", async () => {
    const { project, runner } = makeRunner({ "src/App.tsx": 'import React from "react";\n' });
    const msg = `<nihil-edit path="src/App.tsx">
<<<<<<< SEARCH
import React from "react";
=======
import React from "react";
import { Hero } from "./Hero";
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m2", singleChunk(msg));

    expect(result.committed).toBe(true);
    expect(project.files.get("src/App.tsx")).toContain('import { Hero } from "./Hero";');
  });

  it("feeds back EDIT_NO_MATCH with a file excerpt and leaves the file untouched", async () => {
    const original = "const a = 1;\n";
    const { project, runner } = makeRunner({ "src/App.tsx": original });
    const msg = `<nihil-edit path="src/App.tsx">
<<<<<<< SEARCH
const NOT_PRESENT = 0;
=======
const b = 2;
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m3", singleChunk(msg));

    expect(project.files.get("src/App.tsx")).toBe(original);
    expect(result.feedback).toContain('code="EDIT_NO_MATCH"');
    expect(result.feedback).toContain("Current content of src/App.tsx");
    expect(result.outcomes[0]).toMatchObject({ ok: false, code: "EDIT_NO_MATCH" });
  });

  it("batches dependencies: install batch then remove batch, remove wins on conflict", async () => {
    const { target, runner } = makeRunner();
    const msg = `<nihil-add-dependency packages="zustand@^4 lodash"/>
<nihil-add-dependency packages="clsx"/>
<nihil-remove-dependency packages="lodash"/>`;

    const result = await runner.runMessage("m4", singleChunk(msg));

    expect(target.calls.installs).toEqual([["zustand@^4", "clsx"]]);
    expect(target.calls.removes).toEqual([["lodash"]]);
    expect(result.feedback).toContain("removal wins");
  });

  it("flags a nihil.config.json write as a config change", async () => {
    const { runner } = makeRunner();
    const changes: { actionId: number; path: string }[] = [];
    const project = new MemoryProject();
    const target = new FakeTarget(project);
    const git = new FakeGitBackend(project);
    const observed = new ProjectRunner({
      target,
      git,
      observer: { onConfigChange: (_id, info) => changes.push(info) },
    });
    void runner;
    const msg = `<nihil-write path="nihil.config.json">
{ "workflows": { "dev": { "command": "vite", "longRunning": true } } }
</nihil-write>`;

    const result = await observed.runMessage("m5", singleChunk(msg));

    expect(result.configChanged).toBe(true);
    expect(changes).toEqual([{ actionId: 0, path: "nihil.config.json" }]);
    expect(result.feedback).toContain('type="info"');
  });

  it("rolls back created files when aborted mid-stream", async () => {
    const { project, runner } = makeRunner({ "keep.txt": "stay" });
    const controller = new AbortController();
    const msg = `<nihil-write path="new.txt">
created
</nihil-write>`;
    async function* aborting(): AsyncGenerator<string> {
      yield msg; // write closes and applies
      controller.abort(); // user hits stop
      yield msg; // next iteration sees the abort → rollback
    }

    const result = await runner.runMessage("m6", aborting(), { signal: controller.signal });

    expect(result.rolledBack).toBe(true);
    expect(project.files.has("new.txt")).toBe(false);
    expect(project.files.get("keep.txt")).toBe("stay");
  });

  it("rejects a message whose signal is already aborted before it starts", async () => {
    const { project, runner } = makeRunner();
    const controller = new AbortController();
    controller.abort();
    const msg = `<nihil-write path="x.txt">
x
</nihil-write>`;

    await expect(
      runner.runMessage("m6b", singleChunk(msg), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "RunnerAbortError" });
    expect(project.files.has("x.txt")).toBe(false);
  });

  it("plan-mode gate rejects action tags without touching disk", async () => {
    const { project, runner } = makeRunner({}, false);
    const msg = `<nihil-write path="src/x.tsx">
x
</nihil-write>`;

    const result = await runner.runMessage("m7", singleChunk(msg));

    expect(project.files.has("src/x.tsx")).toBe(false);
    expect(result.committed).toBe(false);
    expect(result.feedback).toContain('code="PLAN_MODE_VIOLATION"');
  });

  it("serializes two messages on the same project", async () => {
    const { project, runner } = makeRunner();
    const order: string[] = [];
    const a = runner
      .runMessage("a", singleChunk('<nihil-write path="a.txt">\na\n</nihil-write>'))
      .then(() => order.push("a"));
    const b = runner
      .runMessage("b", singleChunk('<nihil-write path="b.txt">\nb\n</nihil-write>'))
      .then(() => order.push("b"));
    await Promise.all([a, b]);

    expect(order).toEqual(["a", "b"]);
    expect(project.files.get("a.txt")).toBe("a");
    expect(project.files.get("b.txt")).toBe("b");
  });
});
