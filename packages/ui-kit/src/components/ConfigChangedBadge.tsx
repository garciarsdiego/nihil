export interface ConfigChangedBadgeProps {
  path: string;
  onDismiss?: () => void;
}

export function ConfigChangedBadge({ path, onDismiss }: ConfigChangedBadgeProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm"
      data-testid="config-changed-badge"
    >
      <span className="text-warning" aria-hidden>
        ⚠
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-warning">Workflow configuration changed</p>
        <p className="font-mono text-xs text-text truncate">{path}</p>
      </div>
      {onDismiss ? (
        <button
          type="button"
          className="shrink-0 text-xs text-muted hover:text-text"
          aria-label="Dismiss configuration change alert"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
