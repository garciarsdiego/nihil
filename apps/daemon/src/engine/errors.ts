export type EngineErrorKind =
  | "auth" // 401/403 — terminal
  | "not_found" // 404 — terminal (bad model or base URL)
  | "rate_limit" // 429 — retryable
  | "server" // 5xx — retryable
  | "client" // other 4xx — terminal
  | "network" // DNS/TLS/connect/timeout — retryable
  | "malformed" // unparseable SSE/JSON — terminal
  | "provider" // inline error object in the stream — terminal
  | "aborted"; // user abort — not surfaced as an error

interface EngineErrorOptions {
  status?: number;
  retryable?: boolean;
  cause?: unknown;
}

function defaultRetryable(kind: EngineErrorKind): boolean {
  return kind === "rate_limit" || kind === "server" || kind === "network";
}

export class EngineError extends Error {
  readonly kind: EngineErrorKind;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(kind: EngineErrorKind, message: string, opts: EngineErrorOptions = {}) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "EngineError";
    this.kind = kind;
    this.status = opts.status;
    this.retryable = opts.retryable ?? defaultRetryable(kind);
  }
}

/** Map an HTTP status to a terminal/retryable EngineError. */
export function classifyHttpStatus(status: number, detail?: string): EngineError {
  const suffix = detail ? `: ${detail}` : "";
  if (status === 401 || status === 403) {
    return new EngineError("auth", `authentication failed (${status})${suffix}`, { status });
  }
  if (status === 404) {
    return new EngineError("not_found", `not found (${status}) — check model and base URL${suffix}`, {
      status,
    });
  }
  if (status === 429) {
    return new EngineError("rate_limit", `rate limited (429)${suffix}`, { status });
  }
  if (status >= 500) {
    return new EngineError("server", `upstream error (${status})${suffix}`, { status });
  }
  return new EngineError("client", `request rejected (${status})${suffix}`, { status });
}

/** Classify a fetch() rejection. undici surfaces low-level failures as a
 * TypeError whose `.cause.code` carries the real reason (ECONNREFUSED, …);
 * an aborted request rejects with an AbortError. */
export function classifyFetchError(error: unknown): EngineError {
  if (error instanceof EngineError) {
    return error;
  }
  const name = (error as { name?: string }).name;
  if (name === "AbortError") {
    return new EngineError("aborted", "request aborted", { retryable: false, cause: error });
  }
  const code = (error as { cause?: { code?: string } }).cause?.code;
  const message = (error as Error).message ?? String(error);
  return new EngineError("network", `network error${code ? ` (${code})` : ""}: ${message}`, {
    cause: error,
  });
}

/** Redact Bearer tokens / api keys from an upstream error body before it is
 * surfaced or logged. */
export function redactSecrets(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/(sk-|api[_-]?key["':=\s]+)[A-Za-z0-9._-]{8,}/gi, "$1[redacted]");
}

/** Best-effort human-readable detail from an OpenAI-compatible error body. */
export function extractErrorDetail(body: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return redactSecrets(body).slice(0, 240);
  }
  // Valid JSON whose top-level value is not an object (null, number, array,
  // bare string) has no error/message field — fall back to the raw body.
  if (typeof parsed !== "object" || parsed === null) {
    return redactSecrets(body).slice(0, 240);
  }
  const obj = parsed as { error?: unknown; message?: unknown };
  const err = obj.error;
  let detail: string | undefined;
  if (typeof err === "string") {
    detail = err;
  } else if (typeof err === "object" && err !== null && typeof (err as { message?: unknown }).message === "string") {
    detail = (err as { message: string }).message;
  } else if (typeof obj.message === "string") {
    detail = obj.message;
  }
  return redactSecrets(detail ?? body).slice(0, 240);
}
