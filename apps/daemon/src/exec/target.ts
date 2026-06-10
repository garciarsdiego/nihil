/**
 * ExecutionTarget — the hybrid-sandbox seam (technical-spec §5, DECISIONS #12).
 *
 * Implementations: local-process (default, this milestone), local-docker,
 * iframe-lite, cloud/* (later tiers). The runner executes every model action
 * through this interface so paths funnel through `normalizeProjectPath` and
 * targets stay swappable.
 *
 * Security note: `exec()` accepts raw command strings because this layer sits
 * BELOW the protocol security boundary. The runner only ever passes
 * `WorkflowRef` for model-initiated actions (SPEC §4.5 — named workflows
 * only); raw strings exist for the user-toggled capability and internal use.
 */
import type { ProtocolErrorCode } from "@nihil/protocol";

export type FrameworkKind = "vite" | "nextjs" | "other";

export interface TemplateRef {
  name: string;
}

/** Project-relative path → full file content. */
export type FileMap = Readonly<Record<string, string>>;

export interface WorkflowRef {
  workflow: string;
  args?: string;
}

export interface LogEvent {
  source: "stdout" | "stderr" | "system";
  text: string;
  timestamp: number;
  /** Workflow name (or "(raw)") that emitted the event, when process-bound. */
  workflow?: string;
  pid?: number;
}

export interface ProcessExit {
  code: number | null;
  signal: string | null;
}

export interface ProcessHandle {
  /** Undefined until the underlying process has spawned (startup is async). */
  readonly pid: number | undefined;
  readonly command: string;
  readonly logs: AsyncIterable<LogEvent>;
  /** Resolves on process exit; rejects with TargetError on startup failure. */
  readonly exited: Promise<ProcessExit>;
  kill(): Promise<void>;
}

export interface Result {
  ok: boolean;
  exitCode: number | null;
  logTail: string;
}

export interface SnapshotRef {
  kind: "git";
  ref: string;
}

/**
 * Codes for target failures. Protocol-level concepts reuse the stable
 * `ProtocolErrorCode` enum (DECISIONS #8) so the runner can serialize them
 * via `serializeOutput` without translation; the rest are daemon-level
 * conditions that never reach the model verbatim.
 */
export type TargetErrorCode =
  | ProtocolErrorCode
  | "CONFIG_INVALID"
  | "NO_FREE_PORT"
  | "PREVIEW_UNAVAILABLE"
  | "READY_TIMEOUT"
  | "TARGET_DESTROYED"
  | "TEMPLATE_NOT_FOUND";

export class TargetError extends Error {
  readonly code: TargetErrorCode;

  constructor(code: TargetErrorCode, message: string) {
    super(message);
    this.name = "TargetError";
    this.code = code;
  }
}

export interface ExecutionTarget {
  init(template: TemplateRef): Promise<void>;
  readFile(path: string): Promise<string>;
  writeFiles(files: FileMap): Promise<void>;
  deleteFile(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  /**
   * Recursive listing of project-relative paths (forward slashes, sorted),
   * excluding node_modules, .git, and build artifacts.
   */
  listFiles(prefix?: string): Promise<string[]>;
  exec(cmd: WorkflowRef | string): ProcessHandle;
  installPackages(pkgs: string[]): Promise<Result>;
  getPreviewUrl(): Promise<string>;
  streamLogs(): AsyncIterable<LogEvent>;
  snapshot(): Promise<SnapshotRef>;
  destroy(): Promise<void>;
}
