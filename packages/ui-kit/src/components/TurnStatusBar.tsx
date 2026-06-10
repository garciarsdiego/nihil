import type { TurnUIState } from "../lib/turn-reducer.js";

export interface TurnStatusBarProps {
  turn: TurnUIState;
}

function phaseLabel(turn: TurnUIState): string {
  switch (turn.phase) {
    case "idle":
      return "Idle";
    case "streaming":
      return "Streaming";
    case "applying":
      return "Applying changes";
    case "finished":
      return turn.outcome ? `Finished · ${turn.outcome}` : "Finished";
    case "error":
      return "Turn error";
    default: {
      const _exhaustive: never = turn.phase;
      return _exhaustive;
    }
  }
}

function shortSha(ref: string): string {
  return ref.length > 7 ? ref.slice(0, 7) : ref;
}

export function TurnStatusBar({ turn }: TurnStatusBarProps) {
  const showCommit = turn.phase === "finished" && turn.commitRef;

  return (
    <footer
      className="border-t border-border bg-surface px-4 py-2 text-sm"
      data-testid="turn-status-bar"
      data-phase={turn.phase}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium text-text">{phaseLabel(turn)}</span>
        {showCommit ? (
          <span
            className="rounded bg-bg px-2 py-0.5 font-mono text-xs text-accent"
            title={turn.commitRef}
          >
            {shortSha(turn.commitRef!)}
          </span>
        ) : null}
        {turn.feedbackPending ? (
          <span className="text-xs text-warning">Feedback pending</span>
        ) : null}
      </div>

      {turn.warnings.length > 0 ? (
        <ul className="mt-2 space-y-1" data-testid="turn-warnings">
          {turn.warnings.map((w) => (
            <li key={`${w.code}-${w.message}`} className="text-xs text-warning">
              <span className="font-mono">{w.code}</span> — {w.message}
            </li>
          ))}
        </ul>
      ) : null}

      {turn.error ? (
        <div
          className="mt-2 rounded border border-danger/50 bg-danger/10 px-3 py-2 text-xs text-danger"
          data-testid="turn-error"
          role="alert"
        >
          <span className="font-mono">{turn.error.kind}</span> — {turn.error.message}
        </div>
      ) : null}
    </footer>
  );
}
