export const RUNNER_ABORT_ERROR = "RunnerAbortError";

export function runnerAbortError(): Error {
  const error = new Error("message cancelled before it started");
  error.name = RUNNER_ABORT_ERROR;
  return error;
}

interface Waiter {
  resolve: () => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

/**
 * Per-project serialization (DECISIONS #18): one message in flight at a time;
 * the git transaction is non-reentrant on a shared working tree. A queued
 * acquirer whose signal aborts is cancelled outright (rejects) and removed from
 * the queue; the running message handles its own abort by rolling back.
 */
export class ProjectLock {
  #locked = false;
  #waiters: Waiter[] = [];

  acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      return Promise.reject(runnerAbortError());
    }
    if (!this.#locked) {
      this.#locked = true;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = { resolve, reject, signal };
      if (signal !== undefined) {
        waiter.onAbort = () => {
          const i = this.#waiters.indexOf(waiter);
          if (i !== -1) {
            this.#waiters.splice(i, 1);
          }
          reject(runnerAbortError());
        };
        signal.addEventListener("abort", waiter.onAbort, { once: true });
      }
      this.#waiters.push(waiter);
    });
  }

  release(): void {
    const next = this.#waiters.shift();
    if (next === undefined) {
      this.#locked = false;
      return;
    }
    if (next.onAbort !== undefined && next.signal !== undefined) {
      next.signal.removeEventListener("abort", next.onAbort);
    }
    next.resolve();
  }
}
