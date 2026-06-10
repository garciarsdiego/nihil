export const PROTOCOL_VERSION = "1.0" as const;

export const TAG_NAMES = [
  "write",
  "edit",
  "rename",
  "delete",
  "copy",
  "add-dependency",
  "remove-dependency",
  "run",
  "plan",
] as const;

export type TagName = (typeof TAG_NAMES)[number];

/** Tags whose body is meaningful content. All others ignore their body. */
export const CONTAINER_TAGS: ReadonlySet<TagName> = new Set([
  "write",
  "edit",
  "plan",
]);

export interface SearchReplaceBlock {
  search: string;
  replace: string;
}

export type NihilAction =
  | { kind: "write"; path: string; content: string; description?: string }
  | {
      kind: "edit";
      path: string;
      blocks: SearchReplaceBlock[];
      description?: string;
    }
  | { kind: "rename"; from: string; to: string }
  | { kind: "delete"; path: string }
  | { kind: "copy"; from: string; to: string; description?: string }
  | { kind: "add-dependency"; packages: string[] }
  | { kind: "remove-dependency"; packages: string[] }
  | { kind: "run"; workflow: string; args?: string }
  | { kind: "plan"; title: string; body: string };

export interface ActionMeta {
  kind: TagName;
  attrs: Record<string, string>;
}

export type ProtocolErrorCode =
  | "PATH_FORBIDDEN"
  | "EDIT_NO_MATCH"
  | "EDIT_AMBIGUOUS"
  | "FILE_NOT_FOUND"
  | "UNKNOWN_WORKFLOW"
  | "UNKNOWN_TAG"
  | "MALFORMED_TAG"
  | "PLAN_MODE_VIOLATION"
  | "STREAM_TRUNCATED"
  | "INSTALL_FAILED"
  | "WORKFLOW_FAILED"
  | "VALIDATOR_FAILED";

export type ProtocolErrorSeverity = "error" | "warning";

export interface ProtocolError {
  code: ProtocolErrorCode;
  severity: ProtocolErrorSeverity;
  message: string;
  /** Action id within the message, when applicable. */
  actionId?: number;
  path?: string;
}

export interface ParserEvents {
  onProse(messageId: string, text: string): void;
  onActionOpen(messageId: string, actionId: number, meta: ActionMeta): void;
  onActionContent(messageId: string, actionId: number, delta: string): void;
  onActionClose(messageId: string, actionId: number, action: NihilAction): void;
  onProtocolError(messageId: string, error: ProtocolError): void;
}

export interface NihilOutput {
  type: "error" | "warning" | "info";
  message: string;
  code?: ProtocolErrorCode;
  action?: number;
  path?: string;
  body?: string;
}
