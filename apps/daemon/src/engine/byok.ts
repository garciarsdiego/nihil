import type { EngineConfig } from "./config.js";
import {
  EngineError,
  classifyFetchError,
  classifyHttpStatus,
  extractErrorDetail,
  redactSecrets,
} from "./errors.js";
import { readSseFrames } from "./sse.js";
import { buildChatCompletionsUrl } from "./url.js";
import {
  normalizeFinishReason,
  type Engine,
  type EngineCapabilities,
  type EngineEvent,
  type EngineFinishReason,
  type EngineRequest,
  type EngineUsage,
} from "./types.js";

const MAX_RETRIES = 2; // 3 attempts total
const BASE_BACKOFF_MS = 500;

export interface ByokEngineDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

interface OpenAiChunk {
  error?: unknown;
  choices?: { delta?: { content?: unknown }; finish_reason?: unknown }[];
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown } | null;
}

/**
 * OpenAI-compatible streaming chat-completions engine (mode 2 / BYOK). Retries
 * only at connect time (before any byte is streamed) for network/429/5xx; once
 * deltas flow, errors are terminal — you cannot un-send partial output.
 */
export class ByokEngine implements Engine {
  readonly capabilities: EngineCapabilities = { editsViaProtocol: true };
  readonly #config: EngineConfig;
  readonly #fetch: typeof fetch;
  readonly #sleep: (ms: number) => Promise<void>;

  constructor(config: EngineConfig, deps: ByokEngineDeps = {}) {
    this.#config = config;
    this.#fetch = deps.fetch ?? fetch;
    this.#sleep = deps.sleep ?? defaultSleep;
  }

  async *stream(
    request: EngineRequest,
    opts: { signal?: AbortSignal } = {},
  ): AsyncIterable<EngineEvent> {
    const url = buildChatCompletionsUrl(this.#config.baseUrl);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.#config.apiKey !== undefined) {
      headers.authorization = `Bearer ${this.#config.apiKey}`;
    }
    const body = JSON.stringify({
      model: request.model ?? this.#config.model,
      messages: [{ role: "system", content: request.system }, ...request.messages],
      max_tokens: request.maxTokens ?? this.#config.maxTokens,
      stream: true,
      // Ask OpenAI-compatible providers for a final usage chunk (ignored by
      // providers that don't support it; surfaced on the `done` event).
      stream_options: { include_usage: true },
    });

    const response = await this.#connect(url, headers, body, opts.signal);
    yield* this.#consume(response, opts.signal);
  }

  async #connect(
    url: string,
    headers: Record<string, string>,
    body: string,
    signal?: AbortSignal,
  ): Promise<Response> {
    let lastError: EngineError | undefined;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal?.aborted) {
        throw new EngineError("aborted", "aborted before connect", { retryable: false });
      }
      let response: Response;
      try {
        response = await this.#fetch(url, { method: "POST", headers, body, signal, redirect: "error" });
      } catch (error) {
        lastError = classifyFetchError(error);
        if (!lastError.retryable || attempt === MAX_RETRIES) {
          throw lastError;
        }
        await this.#sleep(backoffMs(attempt));
        continue;
      }
      if (response.ok && response.body !== null) {
        return response;
      }
      const detail = this.#redact(await readBodyDetail(response));
      lastError = classifyHttpStatus(response.status, detail);
      if (!lastError.retryable || attempt === MAX_RETRIES) {
        throw lastError;
      }
      await this.#sleep(backoffMs(attempt));
    }
    throw lastError ?? new EngineError("server", "no response from engine");
  }

  async *#consume(response: Response, signal?: AbortSignal): AsyncGenerator<EngineEvent> {
    let finishReason: EngineFinishReason = "unknown";
    let usage: EngineUsage | undefined;
    for await (const data of readSseFrames(response.body as ReadableStream<Uint8Array>, signal)) {
      if (data === "[DONE]") {
        break;
      }
      let chunk: OpenAiChunk;
      try {
        chunk = JSON.parse(data) as OpenAiChunk;
      } catch {
        throw new EngineError("malformed", `malformed SSE JSON: ${data.slice(0, 120)}`);
      }
      const providerError = streamErrorMessage(chunk);
      if (providerError !== null) {
        // Provider-controlled string: redact before it can reach a warning.
        throw new EngineError("provider", this.#redact(providerError));
      }
      const choice = Array.isArray(chunk.choices) ? chunk.choices[0] : undefined;
      const delta = choice?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) {
        yield { type: "text", delta };
      }
      const reason = choice?.finish_reason;
      if (typeof reason === "string" && reason.length > 0) {
        finishReason = normalizeFinishReason(reason);
      }
      const parsedUsage = parseUsage(chunk.usage);
      if (parsedUsage !== undefined) {
        usage = parsedUsage;
      }
    }
    if (signal?.aborted) {
      return;
    }
    yield usage !== undefined ? { type: "done", finishReason, usage } : { type: "done", finishReason };
  }

  /** Strip the known api key (and generic secret patterns) from any string
   * that may surface to the user or a log. */
  #redact(text: string): string {
    const generic = redactSecrets(text);
    const key = this.#config.apiKey;
    return key !== undefined && key.length > 0 ? generic.split(key).join("[redacted]") : generic;
  }
}

function parseUsage(raw: OpenAiChunk["usage"]): EngineUsage | undefined {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }
  const prompt = raw.prompt_tokens;
  const completion = raw.completion_tokens;
  const total = raw.total_tokens;
  if (typeof prompt !== "number" && typeof completion !== "number" && typeof total !== "number") {
    return undefined;
  }
  const promptTokens = typeof prompt === "number" ? prompt : 0;
  const completionTokens = typeof completion === "number" ? completion : 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens: typeof total === "number" ? total : promptTokens + completionTokens,
  };
}

function streamErrorMessage(chunk: OpenAiChunk): string | null {
  const err = chunk.error;
  if (typeof err === "string") {
    return err;
  }
  if (typeof err === "object" && err !== null && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return null;
}

async function readBodyDetail(response: Response): Promise<string> {
  try {
    return extractErrorDetail(await response.text());
  } catch {
    return response.statusText;
  }
}

function backoffMs(attempt: number): number {
  return BASE_BACKOFF_MS * 2 ** attempt;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
