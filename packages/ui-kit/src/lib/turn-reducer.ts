import type {
  ActionMeta,
  NihilAction,
  ProtocolError,
  ServerMessage,
} from "../contract.js";

export type TurnPhase = "idle" | "streaming" | "applying" | "finished" | "error";

export interface TurnUIState {
  turnId: string | null;
  messageId: string | null;
  phase: TurnPhase;
  outcome?: "committed" | "no-changes" | "rolled-back" | "aborted";
  commitRef?: string;
  feedbackPending?: boolean;
  warnings: { code: string; message: string }[];
  error?: { kind: string; message: string };
  configChanges: { actionId: number; path: string }[];
}

export type ChatStreamItem =
  | { type: "prose"; id: string; text: string }
  | { type: "action"; actionId: number };

export interface ActionCardState {
  actionId: number;
  phase: "open" | "streaming" | "closed";
  meta?: ActionMeta;
  content: string;
  action?: NihilAction;
  status?: "applied" | "failed";
  error?: ProtocolError;
}

export interface ChatReducerState {
  turn: TurnUIState;
  prose: string;
  stream: ChatStreamItem[];
  actions: Map<number, ActionCardState>;
  openActionCount: number;
}

export function createInitialChatState(): ChatReducerState {
  return {
    turn: {
      turnId: null,
      messageId: null,
      phase: "idle",
      warnings: [],
      configChanges: [],
    },
    prose: "",
    stream: [],
    actions: new Map(),
    openActionCount: 0,
  };
}

function upsertProse(state: ChatReducerState, delta: string): ChatReducerState {
  const nextProse = state.prose + delta;
  const last = state.stream[state.stream.length - 1];
  if (last?.type === "prose") {
    const stream = [...state.stream];
    stream[stream.length - 1] = { type: "prose", id: last.id, text: nextProse };
    return { ...state, prose: nextProse, stream };
  }
  return {
    ...state,
    prose: nextProse,
    stream: [...state.stream, { type: "prose", id: `prose-${state.stream.length}`, text: nextProse }],
  };
}

export function reduceServerMessage(
  state: ChatReducerState,
  message: ServerMessage,
): ChatReducerState {
  switch (message.type) {
    case "turn.started":
      return {
        ...createInitialChatState(),
        turn: {
          turnId: message.turnId,
          messageId: message.messageId,
          phase: "streaming",
          warnings: [],
          configChanges: [],
        },
      };
    case "chat.delta":
      return upsertProse(state, message.text);
    case "action.open": {
      const actions = new Map(state.actions);
      actions.set(message.actionId, {
        actionId: message.actionId,
        phase: "open",
        meta: message.meta,
        content: "",
      });
      const last = state.stream.at(-1);
      const stream: ChatStreamItem[] =
        last?.type === "action" && last.actionId === message.actionId
          ? state.stream
          : [...state.stream, { type: "action" as const, actionId: message.actionId }];
      return {
        ...state,
        actions,
        stream,
        openActionCount: state.openActionCount + 1,
        turn: { ...state.turn, phase: "streaming" },
      };
    }
    case "action.delta": {
      const actions = new Map(state.actions);
      const existing = actions.get(message.actionId);
      if (!existing) return state;
      actions.set(message.actionId, {
        ...existing,
        phase: "streaming",
        content: existing.content + message.content,
      });
      return { ...state, actions, turn: { ...state.turn, phase: "streaming" } };
    }
    case "action.close": {
      const actions = new Map(state.actions);
      const existing = actions.get(message.actionId);
      if (!existing) return state;
      actions.set(message.actionId, {
        ...existing,
        phase: "closed",
        action: message.action,
        status: message.status,
        error: message.error,
      });
      const openActionCount = Math.max(0, state.openActionCount - 1);
      const phase =
        state.turn.phase === "finished" || state.turn.phase === "error"
          ? state.turn.phase
          : openActionCount > 0
            ? "applying"
            : "applying";
      return {
        ...state,
        actions,
        openActionCount,
        turn: {
          ...state.turn,
          phase,
        },
      };
    }
    case "config.changed":
      return {
        ...state,
        turn: {
          ...state.turn,
          configChanges: [
            ...state.turn.configChanges,
            { actionId: message.actionId, path: message.path },
          ],
        },
      };
    case "turn.warning":
      return {
        ...state,
        turn: {
          ...state.turn,
          warnings: [...state.turn.warnings, { code: message.code, message: message.message }],
        },
      };
    case "turn.finished":
      return {
        ...state,
        turn: {
          ...state.turn,
          phase: "finished",
          outcome: message.outcome,
          commitRef: message.commitRef,
          feedbackPending: message.feedbackPending,
        },
      };
    case "turn.error":
      return {
        ...state,
        turn: {
          ...state.turn,
          phase: "error",
          error: { kind: message.kind, message: message.message },
        },
      };
    default: {
      const _exhaustive: never = message;
      void _exhaustive;
      return state;
    }
  }
}

export function reduceServerMessages(messages: ServerMessage[]): ChatReducerState {
  return messages.reduce(reduceServerMessage, createInitialChatState());
}
