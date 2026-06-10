export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface EngineRequest {
  system: string;
  messages: ChatMessage[];
  /** Override the engine's configured model / max tokens for this request. */
  model?: string;
  maxTokens?: number;
}

export type EngineFinishReason = "stop" | "length" | "content_filter" | "tool_calls" | "unknown";

/**
 * Forward-compatible engine event union. M1 mode 2 (BYOK) emits text/done.
 * M2 mode 1 (ACP) will add `file_change` / `tool_call` / `thinking` variants;
 * a consumer that only handles text/done keeps working (DECISIONS #22).
 */
export type EngineEvent =
  | { type: "text"; delta: string }
  | { type: "done"; finishReason: EngineFinishReason };

export interface EngineCapabilities {
  /** mode 2 (BYOK): the model emits <nihil-*> tags the host parses and applies.
   * mode 1 (ACP, M2): the agent applies edits itself; the host supervises. */
  editsViaProtocol: boolean;
}

export interface Engine {
  readonly capabilities: EngineCapabilities;
  stream(request: EngineRequest, opts?: { signal?: AbortSignal }): AsyncIterable<EngineEvent>;
}

export function normalizeFinishReason(value: string): EngineFinishReason {
  switch (value) {
    case "stop":
    case "length":
    case "content_filter":
    case "tool_calls":
      return value;
    default:
      return "unknown";
  }
}
