import type { ActionMeta } from "@nihil/protocol";
import type { ActionOutcome } from "./types.js";

/**
 * Transport-agnostic sink for runner events. The desktop shell binds these to
 * WS messages in Task 6 (envelope reusing @nihil/protocol types — DECISIONS
 * #8); the runner itself never knows about transport.
 */
export interface RunnerObserver {
  onProse?(messageId: string, text: string): void;
  onActionStart?(messageId: string, actionId: number, meta: ActionMeta): void;
  onActionResult?(messageId: string, outcome: ActionOutcome): void;
  /** A nihil.config.json change — the shell badges the action card (DECISIONS #14). */
  onConfigChange?(messageId: string, info: { actionId: number; path: string }): void;
  onPlan?(messageId: string, plan: { title: string; body: string }): void;
  onCommit?(messageId: string, ref: string): void;
}
