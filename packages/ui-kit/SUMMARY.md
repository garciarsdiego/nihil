# UI Kit — Lane 5 Summary

## Self-review checklist

- [x] `git diff --stat origin/main` shows only `packages/ui-kit`
- [x] Zero network/Tauri/daemon imports (grep evidence below)
- [x] `contract.ts` matches brief verbatim + header comment
- [x] Every component handles its full state set (incl. error/empty)
- [x] Demo app plays all scripted scenarios (5 scenarios in `scenarios.ts`)
- [x] Build, lint, typecheck, tests green (outputs below)

## Contract gap flags

| Need | Status |
|------|--------|
| Explicit `+lines` on `action.close` | **Gap** — derived from `action.content` / streamed `action.delta` in `action-summary.ts`; flagged here per AGENTS.md |
| User chat messages in `ServerMessage` | **Gap** — `ChatView` accepts `userMessages` prop outside the draft WS contract |
| Version timeline data in `ServerMessage` | **Gap** — `VersionTimeline` uses `{sha, subject, messageId, time}` props (shell-owned history) |
| Preview URL / load events | **Gap** — `PreviewPane` is chrome-only with `src` + local `status` props |

## Grep evidence (no transport imports)

```text
rg "fetch\\(|WebSocket|@tauri|from ['\\\"]@nihil/daemon" packages/ui-kit/src
→ no matches (comment-only reference in contract.ts header)
```

## Verification outputs

### typecheck

```
> tsc --noEmit -p tsconfig.json
(exit 0)
```

### lint

```
> eslint src demo
(exit 0)
```

### test

```
 Test Files  3 passed (3)
      Tests  12 passed (12)
```

### build

```
dist/index.js  30.36 kB │ gzip: 6.94 kB
✓ built in ~2.2s
```

## Demo

```bash
cd packages/ui-kit && npm run demo
```

Use the scenario picker and **Play scenario** to stream all five scripts. Pause/resume and speed controls exercise `mock/player.ts`.

## Components

| Component | States covered |
|-----------|----------------|
| `ChatView` | empty, streaming prose, pinned/unpinned scroll, embedded actions |
| `ActionCard` | open, streaming (expand/collapse), closed applied, closed failed, plan approve/reject |
| `ConfigChangedBadge` | visible, dismissible |
| `TurnStatusBar` | idle, streaming, applying, finished (+ commit chip), warnings, error |
| `PreviewPane` | idle, loading, ready, error, device frame none/phone |
| `VersionTimeline` | empty, entries, HEAD marker, restore callback |
