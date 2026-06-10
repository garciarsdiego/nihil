import { access, mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { ProjectRunner } from "../agent/runner.js";
import { ByokEngine } from "../engine/byok.js";
import { createSession, type Session } from "../engine/session.js";
import { runTurn } from "../engine/turn.js";
import { LocalProcessTarget } from "../exec/local-process.js";
import { SystemGitBackend } from "../git/transaction.js";
import { DONE, deltaFrame, startMockSseServer, type MockSseServer } from "./fakes/sse-server.js";

const execFileAsync = promisify(execFile);
const templatesDir = fileURLToPath(new URL("./fixtures", import.meta.url));

/** Run git in the project dir, returning trimmed stdout. */
async function gitOut(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Parse the JSON body the mock server recorded for a given request. */
function requestMessages(server: MockSseServer, index: number): { role: string; content: string }[] {
  const body = JSON.parse(server.requests[index]?.body ?? "{}") as {
    messages?: { role: string; content: string }[];
  };
  return body.messages ?? [];
}

let projectDir: string;
let target: LocalProcessTarget;
let git: SystemGitBackend;
let runner: ProjectRunner;
let server: MockSseServer;
let engine: ByokEngine;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "nihil-turn-"));
  target = new LocalProcessTarget({
    projectId: "turn-integration-project",
    projectDir,
    templatesDir,
    readyTimeoutMs: 20_000,
  });
  await target.init({ name: "template-basic" });
  git = new SystemGitBackend(projectDir);
  runner = new ProjectRunner({ target, git });
  server = await startMockSseServer();
  engine = new ByokEngine(
    { baseUrl: server.url, model: "m", maxTokens: 1000 },
    { sleep: async () => {} },
  );
});

afterEach(async () => {
  await target.destroy();
  await server.close();
  await rm(projectDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});

describe("runTurn integration — real target + git, real ByokEngine over a mock SSE server", () => {
  it(
    "streams prose + a chunked <nihil-write> to disk, commits with the message-id trailer, and stores feedback",
    async () => {
      const headBefore = await gitOut(projectDir, ["rev-parse", "HEAD"]);

      // Build the write tag from many small deltas so the close tag itself is
      // split across frames — exercises the parser's streaming close detection.
      // The close tag MUST start its own line (never inline).
      server.queue({
        frames: [
          deltaFrame("Creating the component.\n"),
          deltaFrame('<nihil-write path="src/Generated.tsx">\n'),
          deltaFrame("export const Generated = () => "),
          deltaFrame("<div>generated</div>;\n"),
          deltaFrame("</nihil"),
          deltaFrame("-write>\n"),
          deltaFrame("Done.", "stop"),
          DONE,
        ],
      });

      const session = createSession();
      const result = await runTurn(session, "make a component", { engine, runner, target });

      // (a) The file exists on disk with the streamed content.
      expect(await exists(join(projectDir, "src", "Generated.tsx"))).toBe(true);
      const contents = await target.readFile("src/Generated.tsx");
      expect(contents).toContain("export const Generated");
      expect(contents).toContain("<div>generated</div>");

      // (b) A real commit landed with the Nihil-Message-Id trailer.
      expect(result.result.committed).toBe(true);
      expect(result.result.rolledBack).toBe(false);
      const headAfter = await gitOut(projectDir, ["rev-parse", "HEAD"]);
      expect(headAfter).not.toBe(headBefore);
      expect(headAfter).toBe(result.result.commitRef);
      const trailer = await gitOut(projectDir, [
        "log",
        "-1",
        "--format=%(trailers:key=Nihil-Message-Id,valueonly)",
      ]);
      expect(trailer).toBe(result.messageId);

      // (c) Prose was captured (not just the tag body) and the turn finished cleanly.
      expect(result.assistantText).toContain("Creating the component.");
      expect(result.assistantText).toContain("Done.");
      expect(result.finishReason).toBe("stop");

      // (d) Session bookkeeping: one user + one assistant message; pendingOutput
      // mirrors the runner's feedback string (empty for a clean write).
      expect(session.messages).toHaveLength(2);
      expect(session.messages[0]?.role).toBe("user");
      expect(session.messages[1]?.role).toBe("assistant");
      expect(session.pendingOutput).toBe(result.result.feedback);
    },
    60_000,
  );

  it(
    "carries conversation history into a second turn whose <nihil-edit> patches the first turn's file",
    async () => {
      const session = createSession();

      // Queue BOTH turn scripts up front. The mock server's nextScript() keeps
      // the LAST queued script to repeat once the queue is exhausted, so a
      // script queued while the queue is already at length 1 lands BEHIND the
      // leftover — drain order only matches turn order when all scripts are
      // enqueued before any request arrives.
      server.queue(
        {
          // Turn 1: write a file with a known, editable line.
          frames: [
            deltaFrame('<nihil-write path="src/Counter.tsx">\n'),
            deltaFrame("export const label = "),
            deltaFrame('"start";\n'),
            deltaFrame("</nihil-write>\n", "stop"),
            DONE,
          ],
        },
        {
          // Turn 2: edit that file. SEARCH must match the file content exactly;
          // the close tag for nihil-edit also sits on its own line.
          frames: [
            deltaFrame("Updating the label.\n"),
            deltaFrame('<nihil-edit path="src/Counter.tsx">\n'),
            deltaFrame("<<<<<<< SEARCH\n"),
            deltaFrame('export const label = "start";\n'),
            deltaFrame("=======\n"),
            deltaFrame('export const label = "updated";\n'),
            deltaFrame(">>>>>>> REPLACE\n"),
            deltaFrame("</nihil-edit>\n", "stop"),
            DONE,
          ],
        },
      );

      const first = await runTurn(session, "create a counter", { engine, runner, target });
      expect(first.result.committed).toBe(true);
      expect(await target.readFile("src/Counter.tsx")).toContain('"start"');
      expect(session.messages).toHaveLength(2);

      const second = await runTurn(session, "rename the label", { engine, runner, target });

      // The edit applied.
      expect(second.result.committed).toBe(true);
      const patched = await target.readFile("src/Counter.tsx");
      expect(patched).toContain('"updated"');
      expect(patched).not.toContain('"start"');

      // Conversation history grew to 4 messages (2 per turn).
      expect(session.messages).toHaveLength(4);
      expect(session.messages.map((m) => m.role)).toEqual([
        "user",
        "assistant",
        "user",
        "assistant",
      ]);

      // The SECOND request the server received must carry the prior turn's
      // exchange in its messages array (history is replayed to the engine).
      expect(server.requests).toHaveLength(2);
      const secondMessages = requestMessages(server, 1);
      // ByokEngine prepends the system message, so the wire array is
      // [system, user(turn1), assistant(turn1), user(turn2)] — 4 entries.
      expect(secondMessages).toHaveLength(4);
      expect(secondMessages[0]?.role).toBe("system");
      const chatMessages = secondMessages.filter((m) => m.role !== "system");
      expect(chatMessages).toHaveLength(3);
      expect(chatMessages[0]?.role).toBe("user");
      expect(chatMessages[0]?.content).toContain("create a counter");
      expect(chatMessages[1]?.role).toBe("assistant");
      expect(chatMessages[1]?.content).toContain("nihil-write");
      expect(chatMessages[2]?.role).toBe("user");
      expect(chatMessages[2]?.content).toContain("rename the label");
    },
    60_000,
  );

  it(
    "commits a completed write and surfaces the token-limit warning when finish_reason is length",
    async () => {
      const headBefore = await gitOut(projectDir, ["rev-parse", "HEAD"]);
      server.queue({
        frames: [
          deltaFrame('<nihil-write path="src/Truncated.tsx">\n'),
          deltaFrame("export const Truncated = () => null;\n"),
          deltaFrame("</nihil-write>\n"),
          // Trailing prose then a length stop — the model was cut off.
          deltaFrame("And here is more that got cut o", "length"),
          DONE,
        ],
      });

      const result = await runTurn(createSession(), "build with limit", { engine, runner, target });

      // The completed write still committed (partial output is like truncation).
      expect(await exists(join(projectDir, "src", "Truncated.tsx"))).toBe(true);
      expect(result.result.committed).toBe(true);
      expect(await gitOut(projectDir, ["rev-parse", "HEAD"])).not.toBe(headBefore);

      // The length finish raises the token-limit warning.
      expect(result.finishReason).toBe("length");
      expect(result.warnings.some((w) => w.includes("token limit"))).toBe(true);
    },
    60_000,
  );

  it(
    "rolls back / leaves a clean tree on a mid-stream abort with no unhandled rejection",
    async () => {
      const headBefore = await gitOut(projectDir, ["rev-parse", "HEAD"]);

      // A delay between frames keeps the stream open long enough to abort it
      // after the first delta lands.
      server.queue({
        delayMs: 150,
        frames: [
          deltaFrame('<nihil-write path="src/Aborted.tsx">\n'),
          deltaFrame("export const Aborted = () => null;\n"),
          deltaFrame("</nihil-write>\n", "stop"),
          DONE,
        ],
      });

      const rejections: unknown[] = [];
      const onRejection = (reason: unknown): void => {
        rejections.push(reason);
      };
      process.on("unhandledRejection", onRejection);

      const controller = new AbortController();
      // Abort once the first streamed delta is observed by the turn observer.
      const observer = {
        onAssistantDelta: (): void => {
          controller.abort();
        },
      };

      let result: Awaited<ReturnType<typeof runTurn>>;
      try {
        result = await runTurn(
          createSession(),
          "build then abort",
          { engine, runner, target, observer },
          { signal: controller.signal },
        );
      } finally {
        // Give any late microtasks a tick to settle before we check rejections.
        await new Promise((r) => setTimeout(r, 50));
        process.off("unhandledRejection", onRejection);
      }

      // No commit happened; the runner rolled back (observed the abort signal
      // between chunks) — committed false, rolledBack true.
      expect(result.result.committed).toBe(false);
      expect(result.result.rolledBack).toBe(true);
      const headAfter = await gitOut(projectDir, ["rev-parse", "HEAD"]);
      expect(headAfter).toBe(headBefore);

      // The aborted write must not survive on disk.
      expect(await exists(join(projectDir, "src", "Aborted.tsx"))).toBe(false);

      // Working tree is clean (rollback removed any created file / reset tracked ones).
      expect(await gitOut(projectDir, ["status", "--porcelain"])).toBe("");

      // An abort is not surfaced as an engine error.
      expect(result.engineError).toBeUndefined();
      expect(rejections).toEqual([]);
    },
    60_000,
  );

  it(
    "surfaces a pre-stream 401 as an engine error, commits nothing, and leaves history intact",
    async () => {
      const headBefore = await gitOut(projectDir, ["rev-parse", "HEAD"]);
      server.queue({ status: 401, errorBody: JSON.stringify({ error: { message: "bad key" } }) });

      const session = createSession();
      const result = await runTurn(session, "this will 401", { engine, runner, target });

      // The turn resolves; the failure is reported as an auth engine error.
      expect(result.engineError).toBeDefined();
      expect(result.engineError?.kind).toBe("auth");
      expect(result.engineError?.status).toBe(401);
      expect(result.warnings.some((w) => w.includes("Engine error") && w.includes("auth"))).toBe(true);

      // Nothing committed; HEAD unchanged; tree clean.
      expect(result.result.committed).toBe(false);
      expect(await gitOut(projectDir, ["rev-parse", "HEAD"])).toBe(headBefore);
      expect(await gitOut(projectDir, ["status", "--porcelain"])).toBe("");

      // The produced-guard leaves session history + pendingOutput untouched so a
      // retry starts clean (a pre-stream failure produced no text/commit/rollback).
      expect(session.messages).toHaveLength(0);
      expect(session.pendingOutput).toBe("");
    },
    60_000,
  );
});
