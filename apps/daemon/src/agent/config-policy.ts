import type { NihilAction } from "@nihil/protocol";

/** The model-writable file that redefines named workflows (DECISIONS #14). */
export const WORKFLOW_CONFIG_PATH = "nihil.config.json";

/** Daemon-only namespace (crash-recovery marker lives here). Model file
 * actions must not touch it — a write could forge .nihil/txn.json. */
export const RESERVED_DIR = ".nihil";

function isReserved(path: string): boolean {
  return path === RESERVED_DIR || path.startsWith(`${RESERVED_DIR}/`);
}

/** True when a file action targets the reserved .nihil/ namespace (any of its
 * paths). Paths are already normalized by the parser. */
export function touchesReservedNamespace(action: NihilAction): boolean {
  switch (action.kind) {
    case "write":
    case "edit":
    case "delete":
      return isReserved(action.path);
    case "rename":
    case "copy":
      return isReserved(action.from) || isReserved(action.to);
    default:
      return false;
  }
}

/**
 * True when an action creates, rewrites, moves, or removes nihil.config.json —
 * i.e. when it could redefine what `<nihil-run>` executes. Paths are already
 * normalized by the parser, so exact comparison is sufficient.
 */
export function touchesWorkflowConfig(action: NihilAction): boolean {
  switch (action.kind) {
    case "write":
    case "edit":
    case "delete":
      return action.path === WORKFLOW_CONFIG_PATH;
    case "rename":
    case "copy":
      return action.from === WORKFLOW_CONFIG_PATH || action.to === WORKFLOW_CONFIG_PATH;
    default:
      return false;
  }
}

/** The config-relevant path an action touches, for feedback/observer payloads. */
export function configPathOf(action: NihilAction): string {
  if (action.kind === "rename" || action.kind === "copy") {
    return action.to === WORKFLOW_CONFIG_PATH ? action.to : action.from;
  }
  return WORKFLOW_CONFIG_PATH;
}
