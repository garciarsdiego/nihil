import { ProjectRunner } from "../agent/runner.js";
import { ByokEngine } from "../engine/byok.js";
import { loadEngineConfig } from "../engine/config.js";
import { EngineError } from "../engine/errors.js";
import { assembleSystemPrompt } from "../engine/prompt/assemble.js";
import { readSseFrames } from "../engine/sse.js";
import { createSession } from "../engine/session.js";
import { runTurn } from "../engine/turn.js";
import type { Engine, EngineEvent } from "../engine/types.js";
import { buildChatCompletionsUrl } from "../engine/url.js";
import { FakeGitBackend, FakeTarget, MemoryProject } from "./fakes/memory-project.js";

function sseBody(...frames: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const f of frames) {
        controller.enqueue(enc.encode(f));
      }
      controller.close();
    },
  });
}

function dataFrame(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

function sseResponse(frames: string[], status = 200): Response {
  return new Response(status === 200 ? sseBody(...frames) : "upstream boom", {
    status,
    headers: { "content-type": "text/event-stream" },
  });
}

class FakeEngine implements Engine {
  readonly capabilities = { editsViaProtocol: true };
  constructor(private readonly events: EngineEvent[]) {}
  async *stream(): AsyncIterable<EngineEvent> {
    for (const event of this.events) {
      yield event;
    }
  }
}

describe("buildChatCompletionsUrl", () => {
  it("injects /v1 only when the base path has no version segment", () => {
    expect(buildChatCompletionsUrl("http://localhost:20128")).toBe(
      "http://localhost:20128/v1/chat/completions",
    );
    expect(buildChatCompletionsUrl("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
    expect(buildChatCompletionsUrl("https://openrouter.ai/api/v1")).toBe(
      "https://openrouter.ai/api/v1/chat/completions",
    );
    expect(buildChatCompletionsUrl("https://example.com/anthropic")).toBe(
      "https://example.com/anthropic/v1/chat/completions",
    );
  });
});

describe("loadEngineConfig", () => {
  it("applies defaults and validates max tokens", () => {
    const cfg = loadEngineConfig({});
    expect(cfg.baseUrl).toBe("http://localhost:20128");
    expect(cfg.apiKey).toBeUndefined();
    expect(cfg.model).toBe("default");
    expect(cfg.maxTokens).toBe(16384);

    expect(loadEngineConfig({ NIHIL_ENGINE_MAX_TOKENS: "32000" }).maxTokens).toBe(32000);
    expect(() => loadEngineConfig({ NIHIL_ENGINE_MAX_TOKENS: "abc" })).toThrow(/MAX_TOKENS/);
    expect(() => loadEngineConfig({ NIHIL_ENGINE_BASE_URL: "ftp://x" })).toThrow(/BASE_URL/);
  });
});

describe("readSseFrames", () => {
  it("reassembles data lines split across chunks and yields [DONE]", async () => {
    const body = sseBody("data: {\"a\":", '1}\n\n: keepalive\n\n', "data: [DONE]\n\n");
    const out: string[] = [];
    for await (const frame of readSseFrames(body)) {
      out.push(frame);
    }
    expect(out).toEqual(['{"a":1}', "[DONE]"]);
  });

  it("surfaces a mid-stream transport error as a network EngineError (not a bare throw)", async () => {
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'));
        controller.error(new Error("ECONNRESET"));
      },
    });
    await expect(
      (async () => {
        for await (const _ of readSseFrames(body)) {
          void _;
        }
      })(),
    ).rejects.toMatchObject({ name: "EngineError", kind: "network" });
  });
});

describe("ByokEngine", () => {
  it("streams text deltas then a done event", async () => {
    const engine = new ByokEngine(
      { baseUrl: "http://x", model: "m", maxTokens: 100 },
      {
        fetch: async () =>
          sseResponse([
            dataFrame({ choices: [{ delta: { content: "Hel" } }] }),
            dataFrame({ choices: [{ delta: { content: "lo" }, finish_reason: "stop" }] }),
            "data: [DONE]\n\n",
          ]),
        sleep: async () => {},
      },
    );
    const events: EngineEvent[] = [];
    for await (const e of engine.stream({ system: "s", messages: [{ role: "user", content: "hi" }] })) {
      events.push(e);
    }
    expect(events).toEqual([
      { type: "text", delta: "Hel" },
      { type: "text", delta: "lo" },
      { type: "done", finishReason: "stop" },
    ]);
  });

  it("throws a terminal auth error on 401 without retrying", async () => {
    let calls = 0;
    const engine = new ByokEngine(
      { baseUrl: "http://x", model: "m", maxTokens: 100, apiKey: "secret" },
      {
        fetch: async () => {
          calls++;
          return sseResponse([], 401);
        },
        sleep: async () => {},
      },
    );
    await expect(drain(engine)).rejects.toMatchObject({ kind: "auth" });
    expect(calls).toBe(1);
  });

  it("retries a 500 then succeeds", async () => {
    let calls = 0;
    const engine = new ByokEngine(
      { baseUrl: "http://x", model: "m", maxTokens: 100 },
      {
        fetch: async () => {
          calls++;
          return calls === 1
            ? sseResponse([], 500)
            : sseResponse([dataFrame({ choices: [{ delta: { content: "ok" } }] }), "data: [DONE]\n\n"]);
        },
        sleep: async () => {},
      },
    );
    const events = await collect(engine);
    expect(calls).toBe(2);
    expect(events.some((e) => e.type === "text" && e.delta === "ok")).toBe(true);
  });
});

describe("assembleSystemPrompt (golden)", () => {
  it("build mode fills five slots and contains the protocol rules + both example tags", () => {
    const prompt = assembleSystemPrompt({
      mode: "build",
      fileTree: "SLOT_FILE_TREE",
      contextFiles: "SLOT_CONTEXT_FILES",
      workflows: "SLOT_WORKFLOWS",
      templateNotes: "SLOT_TEMPLATE_NOTES",
      designRules: "SLOT_DESIGN_RULES",
    });
    expect(prompt).not.toMatch(/\{\{[A-Z_]+\}\}/);
    for (const rule of [
      "Closing tags MUST start on their own line",
      "project-relative with forward slashes",
      "XML-escaped",
      "XML-escape it",
      "One coherent task per message",
    ]) {
      expect(prompt).toContain(rule);
    }
    expect(prompt).toContain('<nihil-write path="src/components/Hero.tsx"');
    expect(prompt).toContain('<nihil-edit path="src/App.tsx"');
    for (const slot of [
      "SLOT_FILE_TREE",
      "SLOT_CONTEXT_FILES",
      "SLOT_WORKFLOWS",
      "SLOT_TEMPLATE_NOTES",
      "SLOT_DESIGN_RULES",
    ]) {
      expect(prompt).toContain(slot);
    }
  });
});

describe("runTurn", () => {
  function setup() {
    const project = new MemoryProject();
    project.seed({ "nihil.config.json": '{"workflows":{"dev":{"command":"vite","longRunning":true}}}' });
    const target = new FakeTarget(project);
    const runner = new ProjectRunner({ target, git: new FakeGitBackend(project) });
    return { project, target, runner };
  }

  it("streams a write through to a commit and stores feedback", async () => {
    const { project, target, runner } = setup();
    const engine = new FakeEngine([
      { type: "text", delta: 'Adding a file.\n<nihil-write path="src/x.tsx">\nexport const X = 1;\n</nihil-write>' },
      { type: "done", finishReason: "stop" },
    ]);
    const session = createSession();
    const result = await runTurn(session, "add a file", { engine, runner, target });

    expect(project.files.get("src/x.tsx")).toContain("export const X = 1;");
    expect(result.result.committed).toBe(true);
    expect(result.assistantText).toContain("Adding a file");
    expect(session.messages).toHaveLength(2);
    expect(session.messages[0]?.role).toBe("user");
  });

  it("warns on a length finish but still commits completed actions", async () => {
    const { project, target, runner } = setup();
    const engine = new FakeEngine([
      { type: "text", delta: '<nihil-write path="src/y.tsx">\nexport const Y = 2;\n</nihil-write>\nand more...' },
      { type: "done", finishReason: "length" },
    ]);
    const result = await runTurn(createSession(), "build", { engine, runner, target });

    expect(project.files.get("src/y.tsx")).toContain("export const Y = 2;");
    expect(result.warnings.some((w) => w.includes("token limit"))).toBe(true);
  });

  it("does not record history or clobber pending output when aborted mid-stream", async () => {
    const { project, target, runner } = setup();
    const controller = new AbortController();
    const abortingEngine: Engine = {
      capabilities: { editsViaProtocol: true },
      async *stream() {
        yield { type: "text", delta: '<nihil-write path="src/z.tsx">\nz\n</nihil-write>' };
        controller.abort(); // user hits stop after the write streamed
        yield { type: "text", delta: " and more" };
        yield { type: "done", finishReason: "stop" };
      },
    };
    const session = createSession();
    session.pendingOutput = "<nihil-output>prior</nihil-output>";

    const result = await runTurn(session, "go", { engine: abortingEngine, runner, target }, {
      signal: controller.signal,
    });

    expect(result.result.rolledBack).toBe(true);
    expect(project.files.has("src/z.tsx")).toBe(false);
    expect(session.messages).toHaveLength(0); // turn not recorded
    expect(session.pendingOutput).toBe("<nihil-output>prior</nihil-output>"); // preserved
  });

  it("warns when nihil.config.json is invalid instead of failing silently", async () => {
    const project = new MemoryProject();
    project.seed({ "nihil.config.json": "{not valid json" });
    const target = new FakeTarget(project);
    const runner = new ProjectRunner({ target, git: new FakeGitBackend(project) });
    const engine = new FakeEngine([
      { type: "text", delta: "hello" },
      { type: "done", finishReason: "stop" },
    ]);

    const result = await runTurn(createSession(), "hi", { engine, runner, target });
    expect(result.warnings.some((w) => w.includes("nihil.config.json is invalid"))).toBe(true);
  });

  it("prepends the previous turn's pending output to the next user message", async () => {
    const { target, runner } = setup();
    const session = createSession();
    session.pendingOutput = '<nihil-output type="error" code="EDIT_NO_MATCH" message="x"></nihil-output>';
    let capturedSystem = "";
    const recordingEngine: Engine = {
      capabilities: { editsViaProtocol: true },
      async *stream(request) {
        capturedSystem = request.messages.at(-1)?.content ?? "";
        yield { type: "text", delta: "ok" };
        yield { type: "done", finishReason: "stop" };
      },
    };
    await runTurn(session, "fix it", { engine: recordingEngine, runner, target });
    expect(capturedSystem.startsWith('<nihil-output type="error"')).toBe(true);
    expect(capturedSystem).toContain("fix it");
  });
});

async function drain(engine: Engine): Promise<void> {
  for await (const _ of engine.stream({ system: "s", messages: [] })) {
    void _;
  }
}

async function collect(engine: Engine): Promise<EngineEvent[]> {
  const events: EngineEvent[] = [];
  for await (const e of engine.stream({ system: "s", messages: [] })) {
    events.push(e);
  }
  return events;
}
