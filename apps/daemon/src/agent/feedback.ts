import { serializeOutput, type NihilOutput, type ProtocolErrorCode } from "@nihil/protocol";

interface OutputOptions {
  code?: ProtocolErrorCode;
  action?: number;
  path?: string;
  body?: string;
}

/**
 * Accumulates execution results as <nihil-output> elements for injection into
 * the next model turn (the SPEC §2.4 feedback loop). serializeOutput is the
 * ONLY producer of <nihil-output> strings.
 */
export class FeedbackCollector {
  readonly #outputs: NihilOutput[] = [];

  error(message: string, opts: OutputOptions = {}): void {
    this.#outputs.push({ type: "error", message, ...opts });
  }

  warning(message: string, opts: OutputOptions = {}): void {
    this.#outputs.push({ type: "warning", message, ...opts });
  }

  info(message: string, opts: OutputOptions = {}): void {
    this.#outputs.push({ type: "info", message, ...opts });
  }

  isEmpty(): boolean {
    return this.#outputs.length === 0;
  }

  list(): readonly NihilOutput[] {
    return this.#outputs;
  }

  serialize(): string {
    return this.#outputs.map(serializeOutput).join("\n");
  }
}
