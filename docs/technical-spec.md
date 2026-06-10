# NIHIL — Technical Specification v0.1

**Repo:** `garciarsdiego/nihil` · **License:** Apache-2.0 · **Date:** 2026-06-10

> Open-source, local-first AI app builder. Generates websites, landing pages, web apps, and Android/iOS apps — with native preview, emulation, and a hybrid sandbox. Runs on the coding-agent CLIs and OAuth subscriptions you already pay for, or any OpenAI-compatible endpoint.

---

## 0. Locked Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Name / repo | **Nihil** · `garciarsdiego/nihil` |
| 2 | Shell | **Tauri 2 + React, desktop-first** (macOS / Windows / Linux) |
| 3 | Templates | Vite + React + TS + Tailwind + shadcn/ui (default) · Capacitor-ready variant (mobile) · Next.js (later) |
| 4 | Deploy | **Both:** export (ZIP / GitHub push) + platform deploy (Cloudflare, Vercel) |
| 5 | DB integrations | Supabase first, Neon later |
| 6 | Edit engine | v1: deterministic search/replace + full-file fallback · v1.1: local fast-apply model via OmniRoute · Morph as optional provider |
| 7 | Engine layer | **Vendor open-design's agent runtime** (Apache-2.0): ACP client, 23 CLI defs, detection, BYOK loop |

---

## 1. Positioning

Nihil = the intersection no one occupies:

- **dyad's** local-first product polish + mobile (but dyad gates fast-apply and agent tools behind proprietary Pro; Nihil ships everything open)
- **open-design's** engine philosophy — your existing CLIs and subscriptions ARE the LLM layer (but open-design makes single-page design artifacts, not full apps)
- **open-lovable / libra's** cloud-sandbox optionality (but neither runs locally)
- **bolt's** streaming UX (but without the WebContainers commercial-license trap)

One-line pitch: *"Lovable on your machine, running on the subscriptions you already have, shipping to web and mobile."*

---

## 2. Architecture

```
nihil/  (monorepo: pnpm + turborepo)
├── apps/
│   ├── desktop/            Tauri 2 shell (Rust) + React UI
│   │   src/                chat · editor (Monaco) · preview · versions · settings
│   │   src-tauri/          window mgmt, sidecar lifecycle, deep links
│   └── daemon/             Node/TS sidecar — the brain (open-design pattern)
│       src/
│         engine/           ← VENDORED from open-design (Apache-2.0, NOTICE)
│           acp.ts            ACP JSON-RPC client, watchdogs, session resume
│           runtimes/         registry, detection, defs/ (claude, codex, gemini,
│                             qwen, kimi, aider, opencode, copilot… 23 CLIs)
│           byok.ts           OpenAI-compatible tool-call loop → OmniRoute native
│         agent/
│           loop.ts           event-stream state machine (Manus pattern)
│           planner.ts        plan mode / build mode (dyad pattern)
│           parser.ts         StreamingMessageParser for <nihil-*> tags (bolt rewrite)
│           runner.ts         ActionRunner — executes parsed actions vs ExecutionTarget
│           context.ts        context selector + edit-intent analyzer (open-lovable)
│           healer.ts         dev-server log monitor → error → auto-fix loop
│           validators/       plugin passes: build-check, artifact-stub-guard, security review
│         edits/
│           search-replace.ts deterministic block apply (v1 primary)
│           full-file.ts      fallback writer
│           fast-apply.ts     v1.1: local apply model via OmniRoute `apply` tier; Morph optional
│         exec/
│           target.ts         ExecutionTarget interface
│           local-process.ts  spawn + framework detection + preview proxy (dyad pattern) ← DEFAULT
│           local-docker.ts   container-per-project, dockerode (december pattern)
│           iframe-lite.ts    Sandpack/esbuild-wasm instant preview (landing pages)
│           cloud/            factory: e2b.ts · daytona.ts · vercel.ts (open-lovable pattern)
│         mobile/
│           capacitor.ts      detect/init/sync, open Xcode / Android Studio, cap run
│           emulators.ts      AVD + iOS Simulator discovery & boot
│         integrations/
│           supabase.ts · github.ts · deploy-cloudflare.ts · deploy-vercel.ts · export-zip.ts
│         db/                 SQLite + Drizzle: apps, chats, messages, versions, settings
│         git.ts              commit-per-AI-change versioning (free undo)
├── packages/
│   ├── protocol/            <nihil-*> tag spec + types (shared FE/daemon)
│   ├── templates/           vite-react-shadcn · vite-react-capacitor · (next-shadcn later)
│   └── knowledge/           skills/ · design-systems/DESIGN.md · craft/ quality rules
└── NOTICE                   attributions: open-design, open-lovable, bolt.new, dyad patterns
```

**Shell ↔ daemon:** daemon is a Tauri sidecar process exposing a local HTTP + WS API (open-design model). This keeps the brain in TypeScript (your stack, fast iteration, reusable headless/CLI later) and the shell thin.

---

## 3. LLM Layer (decision #7 in practice)

Three engine modes, all through one `Engine` interface:

1. **CLI agents via ACP** — vendored open-design runtime. Detects installed CLIs on PATH, probes capabilities, spawns ACP sessions. The CLI does its own tool-calling/file-editing inside the project dir; Nihil supervises, streams progress, and enforces guards. Zero API cost — runs on Claude Max / ChatGPT Pro / Kimi / Google subscriptions.
2. **Direct API via OmniRoute** — BYOK loop pointed at `localhost:20128`. Nihil's own agent loop + `<nihil-*>` protocol does the editing. Works with the 4-tier OAuth routing, circuit breaker, local models.
3. **Raw BYOK** — any OpenAI-compatible URL + key, for users without OmniRoute.

Default UX: auto-detect CLIs at first run → if found, offer mode 1; else mode 2/3 setup.

---

## 4. Edit Protocol — `<nihil-*>` tags

Streamed XML, parsed incrementally (bolt parser pattern), dyad-style verb granularity:

```xml
<nihil-write path="src/App.tsx">…full file…</nihil-write>
<nihil-edit path="src/App.tsx">
  <<<<<<< SEARCH …exact original… ======= …replacement… >>>>>>> REPLACE
</nihil-edit>
<nihil-rename from="a.tsx" to="b.tsx"/>
<nihil-delete path="old.tsx"/>
<nihil-add-dependency package="zustand@latest"/>
<nihil-run command="dev"/>            ← named workflows, not raw shell (Replit pattern)
<nihil-plan>…</nihil-plan>            ← plan mode output
```

Apply chain per `<nihil-edit>`: deterministic search/replace → on mismatch, fuzzy match (whitespace-normalized) → on failure, request full-file rewrite → v1.1 inserts local fast-apply before the rewrite step.

---

## 5. ExecutionTarget Interface (hybrid sandbox)

```ts
interface ExecutionTarget {
  init(template: TemplateRef): Promise<void>
  writeFiles(files: FileMap): Promise<void>
  exec(cmd: WorkflowRef | string): ProcessHandle      // streamed
  installPackages(pkgs: string[]): Promise<Result>
  getPreviewUrl(): Promise<string>
  streamLogs(): AsyncIterable<LogEvent>               // feeds healer.ts
  snapshot(): Promise<SnapshotRef>                     // pairs with git versioning
  destroy(): Promise<void>
}
```

| Tier | Impl | When | Source pattern |
|---|---|---|---|
| 0 | `iframe-lite` (Sandpack/esbuild-wasm) | landing pages, instant feedback | original (avoids WebContainers license) |
| 1 | `local-process` **(default)** | dev loop on user machine | dyad |
| 1b | `local-docker` (opt-in "isolated mode") | untrusted code, non-Node runtimes | december |
| 2 | `cloud/*` factory: E2B · Daytona · Vercel | shareable previews, no-Node machines | open-lovable (vendor, MIT) |

---

## 6. Mobile Pipeline (day one)

Template `vite-react-capacitor` ships with `capacitor.config.ts`, iOS/Android platforms pre-scaffolded, safe-area CSS, and mobile-first DESIGN.md hints.

Preview ladder:
1. **Device-frame iframe** (open-design pattern) — instant, every change
2. **Local emulator** — `mobile/emulators.ts` discovers AVDs / iOS Simulators; `npx cap run android|ios` with live reload pointed at the dev server
3. **Real device** — `cap run` over USB/Wi-Fi
4. **Store handoff** — `npx cap open ios|android` → Xcode / Android Studio for signing & release (dyad pattern; Nihil does not reimplement signing in v1)

Environment doctor on first mobile build: checks Node ≥ 20, JDK, Android SDK/ANDROID_HOME, Xcode CLT — with guided fixes.

---

## 7. Deploy & Export (both)

- **Export:** ZIP download · GitHub repo create+push (bolt.diy reference code, MIT)
- **Deploy:** Cloudflare Pages/Workers · Vercel — token-based, per-project, with deploy status streamed into chat. Mobile "deploy" = store handoff (above).

## 8. Data & Versioning

SQLite + Drizzle in app-data dir (dyad pattern): `apps`, `chats`, `messages`, `versions`, `settings`, `secrets` (OS keychain via Tauri). Every applied AI change = git commit with structured message; restore = checkout. No cloud account in v1.

## 9. Knowledge-as-Filesystem

`packages/knowledge/`: `craft/` quality rules (v0's design law decomposed — color 3–5, two fonts max, layout discipline, anti-slop checks), `design-systems/DESIGN.md` contracts per project, `skills/` for task playbooks (landing page, SaaS dashboard, mobile app). Injected into context by `context.ts`; users can add their own. Direct reuse of open-design content where licensing allows, plus your own (AEON 360 experience applies directly here).

---

## 10. Roadmap

**M0 — Skeleton (wk 1–2):** monorepo, Tauri shell + daemon sidecar, SQLite, template init, `local-process` target, manual preview.
**M1 — The Loop (wk 3–5):** BYOK/OmniRoute engine, `<nihil-*>` parser + runner, search/replace apply, streaming UI, git versioning. *First end-to-end generation.*
**M2 — Engine & Healing (wk 6–8):** vendored ACP runtime + CLI detection, plan mode, healer loop, validators, `iframe-lite` tier.
**M3 — Mobile (wk 9–11):** Capacitor template, emulator discovery, device-frame preview, env doctor. *Web + mobile parity.*
**M4 — Ship (wk 12–14):** cloud sandbox factory (E2B first), deploy CF/Vercel, GitHub export, Supabase integration, docs, public release.
**v1.1:** local fast-apply via OmniRoute `apply` tier · Daytona/Vercel sandboxes · Neon · Next.js template.

---

## 11. License & Attribution Plan

Apache-2.0 root. `NOTICE` credits: open-design (vendored `engine/`, knowledge patterns), open-lovable (cloud sandbox providers, edit-intent), bolt.new (parser/runner pattern), dyad (architecture patterns — reimplemented, nothing copied from `src/pro/`). libra: never copied (AGPL). System prompts written from scratch, informed by pattern analysis only.
