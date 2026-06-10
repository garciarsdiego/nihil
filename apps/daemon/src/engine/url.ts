/**
 * Build the chat-completions URL from a configurable base URL, auto-injecting
 * `/v1` only when the base path has no `/vN` segment (open-design pattern).
 * Handles: bare host → /v1/chat/completions; host ending /v1 → no double inject;
 * /v1 sub-paths (openrouter.ai/api/v1) → respected; non-versioned compat
 * sub-paths (/anthropic) → /anthropic/v1/chat/completions.
 */
export function buildChatCompletionsUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  const basePath = url.pathname.replace(/\/+$/, "");
  const hasVersion = /\/v\d+(\/|$)/.test(`${basePath}/`);
  const versioned = hasVersion ? basePath : `${basePath}/v1`;
  url.pathname = `${versioned}/chat/completions`;
  return url.toString();
}
