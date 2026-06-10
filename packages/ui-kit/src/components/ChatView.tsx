import { useCallback, useEffect, useRef } from "react";
import type { ChatStreamItem, ActionCardState } from "../lib/turn-reducer.js";
import { ActionCard } from "./ActionCard.js";

export interface UserMessage {
  id: string;
  role: "user";
  text: string;
}

export interface ChatViewProps {
  userMessages?: UserMessage[];
  stream: ChatStreamItem[];
  prose: string;
  actions: Map<number, ActionCardState>;
  isStreaming?: boolean;
  pinned?: boolean;
  onPinnedChange?: (pinned: boolean) => void;
  onApprovePlan?: (actionId: number) => void;
  onRejectPlan?: (actionId: number) => void;
  emptyMessage?: string;
}

export function ChatView({
  userMessages = [],
  stream,
  actions,
  isStreaming = false,
  pinned = true,
  onPinnedChange,
  onApprovePlan,
  onRejectPlan,
  emptyMessage = "Start a turn to see the assistant stream.",
}: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (pinned) scrollToBottom();
  }, [stream, actions, pinned, scrollToBottom]);

  const isEmpty = userMessages.length === 0 && stream.length === 0;

  return (
    <section className="flex h-full min-h-0 flex-col" data-testid="chat-view">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-sm font-medium text-text">Chat</h2>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => onPinnedChange?.(e.target.checked)}
          />
          Pin scroll
        </label>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {isEmpty ? (
          <p className="text-sm text-muted" data-testid="chat-empty">
            {emptyMessage}
          </p>
        ) : null}

        {userMessages.map((msg) => (
          <div key={msg.id} className="flex justify-end" data-testid="user-message">
            <div className="max-w-[85%] rounded-lg bg-primary/20 px-3 py-2 text-sm text-text">
              {msg.text}
            </div>
          </div>
        ))}

        {stream.map((item) => {
          if (item.type === "prose") {
            return (
              <div key={item.id} className="text-sm text-text whitespace-pre-wrap" data-testid="chat-prose">
                {item.text}
                {isStreaming && item === stream[stream.length - 1] ? (
                  <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-accent align-middle" />
                ) : null}
              </div>
            );
          }
          const action = actions.get(item.actionId);
          if (!action) return null;
          return (
            <ActionCard
              key={`action-${item.actionId}`}
              state={action}
              onApprovePlan={onApprovePlan}
              onRejectPlan={onRejectPlan}
            />
          );
        })}

        <div ref={bottomRef} />
      </div>
    </section>
  );
}
