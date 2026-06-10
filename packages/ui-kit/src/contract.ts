// DRAFT mirror of @nihil/daemon contracts — replaced at Task 6
// integration. Do not extend unilaterally.
export interface ActionMeta { kind: string; attrs: Record<string, string> }
export interface ProtocolError {
  code: string; severity: "error" | "warning"; message: string;
  actionId?: number; path?: string;
}
export type NihilAction =
  | { kind: "write"; path: string; content: string; description?: string }
  | { kind: "edit"; path: string; blocks: { search: string; replace: string }[]; description?: string }
  | { kind: "rename"; from: string; to: string }
  | { kind: "delete"; path: string }
  | { kind: "copy"; from: string; to: string; description?: string }
  | { kind: "add-dependency"; packages: string[] }
  | { kind: "remove-dependency"; packages: string[] }
  | { kind: "run"; workflow: string; args?: string }
  | { kind: "plan"; title: string; body: string };
export type ServerMessage =
  | { type: "turn.started"; turnId: string; messageId: string }
  | { type: "chat.delta"; turnId: string; text: string }
  | { type: "action.open"; turnId: string; actionId: number; meta: ActionMeta }
  | { type: "action.delta"; turnId: string; actionId: number; content: string }
  | { type: "action.close"; turnId: string; actionId: number; action: NihilAction;
      status: "applied" | "failed"; error?: ProtocolError }
  | { type: "config.changed"; turnId: string; actionId: number; path: string }
  | { type: "turn.warning"; turnId: string; code: string; message: string }
  | { type: "turn.finished"; turnId: string;
      outcome: "committed" | "no-changes" | "rolled-back" | "aborted";
      commitRef?: string; feedbackPending: boolean }
  | { type: "turn.error"; turnId: string; kind: string; message: string };
