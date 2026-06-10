import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { ProjectRunner } from "../agent/runner.js";
import { LocalProcessTarget } from "../exec/local-process.js";
import { SystemGitBackend } from "../git/transaction.js";

const execFileAsync = promisify(execFile);
const templatesDir = fileURLToPath(new URL("./fixtures", import.meta.url));

/** git in a real project dir, returning trimmed stdout. */
async function gitOut(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

/** Yields one full-text chunk (single-shot accumulation). */
function singleChunk(text: string): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      yield text;
    },
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

let projectDir: string;
let target: LocalProcessTarget;
let git: SystemGitBackend;
let runner: ProjectRunner;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "nihil-int-"));
  target = new LocalProcessTarget({
    projectId: "integration-project",
    projectDir,
    templatesDir,
    readyTimeoutMs: 20_000,
  });
  await target.init({ name: "template-basic" });
  git = new SystemGitBackend(projectDir);
  runner = new ProjectRunner({ target, git });
});

afterEach(async () => {
  await target.destroy();
  await rm(projectDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

describe("ProjectRunner integration — real LocalProcessTarget + SystemGitBackend", () => {
  it(
    "writes a new file, edits a seeded file, and commits with the Nihil-Message-Id trailer",
    async () => {
      const headBefore = await gitOut(projectDir, ["rev-parse", "HEAD"]);

      // server.js seeded content contains the string "hello from fixture".
      const msg = `Adding a component and tweaking the server greeting.
<nihil-write path="src/Hero.tsx">
export const Hero = () => <h1>Hello</h1>;
</nihil-write>
<nihil-edit path="server.js">
<<<<<<< SEARCH
  res.end("hello from fixture");
=======
  res.end("hello from integration");
>>>>>>> REPLACE
</nihil-edit>`;

      const result = await runner.runMessage("msg-write-edit", singleChunk(msg));

      // (a) MessageResult contract
      expect(result.committed).toBe(true);
      expect(result.rolledBack).toBe(false);
      expect(result.commitRef).toMatch(/^[0-9a-f]{40}$/);
      expect(result.outcomes).toEqual([
        { actionId: 0, kind: "write", ok: true, path: "src/Hero.tsx" },
        { actionId: 1, kind: "edit", ok: true, path: "server.js" },
      ]);

      // (b) Real filesystem state
      expect(await target.readFile("src/Hero.tsx")).toContain("export const Hero");
      const server = await target.readFile("server.js");
      expect(server).toContain('res.end("hello from integration")');
      expect(server).not.toContain("hello from fixture");

      // (c) Real git: HEAD advanced by exactly one commit, trailer present
      const headAfter = await gitOut(projectDir, ["rev-parse", "HEAD"]);
      expect(headAfter).not.toBe(headBefore);
      expect(headAfter).toBe(result.commitRef);
      const count = await gitOut(projectDir, ["rev-list", "--count", `${headBefore}..${headAfter}`]);
      expect(count).toBe("1");

      // git's --trailer normalizes "key:value" to "key: value" (space added).
      const body = await gitOut(projectDir, ["log", "-1", "--format=%B"]);
      expect(body).toContain("Nihil-Message-Id: msg-write-edit");
      expect(body.split("\n")[0]).toMatch(/^feat:/);
      // The trailer is also retrievable structurally.
      const trailer = await gitOut(projectDir, [
        "log",
        "-1",
        "--format=%(trailers:key=Nihil-Message-Id,valueonly)",
      ]);
      expect(trailer).toBe("msg-write-edit");

      // (d) The committed tree actually contains the new file (not just the working tree)
      const tracked = await gitOut(projectDir, ["ls-tree", "-r", "--name-only", "HEAD"]);
      expect(tracked.split("\n")).toContain("src/Hero.tsx");

      // (e) Working tree is clean after a successful commit
      const status = await gitOut(projectDir, ["status", "--porcelain"]);
      expect(status).toBe("");
    },
    60_000,
  );

  it(
    "deletes the .nihil/txn.json marker after a successful message",
    async () => {
      const markerPath = join(projectDir, ".nihil", "txn.json");

      // The marker is written at beginTxn and removed at endTxn; after a
      // completed message it must be gone (DECISIONS #17).
      const result = await runner.runMessage(
        "msg-marker",
        singleChunk(`<nihil-write path="notes.md">
hello
</nihil-write>`),
      );

      expect(result.committed).toBe(true);
      expect(await exists(markerPath)).toBe(false);

      // pendingTxn() must report no in-flight transaction.
      expect(await git.pendingTxn()).toBeNull();

      // The marker file is never committed (it lives under the excluded .nihil/).
      const tracked = await gitOut(projectDir, ["ls-tree", "-r", "--name-only", "HEAD"]);
      expect(tracked.split("\n").some((p) => p.startsWith(".nihil/"))).toBe(false);
    },
    60_000,
  );

  it(
    "rolls back a created file on mid-stream abort, leaving a clean tree and preserving node_modules",
    async () => {
      // Seed a dummy node_modules BEFORE the message; rollback must not touch it.
      await mkdir(join(projectDir, "node_modules", "left-pad"), { recursive: true });
      await writeFile(join(projectDir, "node_modules", "left-pad", "index.js"), "module.exports = 1;\n");

      const headBefore = await gitOut(projectDir, ["rev-parse", "HEAD"]);
      const controller = new AbortController();
      const msg = `<nihil-write path="src/Doomed.tsx">
export const Doomed = () => null;
</nihil-write>`;

      async function* aborting(): AsyncGenerator<string> {
        yield msg; // write closes + applies (Doomed.tsx now on disk)
        controller.abort(); // user hits stop
        yield msg; // next iteration observes the abort → rollback
      }

      const result = await runner.runMessage("msg-abort", aborting(), {
        signal: controller.signal,
      });

      // (a) MessageResult reflects rollback
      expect(result.rolledBack).toBe(true);
      expect(result.committed).toBe(false);

      // (b) The created file is gone from the working tree
      expect(await exists(join(projectDir, "src", "Doomed.tsx"))).toBe(false);

      // (c) HEAD did not advance (no commit). The message's own untracked file
      // was deleted by the runner; reset --hard restored tracked files. The only
      // remaining untracked entry is the pre-existing node_modules (preserved).
      const headAfter = await gitOut(projectDir, ["rev-parse", "HEAD"]);
      expect(headAfter).toBe(headBefore);
      const statusLines = (await gitOut(projectDir, ["status", "--porcelain"]))
        .split("\n")
        .filter((l) => l.trim() !== "");
      // No leftover from the message's own write (tracked or untracked).
      expect(statusLines.some((l) => l.includes("Doomed.tsx"))).toBe(false);
      // Anything still reported is exclusively node_modules.
      expect(statusLines.every((l) => l.includes("node_modules"))).toBe(true);

      // (d) node_modules survives rollback (it is never in `created`)
      expect(await exists(join(projectDir, "node_modules", "left-pad", "index.js"))).toBe(true);

      // (e) The transaction marker is cleared after rollback too
      expect(await exists(join(projectDir, ".nihil", "txn.json"))).toBe(false);
      expect(await git.pendingTxn()).toBeNull();
    },
    60_000,
  );

  it(
    "commits the successful actions and feeds back EDIT_NO_MATCH without rolling back (DECISIONS #16)",
    async () => {
      const headBefore = await gitOut(projectDir, ["rev-parse", "HEAD"]);
      const msg = `<nihil-write path="src/Good.tsx">
export const Good = () => null;
</nihil-write>
<nihil-edit path="server.js">
<<<<<<< SEARCH
const totally = "not present in the file";
=======
const replaced = "x";
>>>>>>> REPLACE
</nihil-edit>`;

      const result = await runner.runMessage("msg-partial", singleChunk(msg));

      // Partial failure still commits the good write; failure is fed back.
      expect(result.committed).toBe(true);
      expect(result.rolledBack).toBe(false);
      expect(result.feedback).toContain('code="EDIT_NO_MATCH"');
      expect(result.feedback).toContain("Current content of server.js");

      // The good write landed; the bad edit left server.js untouched.
      expect(await exists(join(projectDir, "src", "Good.tsx"))).toBe(true);
      expect(await target.readFile("server.js")).toContain("hello from fixture");

      const outcomes = result.outcomes;
      expect(outcomes[0]).toMatchObject({ kind: "write", ok: true, path: "src/Good.tsx" });
      expect(outcomes[1]).toMatchObject({ kind: "edit", ok: false, code: "EDIT_NO_MATCH" });

      const headAfter = await gitOut(projectDir, ["rev-parse", "HEAD"]);
      expect(headAfter).not.toBe(headBefore);
    },
    60_000,
  );

  it(
    "rolls back a delete of a seeded tracked file on abort (file restored)",
    async () => {
      const headBefore = await gitOut(projectDir, ["rev-parse", "HEAD"]);
      // server.js is a tracked, seeded file. Deleting then aborting must
      // restore it via reset --hard.
      const controller = new AbortController();
      const msg = `<nihil-delete path="server.js"/>`;

      async function* aborting(): AsyncGenerator<string> {
        yield msg; // delete applies — server.js removed from working tree
        controller.abort();
        yield msg; // abort observed → rollback
      }

      const result = await runner.runMessage("msg-del-abort", aborting(), {
        signal: controller.signal,
      });

      expect(result.rolledBack).toBe(true);
      // reset --hard restored the tracked file
      expect(await exists(join(projectDir, "server.js"))).toBe(true);
      expect(await target.readFile("server.js")).toContain("hello from fixture");

      const headAfter = await gitOut(projectDir, ["rev-parse", "HEAD"]);
      expect(headAfter).toBe(headBefore);
      expect(await gitOut(projectDir, ["status", "--porcelain"])).toBe("");
    },
    60_000,
  );

  it(
    "reports committed:false with no new commit when a message produces no file changes",
    async () => {
      const headBefore = await gitOut(projectDir, ["rev-parse", "HEAD"]);
      // An edit against a non-existent file is fed back as FILE_NOT_FOUND and
      // writes nothing: git has nothing to stage → commitAll returns
      // committed:false, but the message is NOT rolled back (DECISIONS #16).
      const msg = `<nihil-edit path="does/not/exist.ts">
<<<<<<< SEARCH
foo
=======
bar
>>>>>>> REPLACE
</nihil-edit>`;

      const result = await runner.runMessage("msg-noop", singleChunk(msg));

      expect(result.outcomes[0]).toMatchObject({ kind: "edit", ok: false, code: "FILE_NOT_FOUND" });
      expect(result.committed).toBe(false);
      expect(result.rolledBack).toBe(false);
      expect(result.feedback).toContain('code="FILE_NOT_FOUND"');

      const headAfter = await gitOut(projectDir, ["rev-parse", "HEAD"]);
      expect(headAfter).toBe(headBefore);
      // Clean tree and marker cleared.
      expect(await gitOut(projectDir, ["status", "--porcelain"])).toBe("");
      expect(await exists(join(projectDir, ".nihil", "txn.json"))).toBe(false);
    },
    60_000,
  );

  it(
    "a <nihil-write> that only strips the file's trailing newline still produces a real diff and commits",
    async () => {
      // The parser's processWriteContent trims trailing blank lines, so writing
      // a file's own content back through <nihil-write> drops the final newline.
      // That is a genuine byte change — git stages and commits it. Documents the
      // nuance that there is no true no-op write for a newline-terminated file.
      const headBefore = await gitOut(projectDir, ["rev-parse", "HEAD"]);
      const existing = await target.readFile("src/main.txt");
      expect(existing.endsWith("\n")).toBe(true);
      const msg = `<nihil-write path="src/main.txt">
${existing}</nihil-write>`;

      const result = await runner.runMessage("msg-newline", singleChunk(msg));

      expect(result.outcomes[0]).toMatchObject({ kind: "write", ok: true, path: "src/main.txt" });
      expect(result.committed).toBe(true);
      expect(await target.readFile("src/main.txt")).toBe(existing.replace(/\n+$/, ""));

      const headAfter = await gitOut(projectDir, ["rev-parse", "HEAD"]);
      expect(headAfter).not.toBe(headBefore);
      expect(await gitOut(projectDir, ["status", "--porcelain"])).toBe("");
    },
    60_000,
  );

  it(
    "runs the immediate 'hello' workflow after commit and records a successful run outcome",
    async () => {
      // 'hello' is a short (non-longRunning) workflow declared in the fixture
      // nihil.config.json. It must run to completion (exit 0) after the commit.
      const msg = `<nihil-write path="src/Touch.tsx">
export const Touch = () => null;
</nihil-write>
<nihil-run workflow="hello"/>`;

      const result = await runner.runMessage("msg-run", singleChunk(msg));

      expect(result.committed).toBe(true);
      const runOutcome = result.outcomes.find((o) => o.kind === "run");
      expect(runOutcome).toMatchObject({ kind: "run", ok: true });
      // No workflow-failure feedback.
      expect(result.feedback).not.toContain('code="WORKFLOW_FAILED"');
    },
    60_000,
  );

  it(
    "serializes two real messages so the second sees the first's commit",
    async () => {
      const order: string[] = [];
      const a = runner
        .runMessage(
          "ser-a",
          singleChunk(`<nihil-write path="a.txt">\nA\n</nihil-write>`),
        )
        .then((r) => {
          order.push("a");
          return r;
        });
      const b = runner
        .runMessage(
          "ser-b",
          singleChunk(`<nihil-write path="b.txt">\nB\n</nihil-write>`),
        )
        .then((r) => {
          order.push("b");
          return r;
        });

      const [ra, rb] = await Promise.all([a, b]);

      expect(order).toEqual(["a", "b"]);
      expect(ra.committed).toBe(true);
      expect(rb.committed).toBe(true);
      expect(ra.commitRef).not.toBe(rb.commitRef);

      // Both files committed; rb built on top of ra (b's parent is a's commit).
      expect(await exists(join(projectDir, "a.txt"))).toBe(true);
      expect(await exists(join(projectDir, "b.txt"))).toBe(true);
      const parentOfB = await gitOut(projectDir, ["rev-parse", `${rb.commitRef}^`]);
      expect(parentOfB).toBe(ra.commitRef);
      expect(await gitOut(projectDir, ["status", "--porcelain"])).toBe("");
    },
    60_000,
  );
});
