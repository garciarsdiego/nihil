import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface SseScript {
  /** Non-200 makes an error response with `errorBody`. */
  status?: number;
  errorBody?: string;
  /** SSE frames to write (each a complete "data: ...\n\n"). */
  frames?: string[];
  /** Delay between frames (ms). */
  delayMs?: number;
  /** Abruptly destroy the socket after writing N frames (mid-stream failure). */
  dropAfter?: number;
}

export interface RecordedRequest {
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export interface MockSseServer {
  url: string;
  readonly requests: RecordedRequest[];
  /** Queue one script per upcoming request (last one repeats once exhausted). */
  queue(...scripts: SseScript[]): void;
  close(): Promise<void>;
}

const DONE_FRAME = "data: [DONE]\n\n";

/**
 * A local OpenAI-compatible streaming endpoint for tests. Records each request
 * and replies per the queued script: a streamed SSE body, a non-200 error, or
 * a mid-stream socket drop. Listens on 127.0.0.1 on an ephemeral port.
 */
export async function startMockSseServer(...initial: SseScript[]): Promise<MockSseServer> {
  const scripts: SseScript[] = [...initial];
  const requests: RecordedRequest[] = [];

  const server: Server = createServer((req, res) => {
    handleRequest(req, res, requests, nextScript(scripts)).catch(() => {
      if (!res.writableEnded) {
        res.destroy();
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    queue(...next: SseScript[]): void {
      scripts.push(...next);
    },
    close(): Promise<void> {
      return new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      });
    },
  };
}

function nextScript(scripts: SseScript[]): SseScript {
  return scripts.length > 1 ? (scripts.shift() as SseScript) : (scripts[0] ?? { frames: [DONE_FRAME] });
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  requests: RecordedRequest[],
  script: SseScript,
): Promise<void> {
  const body = await readBody(req);
  requests.push({ headers: req.headers, body });

  const status = script.status ?? 200;
  if (status !== 200) {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(script.errorBody ?? JSON.stringify({ error: { message: `status ${status}` } }));
    return;
  }

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });

  const frames = script.frames ?? [DONE_FRAME];
  for (let i = 0; i < frames.length; i++) {
    if (script.dropAfter !== undefined && i >= script.dropAfter) {
      res.destroy(); // abrupt mid-stream failure
      return;
    }
    res.write(frames[i]);
    if (script.delayMs !== undefined && script.delayMs > 0) {
      await delay(script.delayMs);
    }
  }
  res.end();
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => (data += chunk.toString()));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Helper: a standard OpenAI text-delta frame. */
export function deltaFrame(content: string, finishReason?: string): string {
  const choice: Record<string, unknown> = { delta: { content } };
  if (finishReason !== undefined) {
    choice.finish_reason = finishReason;
  }
  return `data: ${JSON.stringify({ choices: [choice] })}\n\n`;
}

export const DONE = DONE_FRAME;
