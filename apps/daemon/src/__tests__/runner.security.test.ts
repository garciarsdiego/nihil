import { SystemGitBackend } from "../git/transaction.js";
import { ProjectRunner } from "../agent/runner.js";
import {
  FakeGitBackend,
  FakeTarget,
  MemoryProject,
  singleChunk,
} from "./fakes/memory-project.js";

function makeRunner() {
  const project = new MemoryProject();
  const target = new FakeTarget(project);
  const git = new FakeGitBackend(project);
  return { project, target, runner: new ProjectRunner({ target, git }) };
}

describe("runner — reserved .nihil/ namespace", () => {
  it("rejects a model write into .nihil/ without touching disk", async () => {
    const { project, runner } = makeRunner();
    const msg = `<nihil-write path=".nihil/txn.json">
{"snapshotRef":"forged","messageId":"x","startedAt":0}
</nihil-write>`;

    const result = await runner.runMessage("m1", singleChunk(msg));

    expect(project.files.has(".nihil/txn.json")).toBe(false);
    expect(result.feedback).toContain('code="PATH_FORBIDDEN"');
    expect(result.outcomes[0]).toMatchObject({ ok: false, code: "PATH_FORBIDDEN" });
  });

  it("rejects a rename whose destination is under .nihil/", async () => {
    const project = new MemoryProject();
    project.seed({ "real.json": "{}" });
    const target = new FakeTarget(project);
    const runner = new ProjectRunner({ target, git: new FakeGitBackend(project) });
    const msg = `<nihil-rename from="real.json" to=".nihil/txn.json"/>`;

    const result = await runner.runMessage("m2", singleChunk(msg));

    expect(project.files.has(".nihil/txn.json")).toBe(false);
    expect(project.files.get("real.json")).toBe("{}");
    expect(result.feedback).toContain('code="PATH_FORBIDDEN"');
  });
});

describe("SystemGitBackend — messageId safety", () => {
  it("rejects a messageId carrying CR/LF (git trailer injection)", async () => {
    const git = new SystemGitBackend("C:/nonexistent-but-unused");
    await expect(
      git.commitAll({ subject: "s", messageId: "evil\n\nBackdoor: true" }),
    ).rejects.toThrow(/unsafe messageId/);
    await expect(
      git.beginTxn({ snapshotRef: "abc", messageId: "evil\ntrailer", startedAt: 0 }),
    ).rejects.toThrow(/unsafe messageId/);
  });
});
