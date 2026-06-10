# OSS App Builder — Full Source Mapping & Architecture Foundation

**Date:** 2026-06-10 · **Decisions locked:** Standalone project (separate from AI Forge) · Web + Mobile from day one · Hybrid sandbox model
**Scope:** 8 codebases cloned and analyzed + 4 production system-prompt/tool sets (Lovable, Replit, v0, Manus)

---

## 1. Executive Summary

Every successful tool in this space is the same machine with different trade-offs at 4 layers:

```
┌─────────────────────────────────────────────────────┐
│ 1. AGENT LOOP      how the LLM plans, edits, recovers│
│ 2. EDIT PROTOCOL   how code changes leave the model  │
│ 3. EXECUTION       where the generated app runs      │
│ 4. PREVIEW/SHIP    how the user sees & deploys it    │
└─────────────────────────────────────────────────────┘
```

The strongest patterns found, per layer:

- **Agent loop:** Manus event-stream architecture (Plan/Knowledge modules injected into context) + dyad's plan-mode/build-mode split + v0's TodoManager for multi-step tasks.
- **Edit protocol:** streaming XML tags (`<boltAction>` / `<dyad-write>`) parsed incrementally during the stream — this is the industry-converged answer. Lovable adds a line-based replace tool + "keep existing code" markers; dyad adds a fast-apply model fallback (Turbo Edits) — same idea as open-lovable's Morph integration.
- **Execution:** nobody has one answer. bolt = browser (WebContainers, licensing trap), december/dyad = local (Docker / Node processes), open-lovable/libra = cloud factory pattern (E2B + Vercel / E2B + Daytona). The provider-interface pattern appears independently in two codebases — that's the architecture to adopt.
- **Mobile:** only dyad ships it, via **Capacitor** (`npx cap sync` → open Xcode/Android Studio). It's the pragmatic web+mobile-from-day-one path; Expo/RN is the "real native" upgrade later.
- **Design quality:** v0's 46K-char prompt is ~40% design system rules; open-design turns this into a filesystem of `DESIGN.md` contracts + 100 skills consumed by existing coding-agent CLIs — philosophically identical to AI Forge.

**License landmines:** libra is AGPL-3.0 (read, never copy). dyad's `src/pro/` is proprietary (everything else Apache-2.0). WebContainers API requires a commercial license for production commercial use — avoid as a core dependency for an OSS project.

---

## 2. Comparison Matrix

| Repo | Status (last commit) | License | Stack | Execution model | LLM layer | Edit protocol | Mobile | Verdict |
|---|---|---|---|---|---|---|---|---|
| **open-lovable** (Firecrawl) | Active (Nov 2025) | MIT | Next.js 15, AI SDK v5, Jotai | Cloud: **E2B + Vercel Sandbox** via factory | Multi-provider (Anthropic/OpenAI/Google/Groq) | Full-file + **Morph fast-apply**, edit-intent analyzer | ✗ | **Copy the sandbox factory + edit-intent pipeline** |
| **bolt.new** (StackBlitz) | Frozen (Dec 2024) | MIT | Remix + CF Pages, nanostores | Browser: **WebContainers** | Anthropic only | `<boltArtifact>/<boltAction>` streaming XML | ✗ | **Copy StreamingMessageParser + ActionRunner**, skip WebContainers |
| **bolt.diy** (community) | Active (Feb 2026) | MIT | bolt.new + Electron build | WebContainers | **22 providers** (Vercel AI SDK), Ollama/LMStudio | bolt protocol + diff mode | ✗ | Provider registry pattern, MCP service, deploy integrations |
| **december** | Stale (Jun 2025) | MIT | Bun/Express + Next.js FE | Local: **Docker per project** (dockerode) | OpenRouter (single) | Full-file via container exec | ✗ | Simplest possible local-Docker reference (~5 files) |
| **dyad** | Very active (Jun 2026) | Apache-2.0 (+ proprietary `src/pro/`) | **Electron**, Drizzle + SQLite, AI SDK v6 | Local: Node child processes + preview proxy | Multi-provider + local (Ollama, LMStudio), MCP | `<dyad-write>/<dyad-edit>/<dyad-rename>` + Turbo Edits fast-apply | ✓ **Capacitor** (iOS/Android) | **Closest to the target product.** Study deepest. |
| **open-design** (nexu-io) | Very active (Jun 2026) | Apache-2.0 | Desktop app + local **daemon**, web | Sandboxed iframe artifacts | **Consumes coding-agent CLIs** (Claude Code, Codex, 21 CLIs) via ACP + BYOK | Agent-native (CLI does the editing) | Mobile *prototypes* (not builds) | **The AI Forge philosophy applied to design.** Skills/DESIGN.md/plugins-as-filesystem. |
| **openv0** (raidendotai) | Archived (→ Cofounder) | MIT | Node server + starters | Local preview | Multipass plugin pipeline | Component-level generation | ✗ | Conceptual: multipass validation pipeline, component RAG over UI libraries |
| **libra** | Active (Sep 2025) | **AGPL-3.0** ⚠️ | Turborepo, Next.js 15, **Cloudflare-native** | Cloud: **E2B + Daytona** via factory | Multi-provider | Diff-based | ✗ | Production SaaS architecture reference (Workers for Platforms, queues, custom domains). **Read only, never copy code.** |

---

## 3. Repository Deep Dives

### 3.1 open-lovable (Firecrawl) — the sandbox-orchestration reference

The architecture is ~28 Next.js API routes orchestrating a cloud sandbox lifecycle. The valuable part is `lib/`:

```
lib/sandbox/
  types.ts             ← SandboxProvider interface (create, exec, writeFiles, getUrl…)
  factory.ts           ← SandboxFactory.create('e2b' | 'vercel') from env
  sandbox-manager.ts   ← Map<sandboxId, provider> + reconnection logic
  providers/
    e2b-provider.ts    ← Vite on :5173, /home/user/app, 30min TTL, reconnectable
    vercel-provider.ts ← node22 runtime, :3000, 15min TTL, OIDC auth
lib/
  edit-intent-analyzer.ts  ← LLM classifies the request before editing
  context-selector.ts      ← picks which files enter the context window
  morph-fast-apply.ts      ← lazy edit → Morph LLM applies it precisely
  build-validator.ts       ← validates output compiles before showing user
  file-parser.ts           ← parses generated code blocks into file ops
```

Notable API routes: `create-ai-sandbox-v2`, `generate-ai-code-stream`, `apply-ai-code-stream`, `detect-and-install-packages`, `monitor-vite-logs`, `check-vite-errors`, `report-vite-error`, `restart-vite`, `scrape-website` / `extract-brand-styles` (Firecrawl-powered site cloning — clone any URL as the starting point).

**Self-healing loop:** Vite error monitor → error cache → auto-report to model → regenerate. This closed feedback loop is what makes generation feel reliable.

**Take:** the entire `lib/sandbox` provider pattern (it's small, clean, MIT), edit-intent analysis, build validation, the Vite error feedback loop, and brand/style extraction for the "clone this site" feature.

### 3.2 bolt.new — the streaming edit protocol reference

The crown jewel is ~600 lines across two files:

- **`app/lib/runtime/message-parser.ts`** — `StreamingMessageParser`: a character-position state machine that detects `<boltArtifact>` / `<boltAction type="file|shell">` *while the response streams*, firing `onActionOpen/Close` callbacks. Files start being written before generation finishes — this is why bolt feels instant.
- **`app/lib/runtime/action-runner.ts`** — serial promise-chain executor; `file` actions write to the FS, `shell` actions run in the terminal, each action has lifecycle status (`pending → running → complete/failed`) rendered in the UI.

System prompt teaches the protocol explicitly: think holistically first, one artifact per task, deps before code, `package.json` first, dev server start as last action. State management via nanostores (`files`, `previews`, `terminal`, `workbench` stores) — the previews store watches for server-ready events from the container and binds iframes to ports.

**WebContainers caveat:** the runtime is `@webcontainer/api` — free for OSS/personal, **commercial production use requires a paid license from StackBlitz**. For a true OSS project this is a dependency trap. The parser/runner pattern, however, is runtime-agnostic: actions can target Docker, E2B, or anything.

**Take:** the parser + runner + artifact lifecycle UI, the prompt's action-ordering rules. **Avoid:** WebContainers as the core runtime.

### 3.3 bolt.diy — the multi-provider + desktop evolution

Everything bolt.new has, plus what 14 months of community development added: a **provider registry** at `app/lib/modules/llm/providers/` with 22 providers (incl. Ollama, LMStudio, OpenAI-compatible — i.e., it would point at OmniRoute's endpoint today with zero code), **MCP support** (`mcpService.ts`, `stores/mcp.ts`), **Electron desktop build**, deploy integrations (Netlify/Vercel/GitHub), git clone import, diff-based edit mode, prompt library, and a settings system for per-provider API keys.

**Take:** the provider registry shape, MCP service wiring, the Electron packaging of a web-first codebase (relevant if you go web-first + desktop-later instead of Tauri-first).

### 3.4 december — the minimal local-Docker blueprint

The entire backend is 7 files. `services/docker.ts` (dockerode): one container per project from a Next.js base image, label-based discovery (`project=december`), port allocation from :8000 with collision checks, file read/write via container exec, export-as-zip. `services/llm.ts` streams from any OpenAI-compatible endpoint (config points at OpenRouter).

It proves the local tier of your hybrid model needs almost nothing: **container-per-project + port mapper + file bridge + log tail ≈ 1,000 lines.** Stale and single-provider, but as a teaching skeleton it's the fastest path to a working local tier.

### 3.5 dyad — the product to beat (and the mobile answer)

Local-first Electron app, Apache-2.0 (except `src/pro/`), shipping weekly. The architecture map:

```
src/
  ipc/handlers/         ← ~50 typed IPC handlers: the real backend
    chat_stream_handlers.ts    ← the agent loop
    app_handlers.ts            ← spawns apps as Node child processes
    capacitor_handlers.ts      ← MOBILE: cap sync / open ios / open android
    local_model_*.ts           ← Ollama + LMStudio native support
    mcp_handlers.ts            ← MCP integration
    integration_handlers.ts    ← Supabase / Neon / Vercel / GitHub
  prompts/
    system_prompt.ts           ← build mode (XML tag protocol)
    plan_mode_prompt.ts        ← plan-before-build mode
    security_review_prompt.ts  ← automated security pass
    compaction_*, summarize_*  ← context-window management
  pro/                         ← PROPRIETARY: Turbo Edits v2 (fast-apply), local agent tools
  db/ (Drizzle + better-sqlite3)  ← apps, chats, versions — all local
```

Key design choices worth copying:

1. **Edit protocol:** `<dyad-write path="">`, `<dyad-edit>`, `<dyad-rename>`, `<dyad-add-dependency>` tags streamed and parsed live (same family as bolt, more granular verbs).
2. **Execution:** generated apps run as plain local Node processes (`spawn`), with a proxy giving each app a stable preview URL inside an iframe. No Docker overhead, instant, fully private. Framework detection (`nextjs | vite | vite-nitro | other`) drives run commands.
3. **Mobile (the answer to your day-one requirement):** Capacitor. `capacitor_handlers.ts` detects `capacitor.config.*`, runs `npx cap sync`, then `npx cap open ios` / `android` to hand off to Xcode/Android Studio. The generated app stays a web app; Capacitor wraps it natively. Node version gating included.
4. **Versioning:** every AI change is a git commit; checkout-to-restore gives free undo.
5. **Modes:** plan mode (propose `<dyad-write-plan>`) vs build mode — and a security review prompt run over generated code.
6. **Monetization line:** OSS core, proprietary `src/pro/` (fast-apply engine, agent tools). A model to be aware of — and a directory to never copy from.

### 3.6 open-design (nexu-io) — the AI-Forge-shaped one

Apache-2.0, extremely active. The thesis: don't build an LLM client at all — **consume the coding-agent CLIs the user already has** (Claude Code, Codex, OpenCode, Qwen, Kimi… 21 CLIs) via **ACP**, plus any OpenAI-compatible BYOK endpoint. The product is a desktop app + local **daemon** (`apps/daemon` — ~100 modules: ACP sessions, agent resume, artifact lifecycle, automation routines, chat routes) + the *content*: 100+ skills, 150 `DESIGN.md` design systems (`design-systems/` — airbnb, apple, ant…), 261 plugins, and `craft/` quality guides (`anti-ai-slop.md`, `typography-hierarchy-editorial.md`, `laws-of-ux.md`, `accessibility-baseline.md`).

Artifact types: prototypes (web/desktop/**mobile** — rendered in device frames, sandboxed iframes), live dashboards, decks (PPTX/PDF export), images, video/HyperFrames (MP4 render). Also ships as an MCP server + CLI so other agents can call it.

**Take:** This validates your whole OAuth-subscription/CLI-orchestration thesis at scale. Steal: ACP session management in the daemon, skills/design-systems-as-filesystem, the `craft/` quality-guide approach (it's the v0 design prompt, decomposed into composable files), device-frame mobile preview, artifact guard modules (`artifact-stub-guard`, `artifact-publication-guard` — anti-slop validation before showing the user).

### 3.7 openv0 — archived, one idea worth keeping

Generative *component* (not app) framework. The architecture: a **multipass pipeline where every pass is an independent plugin** — library RAG (indexes NextUI/Flowbite/shadcn components + Lucide icons into SQLite), generation, validation, post-processing. Successor is Cofounder.

**Take (conceptual only):** component-level generation with RAG over real component libraries beats asking the model to hallucinate UI from scratch; and validation-as-pipeline-pass. Both ideas reappear in your benchmark-framework experience.

### 3.8 libra — the production-SaaS reference (AGPL ⚠️)

The most complete *commercial* architecture: Turborepo with `apps/` (builder, deploy via **Cloudflare Queues**, dispatcher on **Workers for Platforms**, screenshot service, CDN, auth-studio, docs) and `packages/` (sandbox, api, auth via better-auth + Stripe, db, templates). `packages/sandbox/src/` is the same factory pattern as open-lovable but with **E2B + Daytona** providers behind a common interface — second independent confirmation of the pattern.

What it teaches that no other repo does: per-user project hosting with custom domains (Cloudflare for SaaS), deploy pipelines as queues/workflows, screenshot-service for project thumbnails, and a full billing layer.

**AGPL-3.0:** any derived code forces your whole project to AGPL. Treat as documentation. Architecture diagrams in `TECHNICAL_GUIDELINES.md` are excellent reading.

---

## 4. System Prompt & Tooling Analysis (the closed-source intelligence)

### 4.1 Lovable (20K chars, 15 tools)

Structure: General Guidelines → SEO Requirements → **Required Workflow (ordered)** → Efficient Tool Usage → Coding Guidelines → Debugging Guidelines → Common Pitfalls → Response Format → Examples → Design Guidelines.

What makes it work:

- **Discussion-first default.** Lovable only writes code when explicitly asked; otherwise it discusses. The good/bad examples in the prompt train this hard.
- **Cardinal efficiency rules:** batch file reads; never re-read a file you already have; never write a file you'd write identically; edit only what's needed.
- **Tool design:** `lov-line-replace` (line-number-based search/replace) is the *primary* edit tool — full-file `lov-write` is the fallback, and when used, unchanged regions are elided with `// ... keep existing code` markers. Plus `lov-search-files` (regex + glob), `lov-add-dependency`, `lov-download-to-repo` (pull assets into the project), web search/image search, screenshot + console-log reading for self-debugging.
- The model never runs a dev server — the platform owns the runtime; the model only touches files. Clean separation worth copying.

### 4.2 Replit (8K chars, 27 tools)

A *propose-and-apply* model: the assistant proposes file changes and shell commands; the IDE applies them. Distinctive ideas:

- **Workspace tool nudges** — requests about secrets or deployment aren't handled in-chat; the model redirects to the Secrets/Deployments tools. Boundary-setting as prompt design.
- **Workflows** (`workflows_set_run_config_tool`) — named run configurations instead of raw shell, so "run the app" is structured state.
- **Feedback tools** — `web_application_feedback_tool` (screenshot + ask user), `vnc_window_application_feedback` (native apps via VNC!), `webview_console_logs`. The agent verifies its work by *looking* at it.
- DB as first-class tools (`create_postgresql_database_tool`, `execute_sql_tool`), `ask_secrets` for credentials, `report_progress` for long tasks.

### 4.3 v0 (46K chars — the design bible)

The largest prompt, and ~40% of it is **design law**, not coding instructions:

- **Color system:** exactly 3–5 colors, defined roles, no random palettes.
- **Typography:** max 2 font families, strict scale.
- Layout structure rules, Tailwind discipline (semantic tokens, no arbitrary-value soup), visual-elements/icons policy.
- Framework currency: Next.js 16 specifics (caching APIs, cache components), React 19.2 (`<Activity>`), so output is never stale-idiom code.
- **Context gathering doctrine:** `SearchRepo` before *any* edit; tools are read-only (`ReadFile`, `GrepRepo`, `LSRepo`, `InspectSite`, `FetchFromWeb`) — writing happens through structured CodeProject markdown blocks, the platform applies them.
- **TodoManager** for multi-step tasks; `GenerateDesignInspiration` as an explicit divergent-thinking step; a Memories section; explicit Refusals/Alignment section.

The lesson: **design quality is a prompting problem solved with legislation, not vibes.** open-design's `craft/` + `DESIGN.md` files are this same content made modular.

### 4.4 Manus (10K prompt + agent loop + modules, 29 tools)

The most *agentic* of the four — a general computer-operator, not a code generator:

- **Agent loop:** Analyze events → select ONE tool → wait → iterate → submit → idle. One tool per iteration, enforced.
- **Event stream architecture:** the context is a chronological stream of Message / Action / Observation / **Plan** / **Knowledge** / **Datasource** events — Planner and Knowledge are separate modules *injecting* into the stream. This is a multi-module architecture expressed in a single context window.
- Full Linux sandbox + complete browser toolset (navigate/click/input/console-exec) + **deploy tools** (`deploy_expose_port`, `deploy_apply_deployment`) + explicit user-communication verbs (`message_notify_user` vs `message_ask_user` — non-blocking vs blocking).
- todo.md as working memory, updated as the plan progresses.

The lesson for your build: the orchestrator layer should be an **event-stream state machine** with pluggable injector modules — which maps 1:1 to what you already built in AI Forge's pipeline planner.

---

## 5. The Hybrid Sandbox Recommendation

You asked for the best hybrid. Based on what works across all 8 codebases:

```
TIER 0 · Instant preview (in-browser, zero install)
  Sandboxed iframe + esbuild-wasm / Sandpack (OSS, Apache-2.0)
  → static sites, landing pages, single-page React. <1s feedback.
  → NOT WebContainers (commercial license trap for OSS).

TIER 1 · Local full runtime (DEFAULT)
  Strategy A (dyad): spawn Node child processes + preview proxy   ← fastest, zero deps
  Strategy B (december): Docker container per project              ← isolation, any runtime
  → Pick A as default, B as opt-in "isolated mode". Free, private,
    aligned with your local-first hardware (R9700 workstation).

TIER 2 · Cloud sandbox (opt-in, provider factory)
  SandboxProvider interface → E2B | Daytona | Vercel Sandbox | (CF containers later)
  → For: sharing live previews, CI-like validation, machines without Node/Docker.
  → Copy open-lovable's lib/sandbox verbatim (MIT) and add Daytona from
    libra's *interface shape* (not its code — AGPL).

MOBILE · Capacitor from day one (dyad-proven)
  Web app + capacitor.config → npx cap sync → open Xcode / Android Studio
  Preview ladder: device-frame iframe (open-design style) → local emulator
  (AVD / iOS Simulator) → real device via cap run. Expo/RN as a v2 track
  for "true native" when needed.
```

The unifying abstraction: **one `ExecutionTarget` interface** (`writeFiles`, `exec`, `installPackages`, `getPreviewUrl`, `streamLogs`, `destroy`) with 4 implementations (iframe-lite, local-process, local-docker, cloud-factory). Every repo that scaled has some version of this; none has all four tiers — that's your differentiation.

---

## 6. Proposed Architecture (v0 sketch for discussion)

```
┌────────────────────────────────────────────────────────────────┐
│  SHELL · Tauri 2 + React (your stack)                          │
│  Chat │ Monaco editor │ Preview (web/device frames) │ Versions │
├────────────────────────────────────────────────────────────────┤
│  ORCHESTRATOR (TS/Node sidecar — daemon, like open-design)     │
│  • Event-stream agent loop (Manus) + plan/build modes (dyad)   │
│  • StreamingMessageParser + ActionRunner (bolt, runtime-       │
│    agnostic rewrite)                                           │
│  • Edit protocol: <forge-write|edit|rename|add-dep> tags       │
│    + fast-apply fallback (Morph-style, open-lovable)           │
│  • Edit-intent analyzer + context selector (open-lovable)      │
│  • Self-heal loop: dev-server log monitor → error → auto-fix   │
│  • Validation passes as plugins (openv0) + artifact guards     │
│    (open-design)                                               │
├────────────────────────────────────────────────────────────────┤
│  LLM GATEWAY · OmniRoute (already built)                       │
│  OAuth subscription tiers, circuit breaker, OpenAI-compatible. │
│  bolt.diy-style provider registry = thin client over OmniRoute │
├────────────────────────────────────────────────────────────────┤
│  EXECUTION · ExecutionTarget interface (section 5)             │
│  iframe-lite │ local-process │ local-docker │ cloud factory    │
├────────────────────────────────────────────────────────────────┤
│  KNOWLEDGE-AS-FILESYSTEM (open-design)                         │
│  skills/ · design-systems/DESIGN.md · craft/ quality rules     │
│  (v0's design law, decomposed) · templates/ (Vite, Next,       │
│  Capacitor-ready starters)                                     │
├────────────────────────────────────────────────────────────────┤
│  PERSISTENCE · SQLite + Drizzle (dyad) · git commit per AI     │
│  change = free versioning/undo                                 │
└────────────────────────────────────────────────────────────────┘
```

Why this wins as OSS: it's the only combination of (a) dyad's local-first product polish, (b) open-lovable's cloud-sandbox optionality, (c) open-design's CLI/subscription-leverage philosophy, and (d) mobile from day one — and every ingredient is MIT/Apache-clean.

---

## 7. License Compliance Cheat Sheet

| Source | Can copy code? | Notes |
|---|---|---|
| open-lovable, bolt.new, bolt.diy, december, openv0 | ✅ MIT | Attribution in NOTICE |
| dyad (except `src/pro/`) | ✅ Apache-2.0 | **Never** touch `src/pro/` |
| open-design | ✅ Apache-2.0 | Content (skills/design-systems) also reusable |
| libra | ❌ AGPL-3.0 | Architecture reference only |
| WebContainers (`@webcontainer/api`) | ⚠️ | Free for OSS use, but commercial production needs StackBlitz license — don't make it a core dep |
| x1xhlol prompts repo | ⚠️ | Leaked proprietary prompts: study patterns, write your own prompt from scratch |

---

## 8. Open Decisions for Next Session

1. **Project name + repo** (suggestion territory: keep the Forge family or fully separate brand?).
2. **Shell choice confirmation:** Tauri 2 desktop-first (dyad/open-design path) vs web-first + Electron later (bolt.diy path). My read: Tauri-first — it's your stack and local-first is the differentiator.
3. **Default template set:** Vite+React+Tailwind+shadcn (everyone's default) + a Capacitor-ready variant as the mobile-first template.
4. **Deploy story for v1:** export ZIP + GitHub push (cheap), or full Cloudflare/Vercel deploy integration (bolt.diy has MIT reference code).
5. **DB integrations priority:** Supabase first (dyad has Apache-2.0 reference), Neon later.
6. **Fast-apply engine:** Morph API (open-lovable path, costs money) vs local small model on your hardware vs skip in v1 (full-file writes only).
7. **Whether the orchestrator also speaks ACP** so Claude Code/Codex CLIs can be the engine (open-design model) in addition to OmniRoute direct calls — this would let you reuse subscriptions for the builder itself.

---

## Appendix A — Repo freshness & risk

| Repo | Last commit | Risk |
|---|---|---|
| open-design | 2026-06-10 | None — daily commits |
| dyad | 2026-06-09 | None — v1.3.0 |
| bolt.diy | 2026-02-07 | Low |
| open-lovable | 2025-11-19 | Low — Firecrawl-maintained example |
| libra | 2025-09-24 | Medium — license + slowing |
| december | 2025-06-17 | High — likely abandoned |
| bolt.new | 2024-12-17 | Frozen by design (bolt.diy is the living fork) |
| openv0 | 2024-09-19 | Archived (→ Cofounder) |

## Appendix B — Tool inventory quick-reference

**Lovable (15):** lov-write, lov-line-replace, lov-search-files, lov-rename, lov-delete, lov-add-dependency, lov-remove-dependency, lov-download-to-repo, lov-view, lov-read-console-logs, lov-read-network-requests, lov-fetch-website, web_search, generate_image, edit_image.

**Replit (27):** str_replace_editor, bash, packager_tool, programming_language_install_tool, create_postgresql_database_tool, execute_sql_tool, check_database_status, ask_secrets/check_secrets, workflows_set/remove_run_config_tool, restart_workflow, web_application_feedback_tool, vnc_window_application_feedback, webview_console_logs, workflow_console_logs, search_filesystem, repo_overview, report_progress, suggest_deploy, View, file_system…

**v0 (10, read-only):** SearchRepo, ReadFile, GrepRepo, LSRepo, FetchFromWeb, SearchWeb, InspectSite, TodoManager, GenerateDesignInspiration, GetOrRequestIntegration. (Writes via CodeProject blocks.)

**Manus (29):** message_notify_user/ask_user, file_read/write/str_replace/find*, shell_exec/view/wait/write_to_process/kill, browser_* (12 verbs incl. console_exec), info_search_web, deploy_expose_port, deploy_apply_deployment, make_manus_page, idle.
