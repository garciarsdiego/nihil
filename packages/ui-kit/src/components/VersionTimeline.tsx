export interface VersionEntry {
  sha: string;
  subject: string;
  messageId: string;
  time: string;
}

export interface VersionTimelineProps {
  entries: VersionEntry[];
  headSha?: string;
  emptyMessage?: string;
  onRestore?: (sha: string) => void;
}

function shortSha(sha: string): string {
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

export function VersionTimeline({
  entries,
  headSha,
  emptyMessage = "No versions yet.",
  onRestore,
}: VersionTimelineProps) {
  if (entries.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-border p-4 text-sm text-muted"
        data-testid="version-timeline-empty"
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <ol className="space-y-2" data-testid="version-timeline">
      {entries.map((entry) => {
        const isHead = headSha === entry.sha;
        return (
          <li
            key={entry.sha}
            className={`rounded-lg border px-3 py-2 ${isHead ? "border-accent/60 bg-accent/5" : "border-border bg-surface/60"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-accent">{shortSha(entry.sha)}</span>
                  {isHead ? (
                    <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-accent">
                      HEAD
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm text-text">{entry.subject}</p>
                <p className="text-xs text-muted">
                  {entry.time} · msg {entry.messageId}
                </p>
              </div>
              {!isHead && onRestore ? (
                <button
                  type="button"
                  className="shrink-0 rounded border border-border px-2 py-1 text-xs text-primary hover:bg-bg"
                  onClick={() => onRestore(entry.sha)}
                >
                  Restore
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
