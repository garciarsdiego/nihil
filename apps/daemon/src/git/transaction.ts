import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SnapshotRef } from "../exec/target.js";
import { git, gitExit } from "./cli.js";

export interface CommitOptions {
  subject: string;
  body?: string;
  messageId: string;
}

export interface CommitResult {
  committed: boolean;
  ref?: string;
}

export interface TxnMarker {
  snapshotRef: string;
  messageId: string;
  startedAt: number;
}

/**
 * The daemon git layer the runner consumes (DECISIONS #13, #20). Path-sharing
 * targets use SystemGitBackend against projectDir; M4 cloud targets will supply
 * their own backend with a target-side restore(ref).
 */
export interface GitBackend {
  snapshot(): Promise<SnapshotRef>;
  /** True when `path` existed in the commit `ref` (used for created-path tracking). */
  existsAt(ref: string, path: string): Promise<boolean>;
  /** Stage everything (except .nihil/) and commit with the Nihil-Message-Id trailer. */
  commitAll(opts: CommitOptions): Promise<CommitResult>;
  /** Hard reset tracked files to `ref`. Untracked files created this message are
   * removed by the runner via the target (path funnel), not here. */
  restore(ref: string): Promise<void>;
  beginTxn(marker: TxnMarker): Promise<void>;
  endTxn(): Promise<void>;
  /** A marker left by a transaction that never finished (crash recovery, DECISIONS #17). */
  pendingTxn(): Promise<TxnMarker | null>;
}

const MARKER_DIR = ".nihil";
const MARKER_FILE = "txn.json";

// messageId reaches `git commit --trailer` and the marker file. git parses
// trailer VALUES for embedded newlines, so a CR/LF could plant forged trailers
// (e.g. a second Nihil-Message-Id) and corrupt the version↔chat linkage. Lock
// it to an opaque-id charset at the git boundary regardless of caller.
const SAFE_MESSAGE_ID = /^[A-Za-z0-9_.-]+$/;

function assertSafeMessageId(messageId: string): void {
  if (!SAFE_MESSAGE_ID.test(messageId)) {
    throw new Error(
      `unsafe messageId ${JSON.stringify(messageId)}: expected only [A-Za-z0-9_.-]`,
    );
  }
}

function isValidMarker(value: unknown): value is TxnMarker {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const m = value as Record<string, unknown>;
  return (
    typeof m.snapshotRef === "string" &&
    typeof m.messageId === "string" &&
    typeof m.startedAt === "number"
  );
}

export class SystemGitBackend implements GitBackend {
  readonly #dir: string;

  constructor(projectDir: string) {
    this.#dir = projectDir;
  }

  async snapshot(): Promise<SnapshotRef> {
    return { kind: "git", ref: await git(this.#dir, ["rev-parse", "HEAD"]) };
  }

  async existsAt(ref: string, path: string): Promise<boolean> {
    return (await gitExit(this.#dir, ["cat-file", "-e", `${ref}:${path}`])) === 0;
  }

  async commitAll(opts: CommitOptions): Promise<CommitResult> {
    assertSafeMessageId(opts.messageId);
    // Stage everything, then unstage the daemon's own .nihil/ metadata. We add
    // and then reset rather than `add ... :(exclude).nihil`, because naming
    // .nihil in an exclude pathspec makes `git add` fail with "paths are
    // ignored" once the project's .gitignore lists .nihil/ (which every real
    // template does, and the transaction marker lives there during the commit).
    // `add -A .` skips a gitignored .nihil silently; the reset is then a no-op,
    // and it still unstages the marker for projects that do NOT gitignore it.
    await git(this.#dir, ["add", "-A", "--", "."]);
    await git(this.#dir, ["reset", "-q", "--", ".nihil"]);
    const dirty = (await gitExit(this.#dir, ["diff", "--cached", "--quiet"])) !== 0;
    if (!dirty) {
      return { committed: false };
    }
    const args = [
      "-c",
      "user.name=Nihil",
      "-c",
      "user.email=daemon@nihil.invalid",
      "commit",
      "-m",
      opts.subject,
    ];
    if (opts.body !== undefined && opts.body !== "") {
      args.push("-m", opts.body);
    }
    args.push("--trailer", `Nihil-Message-Id:${opts.messageId}`);
    await git(this.#dir, args);
    return { committed: true, ref: await git(this.#dir, ["rev-parse", "HEAD"]) };
  }

  async restore(ref: string): Promise<void> {
    await git(this.#dir, ["reset", "--hard", ref]);
  }

  async beginTxn(marker: TxnMarker): Promise<void> {
    assertSafeMessageId(marker.messageId);
    await mkdir(join(this.#dir, MARKER_DIR), { recursive: true });
    await writeFile(this.#markerPath(), JSON.stringify(marker), "utf8");
  }

  async endTxn(): Promise<void> {
    await rm(this.#markerPath(), { force: true });
  }

  async pendingTxn(): Promise<TxnMarker | null> {
    let raw: string;
    try {
      raw = await readFile(this.#markerPath(), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
    // A model write to .nihil/txn.json could forge this; reject anything that
    // is not a well-formed marker rather than trusting it in crash recovery.
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    return isValidMarker(parsed) ? parsed : null;
  }

  #markerPath(): string {
    return join(this.#dir, MARKER_DIR, MARKER_FILE);
  }
}
