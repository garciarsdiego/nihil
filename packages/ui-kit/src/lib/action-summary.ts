import type { NihilAction, ProtocolError } from "../contract.js";

export function countLines(text: string): number {
  if (text.length === 0) return 0;
  return text.split("\n").length;
}

export function actionSummary(action: NihilAction, streamedContent: string): string {
  switch (action.kind) {
    case "write":
      return `${action.path} · +${countLines(action.content || streamedContent)} lines`;
    case "edit":
      return `${action.path} · ${action.blocks.length} edit${action.blocks.length === 1 ? "" : "s"}`;
    case "rename":
      return `${action.from} → ${action.to}`;
    case "delete":
      return `Removed ${action.path}`;
    case "copy":
      return `${action.from} → ${action.to}`;
    case "add-dependency":
      return `Added ${action.packages.join(", ")}`;
    case "remove-dependency":
      return `Removed ${action.packages.join(", ")}`;
    case "run":
      return action.args ? `${action.workflow} ${action.args}` : action.workflow;
    case "plan":
      return action.title;
    default: {
      const _exhaustive: never = action;
      return String(_exhaustive);
    }
  }
}

export function isCompactAction(action: NihilAction): boolean {
  return (
    action.kind === "rename" ||
    action.kind === "delete" ||
    action.kind === "copy" ||
    action.kind === "add-dependency" ||
    action.kind === "remove-dependency" ||
    action.kind === "run"
  );
}

export function actionPathLabel(action: NihilAction, metaKind?: string): string {
  const kind = action.kind ?? metaKind ?? "action";
  switch (action.kind) {
    case "write":
    case "edit":
    case "delete":
      return action.path;
    case "rename":
      return action.from;
    case "copy":
      return action.to;
    case "add-dependency":
    case "remove-dependency":
      return kind;
    case "run":
      return action.workflow;
    case "plan":
      return action.title;
    default:
      return kind;
  }
}

export function formatProtocolError(error: ProtocolError): string {
  return `${error.code}: ${error.message}`;
}
