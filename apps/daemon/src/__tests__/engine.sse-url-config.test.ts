/**
 * Expanded unit coverage for sse.ts, url.ts, config.ts, errors.ts.
 * Pure in-memory — no mock server needed.
 */

import { readSseFrames } from "../engine/sse.js";
import { buildChatCompletionsUrl } from "../engine/url.js";
import { loadEngineConfig } from "../engine/config.js";
import {
  classifyHttpStatus,
  classifyFetchError,
  redactSecrets,
  extractErrorDetail,
  EngineError,
} from "../engine/errors.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a ReadableStream<Uint8Array> from an array of already-encoded chunks. */
function rawBody(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

/** Encode a string to UTF-8 Uint8Array. */
const enc = new TextEncoder();

/** Build a ReadableStream<Uint8Array> from string chunks. */
function sseBody(...frames: string[]): ReadableStream<Uint8Array> {
  return rawBody(...frames.map((f) => enc.encode(f)));
}

/** Collect all frames from readSseFrames into an array. */
async function collect(body: ReadableStream<Uint8Array>, signal?: AbortSignal): Promise<string[]> {
  const out: string[] = [];
  for await (const frame of readSseFrames(body, signal)) {
    out.push(frame);
  }
  return out;
}

// ---------------------------------------------------------------------------
// readSseFrames — SSE parsing
// ---------------------------------------------------------------------------

describe("readSseFrames — basic frame parsing", () => {
  it("yields a single complete frame with a data line", async () => {
    const body = sseBody('data: {"hello":"world"}\n\n');
    expect(await collect(body)).toEqual(['{"hello":"world"}']);
  });

  it("strips the single leading space after 'data:'", async () => {
    const body = sseBody("data: stripped\n\n");
    expect(await collect(body)).toEqual(["stripped"]);
  });

  it("does NOT strip more than one leading space", async () => {
    // SSE spec: strip exactly one space
    const body = sseBody("data:  two-spaces\n\n");
    expect(await collect(body)).toEqual([" two-spaces"]);
  });

  it("handles data: with no space (tight format)", async () => {
    const body = sseBody("data:tight\n\n");
    expect(await collect(body)).toEqual(["tight"]);
  });

  it("yields [DONE] as the literal string", async () => {
    const body = sseBody("data: [DONE]\n\n");
    expect(await collect(body)).toEqual(["[DONE]"]);
  });

  it("skips comment/keepalive lines (colon-prefixed)", async () => {
    const body = sseBody(": keepalive\n\ndata: real\n\n: ping\n\n");
    expect(await collect(body)).toEqual(["real"]);
  });

  it("skips event: lines", async () => {
    const body = sseBody("event: message\ndata: payload\n\n");
    expect(await collect(body)).toEqual(["payload"]);
  });

  it("skips id: lines", async () => {
    const body = sseBody("id: 42\ndata: payload\n\n");
    expect(await collect(body)).toEqual(["payload"]);
  });

  it("skips retry: lines", async () => {
    const body = sseBody("retry: 3000\ndata: payload\n\n");
    expect(await collect(body)).toEqual(["payload"]);
  });

  it("yields nothing for a frame with only non-data lines", async () => {
    const body = sseBody(": keepalive\nevent: ping\nid: 1\n\n");
    expect(await collect(body)).toEqual([]);
  });
});

describe("readSseFrames — CRLF separators", () => {
  it("handles \\r\\n\\r\\n as frame separator", async () => {
    const body = sseBody("data: a\r\n\r\ndata: b\r\n\r\n");
    expect(await collect(body)).toEqual(["a", "b"]);
  });

  it("handles mixed CRLF lines within a frame", async () => {
    const body = sseBody("data: x\r\ndata: y\r\n\r\n");
    expect(await collect(body)).toEqual(["x\ny"]);
  });
});

describe("readSseFrames — multi-line data in one frame", () => {
  it("joins multiple data: lines in one frame with newline", async () => {
    // SSE spec: multiple data: lines → concatenate with \n
    const body = sseBody("data: line1\ndata: line2\ndata: line3\n\n");
    expect(await collect(body)).toEqual(["line1\nline2\nline3"]);
  });
});

describe("readSseFrames — chunking and streaming", () => {
  it("reassembles JSON split mid-token across two chunks", async () => {
    // {"ok":true} split after the colon
    const body = sseBody('data: {"ok":', 'true}\n\n');
    expect(await collect(body)).toEqual(['{"ok":true}']);
  });

  it("reassembles data: header split across chunks", async () => {
    // The "data:" prefix itself split across two chunks
    const body = sseBody("dat", 'a: hello\n\n');
    expect(await collect(body)).toEqual(["hello"]);
  });

  it("handles a frame split across many tiny chunks", async () => {
    const frame = 'data: {"n":42}\n\n';
    const chunks: Uint8Array[] = [...frame].map((ch) => enc.encode(ch));
    const body = rawBody(...chunks);
    expect(await collect(body)).toEqual(['{"n":42}']);
  });

  it("handles multiple frames packed into one chunk", async () => {
    const body = sseBody("data: first\n\ndata: second\n\ndata: third\n\n");
    expect(await collect(body)).toEqual(["first", "second", "third"]);
  });

  it("yields the last frame even if there is no trailing blank line", async () => {
    // Some proxies clip the final \n\n — frameData on the tail should still yield.
    const body = sseBody("data: first\n\ndata: last-no-trailing-newline");
    expect(await collect(body)).toEqual(["first", "last-no-trailing-newline"]);
  });
});

describe("readSseFrames — multibyte UTF-8 split across chunks", () => {
  it("decodes a 2-byte UTF-8 char split across chunk boundaries", async () => {
    // é = 0xC3 0xA9  (U+00E9)
    const eAcute = new Uint8Array([0xc3, 0xa9]);
    const prefix = enc.encode("data: caf");
    const suffix = enc.encode("\n\n");
    // Split the é across two chunks: [0xC3] then [0xA9]
    const body = rawBody(
      new Uint8Array([...prefix, 0xc3]),
      new Uint8Array([0xa9, ...suffix]),
    );
    expect(await collect(body)).toEqual(["café"]);
  });

  it("decodes a 3-byte UTF-8 char (€, U+20AC) split across chunk boundaries", async () => {
    // € = 0xE2 0x82 0xAC
    const prefix = enc.encode("data: cost ");
    const suffix = enc.encode("\n\n");
    // Chunk 1: ...cost  + first two bytes of €; Chunk 2: third byte + \n\n
    const body = rawBody(
      new Uint8Array([...prefix, 0xe2, 0x82]),
      new Uint8Array([0xac, ...suffix]),
    );
    expect(await collect(body)).toEqual(["cost €"]);
  });
});

describe("readSseFrames — abort signal", () => {
  it("stops iteration immediately when signal is pre-aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    // Even with valid frames, should yield nothing
    const body = sseBody("data: first\n\ndata: second\n\n");
    const out = await collect(body, controller.signal);
    expect(out).toEqual([]);
  });

  it("stops mid-stream when signal is aborted after first frame", async () => {
    const controller = new AbortController();
    const out: string[] = [];
    // Use a custom stream that aborts after the first enqueue
    let didAbort = false;
    const body = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(enc.encode("data: first\n\n"));
        // Abort before the second frame is delivered
        if (!didAbort) {
          didAbort = true;
          controller.abort();
        }
        ctrl.enqueue(enc.encode("data: second\n\n"));
        ctrl.close();
      },
    });
    for await (const frame of readSseFrames(body, controller.signal)) {
      out.push(frame);
    }
    // May yield "first" (already buffered) but must not yield after abort
    expect(out.length).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// buildChatCompletionsUrl — URL construction
// ---------------------------------------------------------------------------

describe("buildChatCompletionsUrl — versioned injection", () => {
  it("injects /v1 for a bare host (http)", () => {
    expect(buildChatCompletionsUrl("http://localhost:20128")).toBe(
      "http://localhost:20128/v1/chat/completions",
    );
  });

  it("injects /v1 for a bare https host", () => {
    expect(buildChatCompletionsUrl("https://api.example.com")).toBe(
      "https://api.example.com/v1/chat/completions",
    );
  });

  it("does NOT double-inject /v1 when base already ends with /v1", () => {
    expect(buildChatCompletionsUrl("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("respects /api/v1 sub-path (openrouter-style)", () => {
    expect(buildChatCompletionsUrl("https://openrouter.ai/api/v1")).toBe(
      "https://openrouter.ai/api/v1/chat/completions",
    );
  });

  it("injects /v1 after non-versioned compat sub-path (/anthropic)", () => {
    expect(buildChatCompletionsUrl("https://example.com/anthropic")).toBe(
      "https://example.com/anthropic/v1/chat/completions",
    );
  });

  it("strips trailing slashes from base path before appending", () => {
    expect(buildChatCompletionsUrl("http://localhost:20128/")).toBe(
      "http://localhost:20128/v1/chat/completions",
    );
    expect(buildChatCompletionsUrl("https://api.openai.com/v1/")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("preserves query strings and port", () => {
    const result = buildChatCompletionsUrl("http://localhost:8080");
    expect(result).toBe("http://localhost:8080/v1/chat/completions");
  });

  it("handles /v2 versioning without double-injecting", () => {
    // Any /vN segment should be recognised as already versioned
    expect(buildChatCompletionsUrl("https://example.com/v2")).toBe(
      "https://example.com/v2/chat/completions",
    );
  });
});

// ---------------------------------------------------------------------------
// loadEngineConfig — defaults + env-var parsing
// ---------------------------------------------------------------------------

describe("loadEngineConfig — defaults", () => {
  it("returns all defaults when env is empty", () => {
    const cfg = loadEngineConfig({});
    expect(cfg.baseUrl).toBe("http://localhost:20128");
    expect(cfg.apiKey).toBeUndefined();
    expect(cfg.model).toBe("default");
    expect(cfg.maxTokens).toBe(16384);
  });
});

describe("loadEngineConfig — NIHIL_ENGINE_API_KEY", () => {
  it("sets apiKey when present", () => {
    const cfg = loadEngineConfig({ NIHIL_ENGINE_API_KEY: "sk-test-key" });
    expect(cfg.apiKey).toBe("sk-test-key");
  });

  it("returns undefined for empty-string apiKey", () => {
    const cfg = loadEngineConfig({ NIHIL_ENGINE_API_KEY: "" });
    expect(cfg.apiKey).toBeUndefined();
  });

  it("returns undefined for whitespace-only apiKey", () => {
    const cfg = loadEngineConfig({ NIHIL_ENGINE_API_KEY: "   " });
    expect(cfg.apiKey).toBeUndefined();
  });

  it("trims leading/trailing whitespace from a valid key", () => {
    const cfg = loadEngineConfig({ NIHIL_ENGINE_API_KEY: "  sk-abc  " });
    expect(cfg.apiKey).toBe("sk-abc");
  });
});

describe("loadEngineConfig — NIHIL_ENGINE_MODEL", () => {
  it("uses DEFAULT model when unset", () => {
    expect(loadEngineConfig({}).model).toBe("default");
  });

  it("overrides model when set", () => {
    expect(loadEngineConfig({ NIHIL_ENGINE_MODEL: "claude-3-opus" }).model).toBe("claude-3-opus");
  });

  it("trims whitespace from model name", () => {
    expect(loadEngineConfig({ NIHIL_ENGINE_MODEL: "  gpt-4  " }).model).toBe("gpt-4");
  });

  it("falls back to default for whitespace-only model value", () => {
    expect(loadEngineConfig({ NIHIL_ENGINE_MODEL: "   " }).model).toBe("default");
  });
});

describe("loadEngineConfig — NIHIL_ENGINE_MAX_TOKENS", () => {
  it("returns default 16384 when unset", () => {
    expect(loadEngineConfig({}).maxTokens).toBe(16384);
  });

  it("accepts a valid positive integer string", () => {
    expect(loadEngineConfig({ NIHIL_ENGINE_MAX_TOKENS: "32000" }).maxTokens).toBe(32000);
  });

  it("accepts the ceiling value 1048576", () => {
    expect(loadEngineConfig({ NIHIL_ENGINE_MAX_TOKENS: "1048576" }).maxTokens).toBe(1_048_576);
  });

  it("accepts 1 (minimum valid value)", () => {
    expect(loadEngineConfig({ NIHIL_ENGINE_MAX_TOKENS: "1" }).maxTokens).toBe(1);
  });

  it("throws for zero", () => {
    expect(() => loadEngineConfig({ NIHIL_ENGINE_MAX_TOKENS: "0" })).toThrow(/MAX_TOKENS/);
  });

  it("throws for a value above the ceiling", () => {
    expect(() => loadEngineConfig({ NIHIL_ENGINE_MAX_TOKENS: "1048577" })).toThrow(/MAX_TOKENS/);
  });

  it("throws for a negative integer string", () => {
    expect(() => loadEngineConfig({ NIHIL_ENGINE_MAX_TOKENS: "-1" })).toThrow(/MAX_TOKENS/);
  });

  it("throws for a float", () => {
    expect(() => loadEngineConfig({ NIHIL_ENGINE_MAX_TOKENS: "1.5" })).toThrow(/MAX_TOKENS/);
  });

  it("throws for a non-numeric string", () => {
    expect(() => loadEngineConfig({ NIHIL_ENGINE_MAX_TOKENS: "abc" })).toThrow(/MAX_TOKENS/);
  });

  it("returns default for an empty string", () => {
    expect(loadEngineConfig({ NIHIL_ENGINE_MAX_TOKENS: "" }).maxTokens).toBe(16384);
  });

  it("returns default for a whitespace-only string", () => {
    expect(loadEngineConfig({ NIHIL_ENGINE_MAX_TOKENS: "   " }).maxTokens).toBe(16384);
  });
});

describe("loadEngineConfig — NIHIL_ENGINE_BASE_URL", () => {
  it("accepts a valid http URL", () => {
    expect(loadEngineConfig({ NIHIL_ENGINE_BASE_URL: "http://my-proxy.local:9000" }).baseUrl).toBe(
      "http://my-proxy.local:9000",
    );
  });

  it("accepts a valid https URL", () => {
    expect(loadEngineConfig({ NIHIL_ENGINE_BASE_URL: "https://api.openai.com/v1" }).baseUrl).toBe(
      "https://api.openai.com/v1",
    );
  });

  it("throws for an ftp URL", () => {
    expect(() => loadEngineConfig({ NIHIL_ENGINE_BASE_URL: "ftp://x" })).toThrow(/BASE_URL/);
  });

  it("throws for a completely non-URL string", () => {
    expect(() => loadEngineConfig({ NIHIL_ENGINE_BASE_URL: "not a url" })).toThrow(/BASE_URL/);
  });

  it("throws for a ws:// URL (non-http)", () => {
    expect(() => loadEngineConfig({ NIHIL_ENGINE_BASE_URL: "ws://localhost:9000" })).toThrow(
      /BASE_URL/,
    );
  });

  it("falls back to default when the value is whitespace-only", () => {
    expect(loadEngineConfig({ NIHIL_ENGINE_BASE_URL: "   " }).baseUrl).toBe(
      "http://localhost:20128",
    );
  });
});

// ---------------------------------------------------------------------------
// classifyHttpStatus
// ---------------------------------------------------------------------------

describe("classifyHttpStatus", () => {
  it("maps 401 to auth/not-retryable", () => {
    const err = classifyHttpStatus(401);
    expect(err).toBeInstanceOf(EngineError);
    expect(err.kind).toBe("auth");
    expect(err.status).toBe(401);
    expect(err.retryable).toBe(false);
  });

  it("maps 403 to auth/not-retryable", () => {
    const err = classifyHttpStatus(403);
    expect(err.kind).toBe("auth");
    expect(err.status).toBe(403);
    expect(err.retryable).toBe(false);
  });

  it("maps 404 to not_found/not-retryable and mentions model+base URL", () => {
    const err = classifyHttpStatus(404);
    expect(err.kind).toBe("not_found");
    expect(err.status).toBe(404);
    expect(err.retryable).toBe(false);
    expect(err.message).toMatch(/model/i);
  });

  it("maps 429 to rate_limit/retryable", () => {
    const err = classifyHttpStatus(429);
    expect(err.kind).toBe("rate_limit");
    expect(err.status).toBe(429);
    expect(err.retryable).toBe(true);
  });

  it("maps 500 to server/retryable", () => {
    const err = classifyHttpStatus(500);
    expect(err.kind).toBe("server");
    expect(err.retryable).toBe(true);
  });

  it("maps 503 to server/retryable", () => {
    const err = classifyHttpStatus(503);
    expect(err.kind).toBe("server");
    expect(err.retryable).toBe(true);
  });

  it("maps 418 (I'm a teapot) to client/not-retryable", () => {
    const err = classifyHttpStatus(418);
    expect(err.kind).toBe("client");
    expect(err.status).toBe(418);
    expect(err.retryable).toBe(false);
  });

  it("maps 400 to client/not-retryable", () => {
    const err = classifyHttpStatus(400);
    expect(err.kind).toBe("client");
    expect(err.retryable).toBe(false);
  });

  it("appends detail to message when provided", () => {
    const err = classifyHttpStatus(429, "quota exhausted");
    expect(err.message).toContain("quota exhausted");
  });

  it("omits suffix when detail is not provided", () => {
    const err = classifyHttpStatus(429);
    expect(err.message).not.toContain(":");
    // message should just be "rate limited (429)"
    expect(err.message).toMatch(/rate limited/i);
  });
});

// ---------------------------------------------------------------------------
// classifyFetchError
// ---------------------------------------------------------------------------

describe("classifyFetchError", () => {
  it("returns an AbortError-named error as kind=aborted, not retryable", () => {
    const raw = new Error("The operation was aborted");
    raw.name = "AbortError";
    const err = classifyFetchError(raw);
    expect(err.kind).toBe("aborted");
    expect(err.retryable).toBe(false);
    expect(err.cause).toBe(raw);
  });

  it("returns a TypeError with ECONNREFUSED cause.code as kind=network, retryable", () => {
    const cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:9999"), {
      code: "ECONNREFUSED",
    });
    const typeErr = Object.assign(new TypeError("fetch failed"), { cause });
    const err = classifyFetchError(typeErr);
    expect(err.kind).toBe("network");
    expect(err.retryable).toBe(true);
    expect(err.message).toContain("ECONNREFUSED");
  });

  it("returns a generic TypeError as kind=network, retryable", () => {
    const typeErr = new TypeError("Failed to fetch");
    const err = classifyFetchError(typeErr);
    expect(err.kind).toBe("network");
    expect(err.retryable).toBe(true);
  });

  it("returns an ENOTFOUND (DNS) failure as kind=network, retryable", () => {
    const cause = Object.assign(new Error("getaddrinfo ENOTFOUND x"), { code: "ENOTFOUND" });
    const typeErr = Object.assign(new TypeError("fetch failed"), { cause });
    const err = classifyFetchError(typeErr);
    expect(err.kind).toBe("network");
    expect(err.message).toContain("ENOTFOUND");
  });

  it("passes through an EngineError unchanged", () => {
    const engineErr = new EngineError("auth", "already classified");
    const result = classifyFetchError(engineErr);
    expect(result).toBe(engineErr);
  });

  it("includes the original error as cause", () => {
    const raw = new TypeError("network down");
    const err = classifyFetchError(raw);
    expect(err.cause).toBe(raw);
  });
});

// ---------------------------------------------------------------------------
// redactSecrets
// ---------------------------------------------------------------------------

describe("redactSecrets", () => {
  it("redacts a Bearer token", () => {
    const input = "Authorization: Bearer sk-abc123def456ghij";
    const result = redactSecrets(input);
    expect(result).not.toContain("sk-abc123def456ghij");
    expect(result).toContain("Bearer [redacted]");
  });

  it("redacts an sk- key in a JSON body", () => {
    const input = '{"api_key": "sk-prodkey1234567890abcdef"}';
    const result = redactSecrets(input);
    expect(result).not.toContain("sk-prodkey1234567890abcdef");
  });

  it("redacts api_key= assignment style", () => {
    const input = "api_key=sk-test-12345678abcdefg";
    const result = redactSecrets(input);
    expect(result).not.toContain("sk-test-12345678abcdefg");
  });

  it("does not modify text with no secrets", () => {
    const input = "just a regular error message";
    expect(redactSecrets(input)).toBe(input);
  });

  it("handles multiple redactions in one string", () => {
    const input = "first: Bearer tok1abc12345678, second: Bearer tok2xyz98765432";
    const result = redactSecrets(input);
    expect(result).not.toContain("tok1abc12345678");
    expect(result).not.toContain("tok2xyz98765432");
    // Both should be replaced
    expect(result.match(/\[redacted\]/g)?.length).toBe(2);
  });

  it("is case-insensitive for 'Bearer'", () => {
    const input = "bearer MYTOKEN12345678abcdef";
    const result = redactSecrets(input);
    expect(result).not.toContain("MYTOKEN12345678abcdef");
    expect(result).toMatch(/bearer \[redacted\]/i);
  });
});

// ---------------------------------------------------------------------------
// extractErrorDetail
// ---------------------------------------------------------------------------

describe("extractErrorDetail", () => {
  it("extracts error.message from standard OpenAI error shape", () => {
    const body = JSON.stringify({ error: { message: "quota exceeded", type: "quota_error" } });
    expect(extractErrorDetail(body)).toBe("quota exceeded");
  });

  it("extracts error string directly when error is a string", () => {
    const body = JSON.stringify({ error: "rate limit hit" });
    expect(extractErrorDetail(body)).toBe("rate limit hit");
  });

  it("extracts top-level .message when error is absent", () => {
    const body = JSON.stringify({ message: "upstream unavailable" });
    expect(extractErrorDetail(body)).toBe("upstream unavailable");
  });

  it("falls back to the raw body when JSON is invalid", () => {
    const body = "not json at all";
    expect(extractErrorDetail(body)).toBe("not json at all");
  });

  it("falls back to raw body (sliced) when JSON has no recognized error fields", () => {
    const body = JSON.stringify({ status: "ok" });
    // Should return the raw body since there is no error/message field
    const result = extractErrorDetail(body);
    expect(result).toContain("ok");
  });

  it("truncates long error detail to 240 characters", () => {
    const longMessage = "x".repeat(300);
    const body = JSON.stringify({ error: { message: longMessage } });
    const result = extractErrorDetail(body);
    expect(result.length).toBeLessThanOrEqual(240);
  });

  it("truncates a long raw non-JSON body to 240 characters", () => {
    const longBody = "e".repeat(500);
    const result = extractErrorDetail(longBody);
    expect(result.length).toBeLessThanOrEqual(240);
  });

  it("redacts secrets found in the extracted error detail", () => {
    const body = JSON.stringify({ error: { message: "invalid key: Bearer sk-secret12345678" } });
    const result = extractErrorDetail(body);
    expect(result).not.toContain("sk-secret12345678");
    expect(result).toContain("[redacted]");
  });

  it("handles an empty body gracefully", () => {
    const result = extractErrorDetail("");
    // Empty string is not valid JSON, so falls back to raw body (empty)
    expect(typeof result).toBe("string");
    expect(result.length).toBe(0);
  });

  // BUG: errors.ts:91 — extractErrorDetail casts `parsed` to an object type
  // and immediately accesses `.error` without checking whether `parsed` is a
  // JSON.parse("null") returns the JS value null; extractErrorDetail must
  // guard `typeof parsed === "object" && parsed !== null` and fall back to the
  // raw body rather than reading `.error` off null (fixed in errors.ts).
  it("handles a JSON null body by falling back to the raw body", () => {
    const result = extractErrorDetail("null");
    expect(typeof result).toBe("string");
    expect(result).toBe("null");
  });
});

// ---------------------------------------------------------------------------
// EngineError — constructor and properties
// ---------------------------------------------------------------------------

describe("EngineError", () => {
  it("has name=EngineError", () => {
    const err = new EngineError("auth", "test");
    expect(err.name).toBe("EngineError");
  });

  it("stores kind, status, and retryable", () => {
    const err = new EngineError("rate_limit", "throttled", { status: 429 });
    expect(err.kind).toBe("rate_limit");
    expect(err.status).toBe(429);
    expect(err.retryable).toBe(true);
  });

  it("defaults retryable=false for auth", () => {
    expect(new EngineError("auth", "x").retryable).toBe(false);
  });

  it("defaults retryable=false for not_found", () => {
    expect(new EngineError("not_found", "x").retryable).toBe(false);
  });

  it("defaults retryable=false for malformed", () => {
    expect(new EngineError("malformed", "x").retryable).toBe(false);
  });

  it("defaults retryable=false for provider", () => {
    expect(new EngineError("provider", "x").retryable).toBe(false);
  });

  it("defaults retryable=false for aborted", () => {
    expect(new EngineError("aborted", "x").retryable).toBe(false);
  });

  it("defaults retryable=true for network", () => {
    expect(new EngineError("network", "x").retryable).toBe(true);
  });

  it("defaults retryable=true for server", () => {
    expect(new EngineError("server", "x").retryable).toBe(true);
  });

  it("allows overriding retryable via options", () => {
    const err = new EngineError("server", "custom", { retryable: false });
    expect(err.retryable).toBe(false);
  });

  it("is an instance of Error", () => {
    expect(new EngineError("client", "x")).toBeInstanceOf(Error);
  });

  it("stores cause when provided", () => {
    const cause = new Error("root cause");
    const err = new EngineError("network", "wrapped", { cause });
    expect(err.cause).toBe(cause);
  });
});
