import { useState } from "react";
import type { ActionCardState } from "../lib/turn-reducer.js";
import {
  actionPathLabel,
  actionSummary,
  formatProtocolError,
  isCompactAction,
} from "../lib/action-summary.js";

export interface ActionCardProps {
  state: ActionCardState;
  onApprovePlan?: (actionId: number) => void;
  onRejectPlan?: (actionId: number) => void;
}

const KIND_ICONS: Record<string, string> = {
  write: "✎",
  edit: "◇",
  rename: "↦",
  delete: "✕",
  copy: "⧉",
  "add-dependency": "+",
  "remove-dependency": "−",
  run: "▶",
  plan: "☰",
};

function kindIcon(kind: string): string {
  return KIND_ICONS[kind] ?? "•";
}

const LINE_CLAMP = 6;

export function ActionCard({ state, onApprovePlan, onRejectPlan }: ActionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [errorExpanded, setErrorExpanded] = useState(false);
  const kind = state.meta?.kind ?? state.action?.kind ?? "action";
  const compact = state.action ? isCompactAction(state.action) : false;
  const pathLabel = state.action
    ? actionPathLabel(state.action, state.meta?.kind)
    : state.meta?.attrs.path ?? kind;

  if (state.phase === "open") {
    return (
      <article
        className="rounded-lg border border-border bg-surface/80 p-3"
        data-testid={`action-card-${state.actionId}`}
        data-phase="open"
      >
        <header className="flex items-center gap-2 text-sm">
          <span className="text-primary" aria-hidden>
            {kindIcon(kind)}
          </span>
          <span className="font-mono text-text truncate">{pathLabel}</span>
          <span className="ml-auto inline-flex items-center gap-1 text-muted text-xs">
            <span className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Opening…
          </span>
        </header>
        {state.meta?.attrs.description ? (
          <p className="mt-2 text-xs text-muted">{state.meta.attrs.description}</p>
        ) : null}
      </article>
    );
  }

  if (state.phase === "streaming" && state.action?.kind !== "plan") {
    const lines = state.content.split("\n");
    const clamped = !expanded && lines.length > LINE_CLAMP;
    const visible = clamped ? lines.slice(0, LINE_CLAMP).join("\n") : state.content;

    return (
      <article
        className="rounded-lg border border-primary/40 bg-surface p-3"
        data-testid={`action-card-${state.actionId}`}
        data-phase="streaming"
      >
        <header className="mb-2 flex items-center gap-2 text-sm">
          <span className="text-primary" aria-hidden>
            {kindIcon(kind)}
          </span>
          <span className="font-mono text-text truncate">{pathLabel}</span>
          <span className="ml-auto text-xs text-accent">Streaming</span>
        </header>
        <pre className="max-h-48 overflow-auto rounded bg-bg/80 p-2 font-mono text-xs text-text whitespace-pre-wrap">
          {visible}
          {clamped ? "\n…" : ""}
        </pre>
        {lines.length > LINE_CLAMP ? (
          <button
            type="button"
            className="mt-2 text-xs text-primary hover:underline"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Collapse" : `Expand (${lines.length} lines)`}
          </button>
        ) : null}
      </article>
    );
  }

  if (state.action?.kind === "plan" && state.phase !== "closed") {
    return (
      <article
        className="rounded-lg border border-accent/50 bg-surface p-4"
        data-testid={`action-card-${state.actionId}`}
        data-phase="plan"
      >
        <header className="mb-2 text-sm font-medium text-text">{state.action.title}</header>
        <div className="prose prose-invert max-w-none text-sm text-muted whitespace-pre-wrap">
          {state.content || state.action.body}
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-bg"
            onClick={() => onApprovePlan?.(state.actionId)}
          >
            Approve plan
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-text"
            onClick={() => onRejectPlan?.(state.actionId)}
          >
            Reject
          </button>
        </div>
      </article>
    );
  }

  if (state.phase === "closed" && state.status === "applied" && state.action) {
    const summary = actionSummary(state.action, state.content);
    return (
      <article
        className={`rounded-lg border border-success/30 bg-surface/60 ${compact ? "p-2" : "p-3"}`}
        data-testid={`action-card-${state.actionId}`}
        data-phase="closed-applied"
      >
        <header className="flex items-center gap-2 text-sm">
          <span className="text-success" aria-hidden>
            ✓
          </span>
          <span className="text-primary" aria-hidden>
            {kindIcon(state.action.kind)}
          </span>
          <span className="font-mono text-text truncate">{summary}</span>
        </header>
      </article>
    );
  }

  if (state.phase === "closed" && state.status === "failed") {
    const code = state.error?.code ?? "ERROR";
    const message = state.error?.message ?? "Action failed";
    return (
      <article
        className="rounded-lg border border-danger/40 bg-surface p-3"
        data-testid={`action-card-${state.actionId}`}
        data-phase="closed-failed"
      >
        <header className="flex items-start gap-2 text-sm">
          <span className="text-danger" aria-hidden>
            ✕
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-danger">{code}</p>
            <p className="text-text">{message}</p>
          </div>
        </header>
        {state.error ? (
          <button
            type="button"
            className="mt-2 text-xs text-muted hover:text-text"
            onClick={() => setErrorExpanded((v) => !v)}
          >
            {errorExpanded ? "Hide detail" : "Show detail"}
          </button>
        ) : null}
        {errorExpanded && state.error ? (
          <pre className="mt-2 rounded bg-bg p-2 font-mono text-xs text-muted">
            {formatProtocolError(state.error)}
            {state.error.path ? `\npath: ${state.error.path}` : ""}
          </pre>
        ) : null}
      </article>
    );
  }

  return (
    <article
      className="rounded-lg border border-border bg-surface/40 p-3 text-sm text-muted"
      data-testid={`action-card-${state.actionId}`}
      data-phase="unknown"
    >
      Waiting for action data…
    </article>
  );
}
