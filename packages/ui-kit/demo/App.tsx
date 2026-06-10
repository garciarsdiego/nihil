import { useCallback, useMemo, useRef, useState } from "react";
import {
  ChatView,
  ConfigChangedBadge,
  PreviewPane,
  TurnStatusBar,
  VersionTimeline,
  createEventPlayer,
  createInitialChatState,
  reduceServerMessage,
  SCENARIOS,
  type ScenarioId,
  type VersionEntry,
  type DeviceFrame,
} from "../src/index.js";

const DEMO_VERSIONS: VersionEntry[] = [
  {
    sha: "a1b2c3d4e5f6789012345678abcdef0123456789",
    subject: "feat: hero section",
    messageId: "msg-1",
    time: "2 min ago",
  },
  {
    sha: "ff00aa11bb22cc33dd44ee55ff00aa11bb22cc33",
    subject: "chore: workflow config",
    messageId: "msg-3",
    time: "1 hr ago",
  },
  {
    sha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    subject: "init: vite template",
    messageId: "msg-0",
    time: "yesterday",
  },
];

export function App() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("happy-multi-file");
  const [speed, setSpeed] = useState(1);
  const [pinned, setPinned] = useState(true);
  const [chatState, setChatState] = useState(createInitialChatState);
  const [dismissedConfig, setDismissedConfig] = useState<Set<number>>(new Set());
  const [deviceFrame, setDeviceFrame] = useState<DeviceFrame>("none");
  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "ready" | "error">("ready");
  const [planLog, setPlanLog] = useState<string | null>(null);
  const playerRef = useRef(createEventPlayer({ events: [] }));

  const scenario = useMemo(
    () => SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!,
    [scenarioId],
  );

  const playScenario = useCallback(() => {
    setChatState(createInitialChatState());
    setDismissedConfig(new Set());
    setPlanLog(null);
    setPreviewStatus("loading");

    const player = createEventPlayer({
      events: scenario.events,
      delayMs: 350,
      onEvent: (message) => {
        setChatState((prev) => reduceServerMessage(prev, message));
      },
      onComplete: () => setPreviewStatus("ready"),
    });
    player.setSpeed(speed);
    playerRef.current = player;
    player.play();
  }, [scenario, speed]);

  const visibleConfigChanges = chatState.turn.configChanges.filter(
    (c) => !dismissedConfig.has(c.actionId),
  );

  const headSha =
    chatState.turn.commitRef ??
    (chatState.turn.phase === "finished" ? DEMO_VERSIONS[0]?.sha : undefined);

  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold tracking-wide">Nihil Shell · UI Kit Demo</h1>
        <select
          className="rounded border border-border bg-surface px-2 py-1 text-sm"
          value={scenarioId}
          onChange={(e) => setScenarioId(e.target.value as ScenarioId)}
        >
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-muted">
          Speed
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.5}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
          {speed}x
        </label>
        <button
          type="button"
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-bg"
          onClick={playScenario}
        >
          Play scenario
        </button>
        <button
          type="button"
          className="rounded border border-border px-3 py-1.5 text-xs"
          onClick={() => playerRef.current.pause()}
        >
          Pause
        </button>
        <button
          type="button"
          className="rounded border border-border px-3 py-1.5 text-xs"
          onClick={() => playerRef.current.resume()}
        >
          Resume
        </button>
        {planLog ? <span className="text-xs text-accent">{planLog}</span> : null}
      </header>

      <p className="border-b border-border px-4 py-2 text-xs text-muted">{scenario.description}</p>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="min-h-0 flex-1 rounded-lg border border-border bg-surface/40">
            <ChatView
              userMessages={[{ id: "u1", role: "user", text: scenario.userPrompt }]}
              stream={chatState.stream}
              prose={chatState.prose}
              actions={chatState.actions}
              isStreaming={chatState.turn.phase === "streaming"}
              pinned={pinned}
              onPinnedChange={setPinned}
              onApprovePlan={(id) => setPlanLog(`Plan ${id} approved`)}
              onRejectPlan={(id) => setPlanLog(`Plan ${id} rejected`)}
            />
          </div>

          {visibleConfigChanges.map((change) => (
            <ConfigChangedBadge
              key={change.actionId}
              path={change.path}
              onDismiss={() =>
                setDismissedConfig((prev) => new Set(prev).add(change.actionId))
              }
            />
          ))}

          <TurnStatusBar turn={chatState.turn} />
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <div className="min-h-[280px] flex-1">
            <PreviewPane
              src="about:blank"
              urlLabel="http://localhost:5173/"
              deviceFrame={deviceFrame}
              status={previewStatus}
              onReload={() => {
                setPreviewStatus("loading");
                window.setTimeout(() => setPreviewStatus("ready"), 600);
              }}
              onToggleDeviceFrame={setDeviceFrame}
            />
          </div>
          <VersionTimeline
            entries={DEMO_VERSIONS}
            headSha={headSha}
            onRestore={(sha) => setPlanLog(`Restore requested: ${sha.slice(0, 7)}`)}
          />
        </div>
      </div>
    </div>
  );
}
