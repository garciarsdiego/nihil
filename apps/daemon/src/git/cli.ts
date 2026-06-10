import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** 32 MiB — large enough for `git log`/`status` on a generated app. */
const MAX_BUFFER = 32 * 1024 * 1024;

/**
 * Runs git with arguments passed as an array (never a shell string), so commit
 * subjects/paths with spaces or quotes — including this repo's "Diego Garcia"
 * path — cannot inject. Returns trimmed stdout; throws on non-zero exit.
 */
export async function git(cwd: string, args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args as string[], { cwd, maxBuffer: MAX_BUFFER });
  return stdout.trim();
}

/** Runs git and returns its exit code instead of throwing (for predicate-style
 * commands like `diff --quiet` / `cat-file -e`). Re-throws if git is missing. */
export async function gitExit(cwd: string, args: readonly string[]): Promise<number> {
  try {
    await execFileAsync("git", args as string[], { cwd, maxBuffer: MAX_BUFFER });
    return 0;
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "number") {
      return code;
    }
    throw error; // ENOENT (git not installed) or similar — a real infra failure
  }
}
