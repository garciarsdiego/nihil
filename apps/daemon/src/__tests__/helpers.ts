import type { LogEvent } from "../exec/target.js";

/** Pulls events from an AsyncIterable until the predicate matches or the
 * deadline passes. Always releases the iterator. */
export async function findEvent(
  iterable: AsyncIterable<LogEvent>,
  predicate: (event: LogEvent) => boolean,
  timeoutMs = 5000,
): Promise<LogEvent> {
  const iterator = iterable[Symbol.asyncIterator]();
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      const remaining = Math.max(1, deadline - Date.now());
      const result = await Promise.race([
        iterator.next(),
        new Promise<"timeout">((resolve) => {
          const timer = setTimeout(() => resolve("timeout"), remaining);
          timer.unref();
        }),
      ]);
      if (result === "timeout" || result.done === true) {
        break;
      }
      if (predicate(result.value)) {
        return result.value;
      }
    }
    throw new Error("expected log event not found within deadline");
  } finally {
    await iterator.return?.();
  }
}

/** Takes exactly `count` events (throws on early termination or deadline). */
export async function takeEvents(
  iterable: AsyncIterable<LogEvent>,
  count: number,
  timeoutMs = 5000,
): Promise<LogEvent[]> {
  const iterator = iterable[Symbol.asyncIterator]();
  const deadline = Date.now() + timeoutMs;
  const events: LogEvent[] = [];
  try {
    while (events.length < count && Date.now() < deadline) {
      const remaining = Math.max(1, deadline - Date.now());
      const result = await Promise.race([
        iterator.next(),
        new Promise<"timeout">((resolve) => {
          const timer = setTimeout(() => resolve("timeout"), remaining);
          timer.unref();
        }),
      ]);
      if (result === "timeout" || result.done === true) {
        break;
      }
      events.push(result.value);
    }
    if (events.length < count) {
      throw new Error(`expected ${count} events, got ${events.length}`);
    }
    return events;
  } finally {
    await iterator.return?.();
  }
}

export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Polls every 100ms until the condition holds; throws past the deadline. */
export async function pollUntil(
  condition: () => boolean,
  timeoutMs = 8000,
  label = "condition",
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label} not met within ${timeoutMs}ms`);
}
