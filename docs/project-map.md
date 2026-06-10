# NIHIL — Project Map

**High-level view: phases, goals, exit criteria, and operating model.**
Task-level detail lives in `HANDOFF.md` §5; architecture in `docs/technical-spec.md`; this document is the map.
Last updated: 2026-06-11 · Current position: **Phase 2 (Core Loop), Tasks 1–5 of 6 complete · first real-model smoke gate runs before Task 6 (minimal Tauri shell)**

---

## One-Screen Overview

```
        RESEARCH          FOUNDATION         CORE LOOP          INTELLIGENCE
 P0 ████████████████  P1 ███████████████  P2 ██████░░░░░░░░  P3 ░░░░░░░░░░░░░░
    repo mapping         protocol pkg        daemon + exec      ACP engine
    decisions 1–7        20/20 tests         runner + git       plan mode
    specs + handoff      SPEC 1.0            BYOK engine        healer + guards
        DONE                DONE             shell mínimo       iframe-lite
                                          ── E2E GENERATION ──

        MOBILE              SHIP              POLISH             HORIZON
 P4 ░░░░░░░░░░░░░░  P5 ░░░░░░░░░░░░░░  P6 ░░░░░░░░░░░░░░  P7 ░░░░░░░░░░░░░░
    capacitor          cloud sandbox       local fast-apply    visual canvas
    emulators          deploy CF/Vercel    daytona/vercel      MCP server mode
    env doctor         supabase + github   neon + nextjs       local-docker
    device frames      PUBLIC RELEASE      community ramp      plugins/skills
                    ── WEB+MOBILE v1 ──     (v1.1)              (v2)
```

---

## Phase 0 — Research & Architecture ✅ DONE

**Goal:** know the territory before building.
**Delivered:** full mapping of 8 OSS codebases + 4 production prompt/tool sets (`docs/source-mapping.md`); 7 locked product decisions; technical spec; license compliance rules; handoff infrastructure (HANDOFF.md, CLAUDE.md).
**Key outcomes:** hybrid sandbox strategy; Capacitor as the day-one mobile answer; open-design's agent runtime chosen as the engine to vendor; WebContainers and AGPL identified as traps to avoid.

## Phase 1 — Foundation (M0) ✅ DONE

**Goal:** freeze the contract everything builds against.
**Delivered:** monorepo (pnpm + turborepo, Apache-2.0 + NOTICE); `@nihil/protocol` fully implemented — streaming parser, edit apply chain, feedback serializer — with SPEC.md and 20/20 conformance tests; GitHub repo live with CI-ready structure.
**Exit criterion (met):** protocol suite green on the dev machine; specs versioned in-repo.

## Phase 2 — Core Loop (M1) 🔶 IN PROGRESS

**Goal:** the first end-to-end generation — prompt in, running app out.
**Scope:** daemon (Fastify HTTP+WS ✅ Task 1); ExecutionTarget interface + local-process target (✅ Task 2: spawn, framework detection, preview proxy, log hub, process-tree kill); runner with git transactions per message (✅ Task 3: parser-event consumption, execute-on-close, dependency batching, longRunning deferral, git transaction with Nihil-Message-Id trailer + rollback, nihil-output feedback loop); BYOK/OmniRoute engine with the protocol-teaching system prompt (✅ Task 4: OpenAI-compatible SSE streaming engine, 5-slot prompt assembly + context selector, the turn loop wiring engine → parser → runner → nihil-output feedback, abort/retry/error taxonomy); `vite-react-shadcn` template (✅ Task 5: salvaged from the droid readiness package — React 19 / Vite 8 / TS 6 / Tailwind v4 / shadcn ejected, `nihil.config.json` workflows, intentional landing page; the integration check surfaced and fixed the gitignored-`.nihil/` commit bug and the vite IPv4 proxy binding); **first real-model smoke gate** — the engine fires through OmniRoute against the template, measurement before any prompt tuning — runs **before** the minimal Tauri shell (chat, streaming action cards, preview iframe, sidecar lifecycle — Task 6).
**Exit criterion:** type a prompt in the shell → app generated, dev server running, preview visible, change committed with `Nihil-Message-Id` trailer.
**Watch items:** Windows process semantics (verified-live approach is working); WS envelope stays internal contract (DECISIONS); `nihil.config.json` model-writability flagged for Task 3 UI treatment.

## Phase 3 — Intelligence (M2)

**Goal:** from "generates code" to "behaves like a senior builder".
**Scope:** vendor open-design agent runtime → engine mode 1 (CLI agents via ACP, zero API cost on existing subscriptions) with first-run CLI detection; plan mode with approval flow; chat compaction; **healer** (dev-server log monitor → error classification → auto-fix turn); validator plugin passes (typecheck dry-run, broken-import scan, artifact-stub guard); `iframe-lite` instant-preview target for landing pages.
**Exit criterion:** a broken generation self-heals without user intervention; a plan can be reviewed/approved before any file is touched; Claude Code/Codex detected and usable as engines.
**Watch items:** vendoring discipline (pinned sha, VENDOR.md, NOTICE); this is the phase where the knowledge package (`craft/`, design systems) starts mattering for output quality.

## Phase 4 — Mobile (M3)

**Goal:** web + mobile parity — the day-one differentiator becomes real.
**Scope:** `vite-react-capacitor` template (platforms pre-scaffolded, safe-area CSS); capacitor lifecycle (`sync`, `open ios|android`, `run` with live reload); AVD + iOS Simulator discovery and boot; device-frame preview in the shell; environment doctor (Node/JDK/ANDROID_HOME/Xcode CLT with guided fixes).
**Exit criterion:** the same generated app previews in a device frame, boots in a local emulator, and opens in Android Studio/Xcode for store handoff.
**Watch items:** this phase is environment-hell by nature — the doctor is the product here; macOS/iOS paths need testing beyond the primary Windows dev machine.

## Phase 5 — Ship (M4) → 🚀 PUBLIC RELEASE

**Goal:** v1 in public hands.
**Scope:** cloud sandbox factory (E2B first — shareable previews, no-Node machines); deploy to Cloudflare + Vercel; export ZIP + GitHub push; Supabase integration; docs site, demo material, release engineering (sidecar bundling per DECISIONS #2, installers, auto-update).
**Exit criterion:** a stranger installs Nihil, generates a web app and a mobile app, deploys the web app, and opens the mobile project in Android Studio — without talking to us.
**Watch items:** packaging is the long pole (esbuild bundle + system Node v1 decision); OSS hygiene (CONTRIBUTING, issue templates, CI matrix win/mac/linux) lands here.

## Phase 6 — Polish (v1.1)

**Goal:** speed and breadth on the foundation.
**Scope:** local fast-apply model via OmniRoute `apply` tier (the open answer to dyad's proprietary Turbo Edits — runs on local hardware); Daytona + Vercel sandbox providers; Neon integration; Next.js template; `@nihil/protocol/schemas` consolidation; community feedback loop driving priorities.

## Phase 7 — Horizon (v2, directional)

Candidates, deliberately unscheduled: visual pipeline canvas (React Flow — converges with AI Forge learnings); Nihil as an MCP server (other agents call it as a tool, open-design pattern); `local-docker` isolated-mode target; Expo/React Native "true native" track; skills/design-system community content; multi-project workspaces. Each enters the map only via an architecture decision session.

---

## Cross-Cutting Tracks (run through all phases)

| Track | What it governs | Cadence |
|---|---|---|
| **Protocol** | SPEC changes require conformance tests + SPEC.md in the same PR; version bumps per SPEC §11 | every protocol-touching PR |
| **Security boundary** | named-workflows-only, path funnel, model-writable config surfaces | reviewed at every phase exit |
| **License compliance** | NOTICE upkeep, vendoring records, AGPL/proprietary quarantine | every vendoring or reference-derived PR |
| **Knowledge content** | craft/ rules, design systems, skills — output *quality* as content, not code | starts P3, grows continuously |
| **OSS health** | CI, docs, contributing, release notes | minimal P2–P4, full at P5 |

## Operating Model (model-tier strategy)

| Tier | Role | Scope |
|---|---|---|
| **Fable 5** (architecture sessions) | Specs, locked decisions, structural review | Phase exits, SPEC changes, security boundaries, vendoring PR |
| **Opus 4.8** (orchestrator) | Decomposes specs into decision-complete leaf tasks with adversarial checklists; personally implements protocol/runner/security/OS-sensitive code; adversarial review of all delegated work | continuous |
| **Sonnet 4.6** (parallel agents) | Leaf tasks with frozen interfaces and mechanical gates (tests + typecheck green) | continuous, parallel |

**Gate hierarchy:** mechanical first (test suites, typecheck, conformance matrix), adversarial review second (checklist-driven, never open-ended), architecture review last (structural PRs only).

## Phase Dependencies & Sequencing Logic

```
P0 → P1 → P2 ─┬→ P3 (healer needs P2's log hub; ACP needs daemon)
              └→ P5 partial (deploy/export need only P2's runner)
P3 → P4 (mobile preview reuses validators + device-frame patterns)
P2+P3+P4 → P5 (release needs all three pillars)
P5 → P6 → P7
```

The only deliberately serialized path is P2→P3 (the healer consumes the exact log pipeline Task 2 is building now). P4 could theoretically start after P2, but P3's quality layer makes mobile output worth shipping — sequencing is a quality choice, not a technical constraint.
