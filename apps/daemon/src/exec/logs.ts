import { stripVTControlCharacters } from "node:util";
import type { LogEvent } from "./target.js";

const DEFAULT_BUFFER_SIZE = 1000;

interface IngestorMeta {
  source: "stdout" | "stderr";
  workflow?: string;
  pid?: number;
}

interface Consumer {
  queue: LogEvent[];
  notify: (() => void) | null;
  done: boolean;
}

/**
 * Target-wide log hub: line-buffers raw process output (so ANSI sequences and
 * URLs split across chunks reassemble), strips ANSI per complete line, keeps
 * a bounded ring buffer for late subscribers, and fans out to any number of
 * independent AsyncIterable consumers (history replay + live events).
 * This stream is the future healer's feed — origin attribution (workflow,
 * pid) is baked into every stored event.
 */
export class LogHub {
  private readonly bufferSize: number;
  private readonly buffer: LogEvent[] = [];
  private readonly consumers = new Set<Consumer>();
  private closed = false;

  constructor(bufferSize = DEFAULT_BUFFER_SIZE) {
    this.bufferSize = bufferSize;
  }

  emit(event: LogEvent): void {
    if (this.closed) {
      return;
    }
    this.buffer.push(event);
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }
    for (const consumer of this.consumers) {
      consumer.queue.push(event);
      // A stalled consumer must not grow unboundedly; drop its oldest.
      if (consumer.queue.length > this.bufferSize) {
        consumer.queue.shift();
      }
      consumer.notify?.();
      consumer.notify = null;
    }
  }

  system(text: string, origin?: { workflow?: string; pid?: number }): void {
    this.emit({ source: "system", text, timestamp: Date.now(), ...origin });
  }

  /**
   * Returns a chunk ingestor for one process stream. Lines are emitted only
   * when complete (so ANSI sequences and URLs split across chunks reassemble);
   * call the returned flush() on stream end for the remainder. Events are
   * mirrored into `mirrors` hubs (per-process streams for ProcessHandle.logs).
   */
  createLineIngestor(
    meta: IngestorMeta,
    mirrors: readonly LogHub[] = [],
  ): {
    write: (chunk: Buffer | string) => void;
    flush: () => void;
  } {
    let partial = "";
    const emitLine = (line: string): void => {
      const text = stripVTControlCharacters(line);
      if (text.trim() === "") {
        return;
      }
      const event: LogEvent = {
        source: meta.source,
        text,
        timestamp: Date.now(),
        workflow: meta.workflow,
        pid: meta.pid,
      };
      this.emit(event);
      for (const mirror of mirrors) {
        mirror.emit(event);
      }
    };
    return {
      write: (chunk) => {
        partial += chunk.toString();
        const lines = partial.split(/\r?\n/);
        partial = lines.pop() ?? "";
        for (const line of lines) {
          emitLine(line);
        }
      },
      flush: () => {
        if (partial !== "") {
          emitLine(partial);
          partial = "";
        }
      },
    };
  }

  subscribe(): AsyncIterable<LogEvent> {
    // A closed hub is dead: no history replay, iterators end immediately.
    const consumer: Consumer = {
      queue: this.closed ? [] : [...this.buffer],
      notify: null,
      done: this.closed,
    };
    this.consumers.add(consumer);
    const hub = this;
    return {
      [Symbol.asyncIterator](): AsyncIterator<LogEvent> {
        return {
          async next(): Promise<IteratorResult<LogEvent>> {
            for (;;) {
              const value = consumer.queue.shift();
              if (value !== undefined) {
                return { done: false, value };
              }
              if (consumer.done) {
                hub.consumers.delete(consumer);
                return { done: true, value: undefined };
              }
              await new Promise<void>((resolve) => {
                consumer.notify = resolve;
              });
            }
          },
          async return(): Promise<IteratorResult<LogEvent>> {
            hub.consumers.delete(consumer);
            return { done: true, value: undefined };
          },
        };
      },
    };
  }

  /** Terminates all consumers after their queued events drain. */
  close(): void {
    this.closed = true;
    for (const consumer of this.consumers) {
      consumer.done = true;
      consumer.notify?.();
      consumer.notify = null;
    }
  }
}
