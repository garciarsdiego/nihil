import type { SearchReplaceBlock, ProtocolError } from "./types.js";

const SEARCH_MARKER = "<<<<<<< SEARCH";
const SEP_MARKER = "=======";
const REPLACE_MARKER = ">>>>>>> REPLACE";

export interface ParseBlocksResult {
  blocks: SearchReplaceBlock[];
  error?: string;
}

/**
 * Parse the body of a <nihil-edit> tag into SEARCH/REPLACE blocks.
 * Marker lines must start at column 0 and occupy the whole line
 * (trailing whitespace tolerated). Blank lines between blocks are allowed.
 */
export function parseEditBlocks(body: string): ParseBlocksResult {
  const lines = body.split("\n");
  const blocks: SearchReplaceBlock[] = [];
  type S = "outside" | "search" | "replace";
  let state: S = "outside";
  let search: string[] = [];
  let replace: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.replace(/\r$/, "").trimEnd();
    if (state === "outside") {
      if (t === SEARCH_MARKER) {
        state = "search";
        search = [];
        replace = [];
      } else if (t.trim() !== "") {
        return {
          blocks,
          error: `unexpected content outside SEARCH/REPLACE block at line ${i + 1}: ${t.slice(0, 80)}`,
        };
      }
    } else if (state === "search") {
      if (t === SEP_MARKER) state = "replace";
      else if (t === SEARCH_MARKER || t === REPLACE_MARKER) {
        return { blocks, error: `unexpected marker inside SEARCH section at line ${i + 1}` };
      } else search.push(line.replace(/\r$/, ""));
    } else {
      if (t === REPLACE_MARKER) {
        blocks.push({ search: search.join("\n"), replace: replace.join("\n") });
        state = "outside";
      } else if (t === SEARCH_MARKER || t === SEP_MARKER) {
        return { blocks, error: `unexpected marker inside REPLACE section at line ${i + 1}` };
      } else replace.push(line.replace(/\r$/, ""));
    }
  }
  if (state !== "outside") {
    return { blocks, error: "unterminated SEARCH/REPLACE block" };
  }
  if (blocks.length === 0) {
    return { blocks, error: "edit tag contains no SEARCH/REPLACE blocks" };
  }
  return { blocks };
}

export type ApplyMode = "exact" | "fuzzy-ws";

export interface ApplyResult {
  ok: boolean;
  content: string;
  applied: { index: number; mode: ApplyMode }[];
  error?: Pick<ProtocolError, "code" | "message"> & { blockIndex: number };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) {
    count++;
    i += needle.length;
  }
  return count;
}

/**
 * Whitespace-tolerant pattern for a SEARCH block: per line, leading/trailing
 * whitespace is flexible and internal whitespace runs match any run; lines
 * join across either LF or CRLF. Used only as the logged fuzzy fallback.
 */
function fuzzyPattern(search: string): RegExp {
  const lines = search.split("\n").map((l) => {
    const core = l.trim();
    const escaped = escapeRegExp(core).replace(/(\\\s|\s)+/g, "\\s+");
    return `[ \\t]*${core.length ? escaped : ""}[ \\t]*`;
  });
  return new RegExp(lines.join("\\r?\\n"), "g");
}

/**
 * Apply SEARCH/REPLACE blocks sequentially (block N sees block N-1's result).
 * Atomic: any failure returns the ORIGINAL content untouched.
 * Chain per block: exact-once → whitespace-fuzzy-once → error.
 */
export function applyEditBlocks(
  original: string,
  blocks: SearchReplaceBlock[],
): ApplyResult {
  let content = original;
  const applied: { index: number; mode: ApplyMode }[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const { search, replace } = blocks[i];
    const exact = countOccurrences(content, search);
    if (exact === 1) {
      content = content.replace(search, () => replace);
      applied.push({ index: i, mode: "exact" });
      continue;
    }
    if (exact > 1) {
      return {
        ok: false,
        content: original,
        applied,
        error: {
          code: "EDIT_AMBIGUOUS",
          blockIndex: i,
          message: `SEARCH block ${i + 1} matched ${exact} locations; add surrounding context lines to disambiguate`,
        },
      };
    }
    // Fuzzy fallback (whitespace / EOL tolerant)
    const re = fuzzyPattern(search);
    const matches = [...content.matchAll(re)].filter((m) => m[0].length > 0);
    if (matches.length === 1) {
      const m = matches[0];
      content =
        content.slice(0, m.index!) + replace + content.slice(m.index! + m[0].length);
      applied.push({ index: i, mode: "fuzzy-ws" });
      continue;
    }
    return {
      ok: false,
      content: original,
      applied,
      error: {
        code: matches.length > 1 ? "EDIT_AMBIGUOUS" : "EDIT_NO_MATCH",
        blockIndex: i,
        message:
          matches.length > 1
            ? `SEARCH block ${i + 1} fuzzy-matched ${matches.length} locations`
            : `SEARCH block ${i + 1} matched 0 locations`,
      },
    };
  }
  return { ok: true, content, applied };
}
