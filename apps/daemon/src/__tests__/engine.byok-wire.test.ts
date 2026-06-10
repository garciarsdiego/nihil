import { afterEach, describe, expect, it } from "vitest";
import { ByokEngine } from "../engine/byok.js";
import type { EngineConfig } from "../engine/config.js";
import { EngineError } from "../engine/errors.js";
import type { EngineEvent, EngineRequest } from "../engine/types.js";
import { DONE, deltaFrame, startMockSseServer, type MockSseServer } from "./fakes/sse-server.js";

/**
 * BYOK engine over the REAL mock SSE server (real fetch + real SSE wire). These
 * exercise connect/retry/streaming/abort paths end-to-end, complementing the
 * fetch-stubbed cases in engine.smoke.test.ts.
 */

let server: MockSseServer | undefined;

afterEach(async () => {
  if (server !== undefined) {
    await server.close();
    server = undefined;
  }
});

function engineFor(srv: MockSseServer, overrides: Partial<EngineConfig> = {}): ByokEngine {
  const config: EngineConfig = {
    baseUrl: srv.url,
    model: "test-model",
    maxTokens: 256,
    ...overrides,
  };
  // sleep is stubbed so retry backoff is instant; we still use the real fetch.
  return new ByokEngine(config, { sleep: async () => {} });
}

const REQUEST: EngineRequest = {
  system: "you are nihil",
  messages: [{ role: "user", content: "build me a page" }],
};

async function collect(
  engine: ByokEngine,
  request: EngineRequest = REQUEST,
  opts: { signal?: AbortSignal } = {},
): Promise<EngineEvent[]> {
  const events: EngineEvent[] = [];
  for await (const event of engine.stream(request, opts)) {
    events.push(event);
  }
  return events;
}

describe("ByokEngine over the mock SSE server", () => {
  it("streams multiple deltas then a done event carrying the finish_reason", async () => {
    server = await startMockSseServer({
      frames: [deltaFrame("Hel"), deltaFrame("lo "), deltaFrame("world", "stop"), DONE],
    });
    const events = await collect(engineFor(server));
    expect(events).toEqual([
      { type: "text", delta: "Hel" },
      { type: "text", delta: "lo " },
      { type: "text", delta: "world" },
      { type: "done", finishReason: "stop" },
    ]);
  });

  it("sends a stream:true chat-completions body with model, max_tokens and a system message", async () => {
    server = await startMockSseServer({ frames: [deltaFrame("ok", "stop"), DONE] });
    await collect(engineFor(server, { apiKey: "sk-test-123", model: "m-x", maxTokens: 777 }));

    expect(server.requests).toHaveLength(1);
    const recorded = server.requests[0]!;
    const body = JSON.parse(recorded.body) as {
      stream: boolean;
      model: string;
      max_tokens: number;
      messages: { role: string; content: string }[];
    };
    expect(body.stream).toBe(true);
    expect(body.model).toBe("m-x");
    expect(body.max_tokens).toBe(777);
    expect(body.messages[0]).toEqual({ role: "system", content: "you are nihil" });
    expect(body.messages[1]).toEqual({ role: "user", content: "build me a page" });
  });

  it("includes Authorization: Bearer <key> only when apiKey is set", async () => {
    server = await startMockSseServer({ frames: [deltaFrame("a", "stop"), DONE] });
    await collect(engineFor(server, { apiKey: "sk-secret" }));
    expect(server.requests[0]!.headers.authorization).toBe("Bearer sk-secret");
  });

  it("omits Authorization entirely when apiKey is undefined", async () => {
    server = await startMockSseServer({ frames: [deltaFrame("a", "stop"), DONE] });
    await collect(engineFor(server)); // no apiKey
    expect(server.requests[0]!.headers.authorization).toBeUndefined();
  });

  it("posts to /v1/chat/completions when the base url has no version segment", async () => {
    server = await startMockSseServer({ frames: [deltaFrame("a", "stop"), DONE] });
    // Capture the path the server actually received.
    const seenUrls: string[] = [];
    const tracingFetch: typeof fetch = (input, init) => {
      const u = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      seenUrls.push(u);
      return fetch(input, init);
    };
    const engine = new ByokEngine(
      { baseUrl: server.url, model: "m", maxTokens: 100 },
      { fetch: tracingFetch, sleep: async () => {} },
    );
    await collect(engine);
    expect(seenUrls).toHaveLength(1);
    expect(new URL(seenUrls[0]!).pathname).toBe("/v1/chat/completions");
  });

  it("throws a terminal auth EngineError on 401 with no retry (one request)", async () => {
    server = await startMockSseServer({ status: 401, errorBody: JSON.stringify({ error: { message: "bad key" } }) });
    const engine = engineFor(server, { apiKey: "sk-bad" });
    await expect(collect(engine)).rejects.toMatchObject({ kind: "auth", retryable: false, status: 401 });
    expect(server.requests).toHaveLength(1);
  });

  it("retries after a 429 and succeeds on the second attempt", async () => {
    server = await startMockSseServer(
      { status: 429, errorBody: JSON.stringify({ error: { message: "slow down" } }) },
      { frames: [deltaFrame("after-retry", "stop"), DONE] },
    );
    const events = await collect(engineFor(server));
    expect(server.requests).toHaveLength(2);
    expect(events).toContainEqual({ type: "text", delta: "after-retry" });
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "stop" });
  });

  it("throws a terminal server EngineError after three 500s", async () => {
    server = await startMockSseServer({ status: 500, errorBody: "upstream boom" });
    const engine = engineFor(server);
    await expect(collect(engine)).rejects.toMatchObject({ kind: "server", status: 500 });
    expect(server.requests).toHaveLength(3); // 1 initial + 2 retries
  });

  it("classifies a connect-time failure (closed port) as a retryable network error", async () => {
    server = await startMockSseServer({ frames: [DONE] });
    const url = server.url;
    await server.close(); // free the port so fetch hits ECONNREFUSED
    server = undefined;

    const engine = new ByokEngine({ baseUrl: url, model: "m", maxTokens: 100 }, { sleep: async () => {} });
    const error = await collect(engine).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(EngineError);
    expect((error as EngineError).kind).toBe("network");
    expect((error as EngineError).retryable).toBe(true);
  }, 15000);

  it("throws a terminal malformed error on a bad JSON frame, after yielding earlier deltas", async () => {
    server = await startMockSseServer({
      frames: [deltaFrame("good"), "data: {not json}\n\n", DONE],
    });
    const engine = engineFor(server);
    const seen: EngineEvent[] = [];
    const error = await (async () => {
      try {
        for await (const event of engine.stream(REQUEST)) {
          seen.push(event);
        }
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    // The clean delta before the malformed frame must have been yielded.
    expect(seen).toContainEqual({ type: "text", delta: "good" });
    expect(error).toBeInstanceOf(EngineError);
    expect((error as EngineError).kind).toBe("malformed");
  });

  it("throws a provider error on an inline error chunk mid-stream", async () => {
    server = await startMockSseServer({
      frames: [deltaFrame("partial"), 'data: {"error":{"message":"boom"}}\n\n', DONE],
    });
    const engine = engineFor(server);
    const seen: EngineEvent[] = [];
    const error = await (async () => {
      try {
        for await (const event of engine.stream(REQUEST)) {
          seen.push(event);
        }
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(seen).toContainEqual({ type: "text", delta: "partial" });
    expect(error).toBeInstanceOf(EngineError);
    expect((error as EngineError).kind).toBe("provider");
    expect((error as EngineError).message).toContain("boom");
  });

  it("survives a mid-stream socket drop: earlier deltas are kept and the stream ends without crashing", async () => {
    // Write 2 frames (spaced so the client consumes them before the RST races
    // the buffered bytes) then destroy the socket (no [DONE]); the already-
    // yielded delta must survive and the consumer must not crash the process.
    server = await startMockSseServer({
      frames: [deltaFrame("first"), deltaFrame("second"), DONE],
      delayMs: 60,
      dropAfter: 2, // destroy before writing the 3rd (DONE) frame
    });
    const engine = engineFor(server);
    const seen: EngineEvent[] = [];
    const error = await (async () => {
      try {
        for await (const event of engine.stream(REQUEST)) {
          seen.push(event);
        }
        return undefined;
      } catch (e) {
        return e;
      }
    })();
    expect(seen).toContainEqual({ type: "text", delta: "first" });
    expect(seen).toContainEqual({ type: "text", delta: "second" });
    // A clean EOF (reader.read() reports done) ends the stream and yields a
    // final done event; an abrupt RST surfaces as a thrown error. Either way the
    // process does not crash and the earlier deltas survived.
    if (error !== undefined) {
      expect(error).toBeInstanceOf(Error);
    } else {
      expect(seen.at(-1)?.type).toBe("done");
    }
  }, 15000);

  it("stops cleanly when the signal is aborted mid-stream (no done, no unhandled rejection)", async () => {
    // delayMs spaces the frames so the abort lands between deltas.
    server = await startMockSseServer({
      frames: [deltaFrame("one"), deltaFrame("two"), deltaFrame("three", "stop"), DONE],
      delayMs: 80,
    });
    const engine = engineFor(server);
    const controller = new AbortController();
    const seen: EngineEvent[] = [];

    const error = await (async () => {
      try {
        for await (const event of engine.stream(REQUEST, { signal: controller.signal })) {
          seen.push(event);
          if (event.type === "text" && event.delta === "one") {
            controller.abort();
          }
        }
        return undefined;
      } catch (e) {
        return e;
      }
    })();

    expect(seen).toContainEqual({ type: "text", delta: "one" });
    // Aborting must stop the stream early: never reach the final delta/done.
    expect(seen).not.toContainEqual({ type: "text", delta: "three" });
    expect(seen.some((e) => e.type === "done")).toBe(false);
    // An abort is not surfaced as an error to the consumer (it returns early),
    // but if the underlying fetch rejects with AbortError it must classify as
    // aborted, never bubble as an unhandled rejection.
    if (error !== undefined) {
      expect(error).toBeInstanceOf(EngineError);
      expect((error as EngineError).kind).toBe("aborted");
    }
  }, 20000);
});
