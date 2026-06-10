# NIHIL — Handoff to Claude Code

**Date:** 2026-06-10 · **From:** Architecture sessions (Claude.ai) · **To:** Implementation (Claude Code)
**Repo:** `garciarsdiego/nihil` · **License:** Apache-2.0

---

## 1. What Nihil Is

Open-source, local-first AI app builder. Generates websites, landing pages, web apps, and Android/iOS apps — with native preview, emulation, and a hybrid sandbox. Runs on the coding-agent CLIs and OAuth subscriptions the user already has (Claude Code, Codex, Gemini, Kimi…), on OmniRoute, or on any OpenAI-compatible endpoint.

**Pitch:** *"Lovable on your machine, running on the subscriptions you already have, shipping to web and mobile."*

**Positioning:** dyad's local-first polish (without the proprietary Pro gate) + open-design's CLI/subscription engine philosophy + open-lovable's cloud-sandbox optionality + bolt's streaming UX (without the WebContainers license trap) + mobile from day one via Capacitor.

## 2. Current State — M0 COMPLETE ✅

| Item | Status |
|---|---|
| Monorepo (pnpm + turborepo, Apache-2.0, NOTICE) | ✅ scaffolded |
| `packages/protocol` — full implementation | ✅ **20/20 tests passing** |
| `packages/protocol/SPEC.md` — protocol contract | ✅ frozen at 1.0-draft |
| `docs/technical-spec.md` — architecture source of truth | ✅ |
| `docs/source-mapping.md` — 8-repo + 4-prompt analysis | ✅ |
| `apps/daemon`, `apps/desktop`, `packages/templates`, `packages/knowledge` | 📁 placeholders only |

Protocol package contents (zero runtime deps):
- `src/parser.ts` — `NihilStreamParser`: re-entrant streaming state machine (prose/content/skip), partial-tag suspension, line-start close-tag rule, linear-time scan window, finalize flush.
- `src/edit-blocks.ts` — SEARCH/REPLACE parse + atomic apply chain (exact → whitespace/EOL-fuzzy → typed error).
- `src/escape.ts` — XML entities, `normalizeProjectPath` (rejects traversal/absolute).
- `src/output.ts` — `serializeOutput` for `<nihil-output>` feedback.
- `src/types.ts` — actions, events, error codes, `PROTOCOL_VERSION`.
- `src/__tests__/conformance.test.ts` — SPEC §10 matrix (14) + 6 supplementary.

Verify on machine: `cd packages/protocol && npm install && npx vitest run`.

## 3. Locked Decisions (do not relitigate without a new decision session)

| # | Decision |
|---|---|
| 1 | Name **Nihil**, repo `garciarsdiego/nihil`, Apache-2.0 |
| 2 | **Tauri 2 + React, desktop-first** (macOS/Windows/Linux) |
| 3 | Templates: `vite-react-shadcn` (default) · `vite-react-capacitor` (mobile) · Next.js later |
| 4 | Deploy: export (ZIP/GitHub) **and** platform deploy (Cloudflare, Vercel) |
| 5 | Integrations: Supabase first, Neon later |
| 6 | Edits: search/replace primary + full-file fallback (v1) → local fast-apply model via OmniRoute `apply` tier (v1.1) → Morph as optional provider |
| 7 | Engine: **vendor open-design's agent runtime** (ACP client, CLI registry, BYOK loop) — pinned snapshot, documented sync |

Protocol design decisions (rationale in SPEC.md): no artifact envelope (the message is the envelope); closing tags valid only at line start; `<nihil-run>` accepts named workflows only, never raw shell; execute-on-close + git commit-on-end per message, rollback on abort; `<nihil-output>` feedback loop to the model.

## 4. Architecture (summary — full version in `docs/technical-spec.md` §2)

```
apps/desktop   Tauri 2 shell (chat · Monaco · preview/device frames · versions)
apps/daemon    Node sidecar: engine/ (vendored ACP+BYOK) · agent/ (loop, parser,
               runner, context, healer, validators) · edits/ · exec/ (ExecutionTarget:
               local-process DEFAULT · local-docker · iframe-lite · cloud factory)
               · mobile/ (capacitor, emulators) · integrations/ · db/ (SQLite+Drizzle) · git
packages/      protocol ✅ · templates · knowledge (skills/ design-systems/ craft/)
```

Engine modes: (1) CLI agents via ACP — zero API cost, runs on existing subscriptions; (2) OmniRoute BYOK loop (`localhost:20128`) with Nihil's own agent loop + `<nihil-*>` protocol; (3) raw BYOK endpoint.

## 5. Roadmap & Task Breakdown

### M1 — The Loop (target: first end-to-end generation)
1. `apps/daemon` skeleton: TS strict ESM, local HTTP+WS server, typed route contracts shared with shell.
2. `exec/local-process.ts`: template init → `spawn` dev server → framework detection (`nextjs|vite|other`) → preview proxy with stable URL → log streaming (`streamLogs` feeds future healer).
3. Runner: consume `NihilStreamParser` events; execute-on-close; git transaction per message (snapshot HEAD → apply → `git add -A && commit` with `Nihil-Message-Id:` trailer → rollback on abort); dependency batching; long-running workflow deferral.
4. Engine mode 2 (BYOK/OmniRoute): streaming chat completion, system prompt teaching protocol 1.0, `<nihil-output>` injection on next turn.
5. `packages/templates/vite-react-shadcn` working end-to-end.
6. Minimal Tauri shell: chat pane + streaming action cards (driven by parser events) + preview iframe + daemon sidecar lifecycle.

### M2 — Engine & Healing
7. Vendor open-design runtime → `apps/daemon/src/engine/` (see §6 process). CLI detection UI at first run.
8. Plan mode (`<nihil-plan>` approval flow) + chat compaction.
9. Healer: dev-server log monitor → error classification → auto-fix turn (open-lovable pattern).
10. Validator plugin passes: typecheck dry-run, broken-import scan, artifact-stub guard.
11. `iframe-lite` ExecutionTarget (Sandpack/esbuild-wasm) for landing pages.

### M3 — Mobile
12. `vite-react-capacitor` template (platforms pre-scaffolded, safe-area CSS).
13. `mobile/capacitor.ts`: detect/sync/`cap open ios|android`/`cap run` with live reload.
14. `mobile/emulators.ts`: AVD + iOS Simulator discovery/boot. Device-frame preview in shell.
15. Environment doctor (Node/JDK/ANDROID_HOME/Xcode CLT checks with guided fixes).

### M4 — Ship
16. Cloud sandbox factory (E2B first; port open-lovable `lib/sandbox`, MIT).
17. Deploy: Cloudflare + Vercel; export: ZIP + GitHub push. Supabase integration.
18. Docs site, demo video, public release.

**v1.1:** local fast-apply model (OmniRoute `apply` tier), Daytona/Vercel sandboxes, Neon, Next.js template.

## 6. Reference Repositories

Clone all into `~/refs/` (read-only study material; the daemon vendoring comes from here):

```bash
mkdir -p ~/refs && cd ~/refs
git clone https://github.com/nexu-io/open-design        # Apache-2.0 — VENDOR SOURCE
git clone https://github.com/dyad-sh/dyad               # Apache-2.0 (src/pro/ PROPRIETARY — never read for implementation)
git clone https://github.com/firecrawl/open-lovable     # MIT — port lib/sandbox + healer pattern
git clone https://github.com/stackblitz/bolt.new        # MIT — parser/runner pattern (already reimplemented)
git clone https://github.com/stackblitz-labs/bolt.diy   # MIT — provider registry, MCP service, deploy integrations
git clone https://github.com/ntegrals/december          # MIT — minimal docker target reference
git clone https://github.com/nextify-limited/libra      # AGPL-3.0 — READ ONLY, NEVER COPY
```

| Repo | Study/vendor exactly | For milestone |
|---|---|---|
| open-design | `apps/daemon/src/acp.ts`, `apps/daemon/src/runtimes/` (registry, detection, executables, launch, env, mcp, prompt-budget, `defs/*` — 23 CLI definitions), `byok-tools.ts` | M2 (#7) |
| dyad | `src/ipc/handlers/app_handlers.ts` (process spawn + proxy), `capacitor_handlers.ts`, `src/ipc/processors/response_processor.ts` (apply ordering), `src/prompts/*` (prompt structure only) | M1 (#2–3), M3 (#13) |
| open-lovable | `lib/sandbox/**` (port verbatim, MIT), `lib/edit-intent-analyzer.ts`, `lib/context-selector.ts`, Vite error routes (`monitor-vite-logs`, `check-vite-errors`, `report-vite-error`) | M2 (#9), M4 (#16) |
| bolt.diy | `app/lib/modules/llm/providers/` shape, `mcpService.ts`, `components/deploy/` | M4 (#17) |
| december | `backend/src/services/docker.ts` | post-M4 (local-docker target) |
| libra | `TECHNICAL_GUIDELINES.md`, deploy/queues architecture — concepts only | M4 reading |

**Vendoring process (open-design → `engine/`):** pin a commit; copy needed modules into `apps/daemon/src/engine/`; add header comment `// Vendored from nexu-io/open-design @ <sha> — Apache-2.0, see NOTICE`; record sha + file list in `apps/daemon/src/engine/VENDOR.md`; strip open-design-specific concerns (telemetry, AMR, artifact types) — keep ACP, runtimes, BYOK loop; re-sync deliberately by diffing against the pinned sha, never blind-pull. Update `NOTICE` on every vendoring change.

## 7. Hard Rules (license & safety)

1. **Never** copy code from libra (AGPL) or `dyad/src/pro/` (proprietary). Patterns described in our docs are fine; their code is not.
2. **Never** add `@webcontainer/api` as a dependency.
3. System prompts must be original text (informed by `docs/source-mapping.md` §4 analysis, not copied from the leaked prompt repo).
4. `<nihil-run>` security boundary stays: named workflows only; raw shell only behind an explicit user capability that generates a workflow.
5. All file paths from the model pass through `normalizeProjectPath` — no exceptions.
6. Protocol changes require updating SPEC.md + conformance tests in the same PR; the 20 tests never go red on main.

## 8. Conventions

- **Language:** code, comments, docs, commits, identifiers — English. Discussion with Diego — Portuguese.
- **Commits:** Conventional Commits (`feat(daemon): …`, `test(protocol): …`). AI-applied project changes (inside generated apps) use the `Nihil-Message-Id:` trailer.
- **Code:** TypeScript strict, ESM (`module: NodeNext`), zero runtime deps in `packages/protocol`, vitest everywhere, no default exports in daemon code.
- **Docs:** Markdown; specs live next to the code they govern (`SPEC.md` in the package).

## 9. Initial Prompt for Claude Code

Paste after `git init` + first commit of the scaffold, with `~/refs/` cloned:

```
Read CLAUDE.md, then packages/protocol/SPEC.md, then docs/technical-spec.md
(§2 architecture, §5 ExecutionTarget). Confirm the protocol suite is green:
cd packages/protocol && npm install && npx vitest run (expect 20/20).

Then start Milestone M1, tasks 1–3 from HANDOFF.md §5, in this order:

1. Scaffold apps/daemon: TypeScript strict ESM, Fastify (HTTP + WS),
   vitest, a /health route, and a shared route-contract module. Wire it
   into the pnpm workspace and turbo tasks (test, typecheck, dev).

2. Implement exec/target.ts (the ExecutionTarget interface exactly as in
   docs/technical-spec.md §5) and exec/local-process.ts: init a project
   from a template directory, spawn the dev server (detect vite vs nextjs
   by config file), expose getPreviewUrl() through a local proxy with a
   stable port per project, stream stdout/stderr as LogEvents, destroy()
   kills the tree. Reference: ~/refs/dyad/src/ipc/handlers/app_handlers.ts
   (Apache-2.0; adapt, don't copy verbatim; never open dyad/src/pro).

3. Implement agent/runner.ts consuming @nihil/protocol parser events:
   execute-on-close for write/edit/rename/delete/copy against the target,
   batch dependency installs, defer long-running workflows, and wrap each
   message in a git transaction (snapshot HEAD, commit on success with a
   Nihil-Message-Id trailer, rollback on abort). Serialize failures with
   serializeOutput for the next turn.

Work plan-first: present the plan for review before writing code for each
task. Keep all protocol tests green; add daemon tests as you go. Use
conventional commits, one commit per coherent unit.
```

## 10. Where Decisions Go

Implementation questions → resolve in Claude Code. New architecture/product decisions (handshake formats, protocol changes, scope) → bring back to the Claude.ai project session; the decision log here and in `docs/technical-spec.md` §0 gets updated as the source of truth.
