import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { git } from "../git/cli.js";
import { SystemGitBackend } from "../git/transaction.js";

/**
 * Real-git integration tests for SystemGitBackend (git/transaction.ts) and the
 * git() helper (git/cli.ts). Each test gets a fresh temp repo with one initial
 * commit; the daemon backend operates against it exactly as it would against a
 * path-sharing target's projectDir (DECISIONS #13, #17, #20).
 *
 * These deliberately do NOT use the in-memory fakes — the point is to verify the
 * actual git invocations (trailer formatting, author identity, .nihil exclusion,
 * no-op guard, hard reset). Process/git tests get generous timeouts.
 */

const GIT_TIMEOUT = 20_000;

/** Init a repo at `dir`, configure a (non-Nihil) author, write `init.txt`, and
 * make the initial commit. Returns the HEAD sha. */
async function initRepo(dir: string, seed: Record<string, string> = {}): Promise<string> {
  await git(dir, ["init"]);
  // Deterministic, branch-name independent; avoid relying on the host default.
  await git(dir, ["config", "user.name", "Seed User"]);
  await git(dir, ["config", "user.email", "seed@example.com"]);
  await git(dir, ["config", "commit.gpgsign", "false"]);
  await writeFile(join(dir, "init.txt"), "initial\n", "utf8");
  for (const [path, content] of Object.entries(seed)) {
    const full = join(dir, path);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, content, "utf8");
  }
  await git(dir, ["add", "-A"]);
  await git(dir, ["-c", "user.name=Seed User", "-c", "user.email=seed@example.com", "commit", "-m", "initial"]);
  return git(dir, ["rev-parse", "HEAD"]);
}

describe("SystemGitBackend — real git transaction", () => {
  let dir: string;
  let backend: SystemGitBackend;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "nihil-git-"));
    backend = new SystemGitBackend(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });

  it(
    "snapshot() returns {kind:'git', ref:<40-hex sha>} matching HEAD",
    async () => {
      const head = await initRepo(dir);
      const snap = await backend.snapshot();

      expect(snap.kind).toBe("git");
      expect(snap.ref).toMatch(/^[0-9a-f]{40}$/);
      expect(snap.ref).toBe(head);
    },
    GIT_TIMEOUT,
  );

  it(
    "existsAt() is true for a committed file and false for a missing path",
    async () => {
      const head = await initRepo(dir, { "src/App.tsx": "export const App = 1;\n" });

      expect(await backend.existsAt(head, "src/App.tsx")).toBe(true);
      expect(await backend.existsAt(head, "init.txt")).toBe(true);
      expect(await backend.existsAt(head, "does/not/exist.tsx")).toBe(false);
      expect(await backend.existsAt(head, "src/Missing.tsx")).toBe(false);
    },
    GIT_TIMEOUT,
  );

  it(
    "commitAll() creates a commit with the Nihil-Message-Id trailer and Nihil author/committer",
    async () => {
      await initRepo(dir);
      await writeFile(join(dir, "feature.ts"), "export const x = 1;\n", "utf8");

      const result = await backend.commitAll({
        subject: "feat: write 1",
        body: "- write feature.ts",
        messageId: "msg-abc-123",
      });

      expect(result.committed).toBe(true);
      expect(result.ref).toMatch(/^[0-9a-f]{40}$/);
      expect(result.ref).toBe(await git(dir, ["rev-parse", "HEAD"]));

      const body = await git(dir, ["log", "-1", "--format=%B"]);
      // git --trailer normalizes "Key:val" → "Key: val" on its own line.
      expect(body).toContain("Nihil-Message-Id: msg-abc-123");
      expect(body).toContain("feat: write 1");
      expect(body).toContain("- write feature.ts");

      const ident = await git(dir, ["log", "-1", "--format=%an|%ae|%cn|%ce"]);
      expect(ident).toBe("Nihil|daemon@nihil.invalid|Nihil|daemon@nihil.invalid");
    },
    GIT_TIMEOUT,
  );

  it(
    "commitAll() with no working-tree change returns {committed:false} and creates no commit",
    async () => {
      const head = await initRepo(dir);
      const before = await git(dir, ["rev-list", "--count", "HEAD"]);

      const result = await backend.commitAll({ subject: "noop", messageId: "msg-noop" });

      expect(result).toEqual({ committed: false });
      expect(result.ref).toBeUndefined();
      // No new commit: HEAD unmoved, commit count unchanged.
      expect(await git(dir, ["rev-parse", "HEAD"])).toBe(head);
      expect(await git(dir, ["rev-list", "--count", "HEAD"])).toBe(before);
    },
    GIT_TIMEOUT,
  );

  it(
    "commitAll() omits the subject body when omitted (subject-only message still trailers)",
    async () => {
      await initRepo(dir);
      await writeFile(join(dir, "only-subject.ts"), "1\n", "utf8");

      const result = await backend.commitAll({ subject: "chore: subject only", messageId: "mid-1" });

      expect(result.committed).toBe(true);
      const body = await git(dir, ["log", "-1", "--format=%B"]);
      expect(body).toContain("chore: subject only");
      expect(body).toContain("Nihil-Message-Id: mid-1");
    },
    GIT_TIMEOUT,
  );

  it(
    "commitAll() EXCLUDES .nihil/ from the commit while committing tracked changes",
    async () => {
      await initRepo(dir);
      // beginTxn writes .nihil/txn.json; an authored file changes too.
      await backend.beginTxn({ snapshotRef: "deadbeef", messageId: "msg-x", startedAt: 1 });
      await writeFile(join(dir, "tracked.ts"), "export const y = 2;\n", "utf8");

      const result = await backend.commitAll({ subject: "feat: write 1", messageId: "msg-x" });

      expect(result.committed).toBe(true);

      const changed = (await git(dir, ["show", "--name-only", "--format=", "HEAD"]))
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      expect(changed).toContain("tracked.ts");
      expect(changed.some((p) => p.startsWith(".nihil"))).toBe(false);

      // The marker must remain in the working tree (it is the live transaction).
      expect(await backend.pendingTxn()).not.toBeNull();
      // And it is genuinely untracked by git (never staged). -uall lists the
      // individual file rather than collapsing to the "?? .nihil/" dir form.
      const status = await git(dir, ["status", "--porcelain", "-uall", "--", ".nihil"]);
      expect(status).toContain(".nihil/txn.json");
      expect(status.trimStart().startsWith("??")).toBe(true);
    },
    GIT_TIMEOUT,
  );

  it(
    "commitAll() returns {committed:false} when ONLY .nihil/ changed (excluded => nothing staged)",
    async () => {
      const head = await initRepo(dir);
      // Only the daemon marker exists/changes — no authored file touched.
      await backend.beginTxn({ snapshotRef: "abc", messageId: "only-marker", startedAt: 2 });

      const result = await backend.commitAll({ subject: "feat: nothing real", messageId: "only-marker" });

      expect(result.committed).toBe(false);
      expect(await git(dir, ["rev-parse", "HEAD"])).toBe(head);
    },
    GIT_TIMEOUT,
  );

  it(
    "commitAll() stages newly created AND deleted files (git add -A semantics)",
    async () => {
      await initRepo(dir, { "old.ts": "old\n" });
      // delete a tracked file, add a brand new one
      await rm(join(dir, "old.ts"));
      await writeFile(join(dir, "new.ts"), "new\n", "utf8");

      const result = await backend.commitAll({ subject: "feat: churn", messageId: "churn-1" });

      expect(result.committed).toBe(true);
      expect(await backend.existsAt("HEAD", "new.ts")).toBe(true);
      expect(await backend.existsAt("HEAD", "old.ts")).toBe(false);
    },
    GIT_TIMEOUT,
  );

  it(
    "restore(ref) hard-resets a tracked modification back to the snapshot content",
    async () => {
      const head = await initRepo(dir, { "src/App.tsx": "original\n" });
      // Make and commit a modification so HEAD moves away from the snapshot.
      await writeFile(join(dir, "src/App.tsx"), "mutated\n", "utf8");
      const committed = await backend.commitAll({ subject: "feat: mutate", messageId: "mut-1" });
      expect(committed.committed).toBe(true);
      expect(await git(dir, ["rev-parse", "HEAD"])).not.toBe(head);

      await backend.restore(head);

      expect(await git(dir, ["rev-parse", "HEAD"])).toBe(head);
      // Working tree content reverted.
      const content = await git(dir, ["show", "HEAD:src/App.tsx"]);
      expect(content).toBe("original");
    },
    GIT_TIMEOUT,
  );

  it(
    "restore(ref) discards uncommitted tracked modifications (working tree clean after)",
    async () => {
      const head = await initRepo(dir, { "keep.ts": "keep\n" });
      await writeFile(join(dir, "keep.ts"), "tampered\n", "utf8");

      await backend.restore(head);

      // Hard reset reverts tracked modifications; status clean for that file.
      const status = await git(dir, ["status", "--porcelain", "--", "keep.ts"]);
      expect(status).toBe("");
      expect(await git(dir, ["show", "HEAD:keep.ts"])).toBe("keep");
    },
    GIT_TIMEOUT,
  );

  it(
    "beginTxn/pendingTxn/endTxn round-trips the marker exactly",
    async () => {
      await initRepo(dir);
      expect(await backend.pendingTxn()).toBeNull();

      const marker = { snapshotRef: "a".repeat(40), messageId: "rt-1", startedAt: 1717000000000 };
      await backend.beginTxn(marker);

      const read = await backend.pendingTxn();
      expect(read).toEqual(marker);

      await backend.endTxn();
      expect(await backend.pendingTxn()).toBeNull();
    },
    GIT_TIMEOUT,
  );

  it(
    "endTxn() is idempotent — no throw when no marker is present",
    async () => {
      await initRepo(dir);
      await expect(backend.endTxn()).resolves.toBeUndefined();
      // Second call still fine.
      await expect(backend.endTxn()).resolves.toBeUndefined();
      expect(await backend.pendingTxn()).toBeNull();
    },
    GIT_TIMEOUT,
  );

  it(
    "beginTxn() overwrites a stale marker (later transaction wins)",
    async () => {
      await initRepo(dir);
      await backend.beginTxn({ snapshotRef: "old", messageId: "first", startedAt: 1 });
      await backend.beginTxn({ snapshotRef: "new", messageId: "second", startedAt: 2 });

      expect(await backend.pendingTxn()).toEqual({ snapshotRef: "new", messageId: "second", startedAt: 2 });
    },
    GIT_TIMEOUT,
  );

  it(
    "full transaction lifecycle: snapshot → beginTxn → commit → endTxn, then no pending marker",
    async () => {
      await initRepo(dir);
      const snap = await backend.snapshot();
      await backend.beginTxn({ snapshotRef: snap.ref, messageId: "life-1", startedAt: Date.now() });
      await writeFile(join(dir, "lifecycle.ts"), "export const z = 3;\n", "utf8");

      const commit = await backend.commitAll({ subject: "feat: write 1", messageId: "life-1" });
      expect(commit.committed).toBe(true);

      await backend.endTxn();
      expect(await backend.pendingTxn()).toBeNull();

      // .nihil/ was never committed, so it leaves no trace in git history.
      const tree = await git(dir, ["ls-tree", "-r", "--name-only", "HEAD"]);
      expect(tree).not.toContain(".nihil");
      expect(tree).toContain("lifecycle.ts");
    },
    GIT_TIMEOUT,
  );
});
