import type { ProtocolErrorCode } from "@nihil/protocol";

/** Outcome of a single action within a message, in stream order. */
export interface ActionOutcome {
  actionId: number;
  kind: string;
  ok: boolean;
  code?: ProtocolErrorCode;
  path?: string;
}

export interface MessageResult {
  /** A commit was created (false when nothing changed or the message rolled back). */
  committed: boolean;
  commitRef?: string;
  rolledBack: boolean;
  outcomes: ActionOutcome[];
  /** Concatenated <nihil-output> for the next model turn ("" when no feedback). */
  feedback: string;
  /** A write/edit/rename/copy/delete touched nihil.config.json this message. */
  configChanged: boolean;
}
