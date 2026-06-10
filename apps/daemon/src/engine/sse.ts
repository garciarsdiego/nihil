import { EngineError } from "./errors.js";

/**
 * Read a text/event-stream body frame by frame. Buffers across chunk
 * boundaries (a TCP read may hold a partial frame or several), splits on the
 * blank-line separator (\n\n or \r\n\r\n), and yields each frame's joined
 * `data:` payload (which may be "[DONE]" or a JSON chunk). Comment/keepalive
 * lines (":"-prefixed) and event:/id:/retry: lines are skipped.
 */
export async function* readSseFrames(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      if (signal?.aborted) {
        return;
      }
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (error) {
        if (signal?.aborted || (error as Error).name === "AbortError") {
          return;
        }
        // A mid-stream transport failure (ECONNRESET, …) must surface as a
        // classified EngineError so callers that catch EngineError contain it,
        // not a bare Error that escapes as an unhandled rejection.
        throw new EngineError("network", `stream interrupted: ${(error as Error).message}`, {
          cause: error,
        });
      }
      if (chunk.done) {
        buffer += decoder.decode(); // flush any trailing partial multibyte sequence
        break;
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      let boundary = nextBoundary(buffer);
      while (boundary !== null) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary.length);
        const data = frameData(frame);
        if (data !== null) {
          yield data;
        }
        boundary = nextBoundary(buffer);
      }
    }
    const tail = frameData(buffer);
    if (tail !== null) {
      yield tail;
    }
  } finally {
    reader.releaseLock();
    void body.cancel().catch(() => undefined);
  }
}

function nextBoundary(buffer: string): { index: number; length: number } | null {
  const match = /\r?\n\r?\n/.exec(buffer);
  return match ? { index: match.index, length: match[0].length } : null;
}

function frameData(frame: string): string | null {
  const dataLines: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith(":") || !line.startsWith("data:")) {
      continue;
    }
    let value = line.slice("data:".length);
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }
    dataLines.push(value);
  }
  return dataLines.length > 0 ? dataLines.join("\n") : null;
}
