import { spawn, type ChildProcess } from "node:child_process";
import treeKill from "tree-kill";
import type { ProcessExit } from "./target.js";

export interface SpawnedProcess {
  child: ChildProcess;
  command: string;
  /** Resolves on 'close'; also resolves (code/signal null) on spawn 'error'. */
  exited: Promise<ProcessExit>;
  /** Rejected spawn ('error' event before/at spawn): ENOENT, EACCES, … */
  spawnError: Promise<Error | null>;
}

export function spawnProcess(
  command: string,
  options: { cwd: string; env?: NodeJS.ProcessEnv },
): SpawnedProcess {
  // shell:true so workflow commands are real shell lines; detached:false +
  // tree-kill handles the cmd.exe/sh intermediary (dyad-proven combination).
  const child = spawn(command, {
    cwd: options.cwd,
    shell: true,
    stdio: "pipe",
    detached: false,
    env: { ...process.env, ...options.env },
  });

  let settled = false;
  let resolveExit!: (exit: ProcessExit) => void;
  let resolveSpawnError!: (error: Error | null) => void;
  const exited = new Promise<ProcessExit>((resolve) => {
    resolveExit = resolve;
  });
  const spawnError = new Promise<Error | null>((resolve) => {
    resolveSpawnError = resolve;
  });

  child.once("spawn", () => resolveSpawnError(null));
  child.once("error", (error) => {
    resolveSpawnError(error);
    if (!settled) {
      settled = true;
      resolveExit({ code: null, signal: null });
    }
  });
  child.once("close", (code, signal) => {
    if (!settled) {
      settled = true;
      resolveExit({ code, signal });
    }
  });

  return { child, command, exited, spawnError };
}

const DEFAULT_GRACE_MS = 5000;

/**
 * Kills the full process tree. win32: taskkill /PID /T /F (no TERM semantics
 * there); POSIX: SIGTERM down the ps tree, SIGKILL after the grace period.
 * Idempotent: an already-exited tree (including the taskkill exit-128
 * not-found race) resolves as success. Returns false only when the tree is
 * confirmably still alive after the KILL escalation — callers should log it.
 */
export async function killTree(child: ChildProcess, graceMs = DEFAULT_GRACE_MS): Promise<boolean> {
  const pid = child.pid;
  if (pid === undefined || hasExited(child)) {
    return true;
  }

  const closed = new Promise<void>((resolve) => {
    if (hasExited(child)) {
      resolve();
      return;
    }
    child.once("close", () => resolve());
  });

  await signalTree(pid, "SIGTERM");
  if (await settledWithin(closed, graceMs)) {
    return true;
  }
  await signalTree(pid, "SIGKILL");
  return settledWithin(closed, graceMs);
}

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

function signalTree(pid: number, signal: NodeJS.Signals): Promise<void> {
  return new Promise((resolve) => {
    treeKill(pid, signal, () => {
      // tree-kill errors (taskkill exit 128, ESRCH) usually mean the tree died
      // in the race window between our liveness check and the kill. Genuine
      // failures are caught by the caller: the grace wait times out, KILL is
      // escalated, and a still-alive tree surfaces as killTree() === false.
      resolve();
    });
  });
}

function settledWithin(promise: Promise<void>, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    timer.unref();
    void promise.then(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}
