import type { ExecutionTarget } from "../../exec/target.js";
import type { ContextFile } from "./slots.js";

const CHARS_PER_TOKEN = 4;
// char/4 underestimates code by ~15%, so the effective cap sits below the 60K
// nominal ceiling to leave headroom (DECISIONS #24).
export const NOMINAL_CEILING_TOKENS = 60_000;
export const EFFECTIVE_CAP_TOKENS = 52_000;

export function estimateTokens(chars: number): number {
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

export interface SelectedContext {
  /** Full project tree (every file), for {{FILE_TREE}}. */
  fileTree: string[];
  /** Included file contents (src only, newest-first under budget). */
  contextFiles: ContextFile[];
  /** src files excluded by the budget. */
  excluded: string[];
  warning?: string;
}

/**
 * M1 context policy: all of src/, newest-modified first, under the effective
 * token cap. Files whose size alone overflows the remaining budget are skipped
 * without being read (statFiles gives size). A warning names what was dropped.
 */
export async function selectContext(
  target: ExecutionTarget,
  budgetTokens: number = EFFECTIVE_CAP_TOKENS,
): Promise<SelectedContext> {
  const fileTree = await target.listFiles();
  const stats = await target.statFiles("src");
  const ordered = [...stats].sort((a, b) => b.mtimeMs - a.mtimeMs);

  const contextFiles: ContextFile[] = [];
  const excluded: string[] = [];
  let usedTokens = 0;

  for (const stat of ordered) {
    if (usedTokens + estimateTokens(stat.size) > budgetTokens) {
      excluded.push(stat.path); // size-skip: never read an obviously-oversized file
      continue;
    }
    const content = await target.readFile(stat.path);
    const tokens = estimateTokens(content.length);
    if (usedTokens + tokens > budgetTokens) {
      excluded.push(stat.path);
      continue;
    }
    contextFiles.push({ path: stat.path, content });
    usedTokens += tokens;
  }

  const warning =
    excluded.length > 0
      ? `Context budget (~${budgetTokens} tokens) excluded ${excluded.length} file(s): ${formatExcluded(excluded)}`
      : undefined;

  return { fileTree, contextFiles, excluded, warning };
}

function formatExcluded(excluded: readonly string[]): string {
  const shown = excluded.slice(0, 5).join(", ");
  return excluded.length > 5 ? `${shown}, …` : shown;
}
