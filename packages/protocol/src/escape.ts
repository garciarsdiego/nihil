/** XML entity escaping for attribute values and <nihil-output> bodies. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Reverse of escapeXml. `&amp;` is resolved last so `&amp;lt;` → `&lt;`. */
export function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export interface PathResult {
  ok: boolean;
  path: string;
  reason?: string;
}

/**
 * Normalize a project-relative path: forward slashes, no leading `./`,
 * collapsed separators. Rejects absolute paths, drive letters, any `..`
 * segment, and NUL / C0 control characters (PATH_FORBIDDEN at the parser
 * boundary).
 */
export function normalizeProjectPath(raw: string): PathResult {
  let p = raw.trim().replace(/\\/g, "/");
  if (p.length === 0) return { ok: false, path: raw, reason: "empty path" };
  // NUL and other C0 control characters (U+0000–U+001F) are never valid in a
  // path and are a classic truncation/injection vector. Surrounding whitespace
  // has already been trimmed, so any remaining control char is embedded.
  if (/[\u0000-\u001F]/.test(p)) {
    return { ok: false, path: raw, reason: "control characters are forbidden" };
  }
  if (/^[a-zA-Z]:/.test(p) || p.startsWith("/")) {
    return { ok: false, path: raw, reason: "absolute paths are forbidden" };
  }
  p = p.replace(/\/{2,}/g, "/");
  while (p.startsWith("./")) p = p.slice(2);
  const segments = p.split("/");
  if (segments.some((s) => s === "..")) {
    return { ok: false, path: raw, reason: "path traversal is forbidden" };
  }
  if (segments.some((s) => s === "" )) {
    return { ok: false, path: raw, reason: "empty path segment" };
  }
  return { ok: true, path: segments.filter((s) => s !== ".").join("/") };
}
