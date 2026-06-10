export type DeviceFrame = "none" | "phone";

export interface PreviewPaneProps {
  src?: string;
  urlLabel?: string;
  deviceFrame?: DeviceFrame;
  status?: "idle" | "loading" | "ready" | "error";
  errorMessage?: string;
  onReload?: () => void;
  onToggleDeviceFrame?: (frame: DeviceFrame) => void;
}

export function PreviewPane({
  src,
  urlLabel,
  deviceFrame = "none",
  status = "idle",
  errorMessage,
  onReload,
  onToggleDeviceFrame,
}: PreviewPaneProps) {
  const displayUrl = urlLabel ?? src ?? "about:blank";

  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-surface"
      data-testid="preview-pane"
      data-status={status}
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="truncate font-mono text-xs text-muted flex-1">{displayUrl}</span>
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-xs text-text hover:bg-bg"
          onClick={onReload}
          disabled={!onReload}
        >
          Reload
        </button>
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-xs text-text hover:bg-bg"
          onClick={() =>
            onToggleDeviceFrame?.(deviceFrame === "phone" ? "none" : "phone")
          }
          disabled={!onToggleDeviceFrame}
        >
          {deviceFrame === "phone" ? "Desktop" : "Phone"}
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center overflow-hidden bg-bg p-4">
        {status === "loading" ? (
          <div className="text-center text-sm text-muted" data-testid="preview-loading">
            <span className="mb-2 inline-block size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p>Loading preview…</p>
          </div>
        ) : null}

        {status === "error" ? (
          <div
            className="max-w-sm text-center text-sm text-danger"
            data-testid="preview-error"
            role="alert"
          >
            <p className="font-medium">Preview unavailable</p>
            <p className="mt-1 text-xs text-muted">{errorMessage ?? "Failed to load preview."}</p>
          </div>
        ) : null}

        {status === "idle" && !src ? (
          <p className="text-sm text-muted" data-testid="preview-empty">
            No preview URL yet.
          </p>
        ) : null}

        {(status === "ready" || (status === "idle" && src)) && src ? (
          <div
            className={
              deviceFrame === "phone"
                ? "h-[844px] w-[390px] max-h-full max-w-full overflow-hidden rounded-[2rem] border-4 border-border bg-surface shadow-lg"
                : "h-full w-full"
            }
          >
            <iframe
              title="App preview"
              src={src}
              className="h-full w-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
