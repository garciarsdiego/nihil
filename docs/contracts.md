# Nihil — Daemon ↔ Shell Contracts

This document records the **chat-resolved** daemon↔shell contracts: the WebSocket
message family (v2) and the M2 ACP→`EngineEvent` mapping. It is a **design record**,
not a published spec.

**Scope (DECISIONS #8).** The WS envelope is an *internal* contract between the
daemon and the desktop/web shell — it is **not** part of `packages/protocol/SPEC.md`,
which governs only the `<nihil-*>` payload grammar. Envelope fields that carry
protocol concepts MUST reuse `@nihil/protocol` types directly
(`NihilAction`, `ProtocolError`, `ActionMeta`) and never redefine them. The
authoritative TypeScript lives in `@nihil/daemon/contracts` (DECISIONS #8/#11);
`packages/ui-kit/src/contract.ts` is a **draft mirror** reconciled against it at
Task 6 integration. When they disagree, this document + `@nihil/daemon/contracts`
win.

---

## 1. WebSocket contract — v2

One WebSocket per project. The server streams a turn's lifecycle; the client
drives turns. All messages are JSON objects discriminated by `type`. `turnId`
correlates every message of one turn.

### 1.1 `ServerMessage` (daemon → shell)

Base envelope (mirrors `packages/ui-kit/src/contract.ts`):

| `type` | Payload | Meaning |
|---|---|---|
| `turn.started` | `{ turnId, messageId }` | A turn began; `messageId` matches the git `Nihil-Message-Id` trailer. |
| `chat.delta` | `{ turnId, text }` | A chunk of **assistant** prose (never user text — see v2-c). |
| `action.open` | `{ turnId, actionId, meta: ActionMeta }` | An action tag opened; render a streaming card. |
| `action.delta` | `{ turnId, actionId, content }` | Streamed body of an open action (e.g. file content). |
| `action.close` | `{ turnId, actionId, action: NihilAction, status: "applied" \| "failed", error?: ProtocolError, summary?: ... }` | Action finished; `status`/`error` from the runner. **(v2-a adds `summary`.)** |
| `config.changed` | `{ turnId, actionId, path }` | A write/edit touched `nihil.config.json` (DECISIONS #14): badge it. |
| `turn.warning` | `{ turnId, code, message }` | Non-fatal warning (e.g. token-limit `length` finish). |
| `turn.finished` | `{ turnId, outcome: "committed" \| "no-changes" \| "rolled-back" \| "aborted", commitRef?, feedbackPending }` | Terminal success path. |
| `turn.error` | `{ turnId, kind, message }` | Terminal failure (mirrors the engine `EngineError.kind`). |
| `preview.ready` | `{ turnId, url }` | **(v2-b)** The dev server is up and the preview URL is reachable. |

**v2 additions (DECISIONS #28):**

- **(a) `action.close.summary`** — optional `{ linesAdded: number; linesRemoved: number }`,
  computed **by the runner at apply time** (diff of the file before/after the action).
  The UI renders the +/− chips from this; it MUST NOT recompute the diff client-side.
- **(b) `preview.ready { turnId, url }`** — emitted by the daemon's dev-server
  ready-detection (`local-process` parses the dev-server URL from stdout, then the
  preview proxy confirms reachability). Replaces any client-side "is it up yet"
  polling; the `PreviewPane` switches from idle → ready on this message.
- **(c) user chat messages are client-owned.** The shell renders the user's own
  message locally the instant it is sent; the daemon **never echoes** a user
  message back. There is no `user`-role `chat.delta`. (Conversation history for
  the engine is reconstructed daemon-side from the session, not from the WS.)
- **(d) version history is HTTP, not WS** — see §1.3. No `version.*` ServerMessage.

### 1.2 `ClientMessage` (shell → daemon)

| `type` | Payload | Meaning |
|---|---|---|
| `chat.send` | `{ projectId, text }` | Start a turn with the user's prompt. The shell has already rendered this locally (v2-c). |
| `turn.abort` | `{ turnId }` | Abort the running turn → runner rolls back (DECISIONS #16/#18). |

*(Plan-mode messages — `plan.approve` / `plan.reject` — arrive with plan mode in
M2 and are intentionally absent from the M1 contract.)*

### 1.3 HTTP endpoints (not WS)

- **`GET /projects/{id}/versions`** — the project's version history (the commit
  list carrying `Nihil-Message-Id` trailers). The `VersionTimeline` fetches this
  on demand; history is queryable state and does not belong on the streaming
  channel (DECISIONS #28-d).
- **`POST /projects/{id}/versions/{ref}/restore`** *(planned)* — restore a prior
  version (maps to the runner's `restore(ref)`); shape finalized when the shell
  wires version actions.

---

## 2. M2 ACP → `EngineEvent` mapping

M1 ships **mode 2** only (BYOK, OpenAI-compatible SSE): the model emits `<nihil-*>`
tags, the host parses + applies them, `capabilities.editsViaProtocol = true`, and
the engine emits just `text` / `done` (`apps/daemon/src/engine/types.ts`).

**Mode 1 (ACP, M2)** vendors open-design's agent runtime: a CLI agent (Claude
Code, Codex, …) applies edits **itself** over the Agent Client Protocol. The host
supervises rather than parses. The forward-compatible `EngineEvent` union absorbs
ACP session updates without reshaping the mode-2 consumer (DECISIONS #22):

| ACP session update | → `EngineEvent` | Notes |
|---|---|---|
| text delta (`agent_message_chunk`, text) | `{ type: "text", delta }` | Same variant mode 2 already emits → shared prose rendering. |
| reasoning (`agent_thought_chunk`) | `{ type: "thinking", delta }` | **New M2 variant**; UI renders a collapsible reasoning stream. |
| tool call / status (`tool_call`, `tool_call_update`) | `{ type: "status", ... }` | **New M2 variant**; surfaced as activity, not file mutation. |
| agent-applied edit (the agent wrote/changed a file) | `{ type: "file-change", ... }` | **The reserved variant's purpose**: in mode 1 the host did not parse a `<nihil-*>` tag, so file changes are first-class events the runner snapshots/commits around (open-design under-models this as a boolean; Nihil makes it an event). |
| session end (`stop` / final) | `{ type: "done", finishReason }` | Same terminal variant as mode 2. |
| transport error / agent crash | **throw `EngineError`** | Not an event — the turn loop's `instanceof EngineError` catch handles it (kind `network`/`provider`/…), exactly as mode-2 SSE failures do. |

**Capabilities.** Mode 1 sets `capabilities.editsViaProtocol = false`: the turn
loop must **not** run the `<nihil-*>` parser/apply chain over mode-1 output;
instead it observes `file-change` events and wraps them in the same git
transaction (snapshot → commit-on-end → rollback-on-abort) the runner already
owns. A consumer that only handles `text`/`done` keeps working against either mode;
the new variants are additive.
