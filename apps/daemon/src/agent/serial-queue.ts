/**
 * Runs jobs one at a time in submission order. The streaming parser fires
 * onActionClose synchronously, but target file ops are async; enqueuing each
 * file action here preserves stream order (edit N sees write N-1's result)
 * while letting parse() return immediately.
 */
export class SerialQueue {
  #tail: Promise<unknown> = Promise.resolve();

  run<T>(job: () => Promise<T>): Promise<T> {
    const result = this.#tail.then(() => job());
    // The chain must survive a rejected job so later jobs still run; callers
    // are responsible for catching their own job errors.
    this.#tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Resolves once every job submitted so far has settled. */
  idle(): Promise<void> {
    return this.#tail.then(
      () => undefined,
      () => undefined,
    );
  }
}
