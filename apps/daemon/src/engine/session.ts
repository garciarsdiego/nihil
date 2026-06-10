import type { ChatMessage } from "./types.js";

/**
 * In-memory conversation state for one builder session (DECISIONS #23). The
 * durable artifact is the git history; the Nihil-Message-Id commit trailer
 * links commits back to messages for a later SQLite-backed store.
 */
export interface Session {
  messages: ChatMessage[];
  /** Serialized <nihil-output> from the previous turn, prepended to the next
   * user message (the SPEC §2.4 feedback loop). */
  pendingOutput: string;
}

export function createSession(): Session {
  return { messages: [], pendingOutput: "" };
}
