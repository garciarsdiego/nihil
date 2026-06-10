# CLAUDE.md — Nihil

Open-source, local-first AI app builder (web + Android/iOS via Capacitor).
Tauri 2 + React shell, Node daemon sidecar, hybrid sandbox. Apache-2.0.

## Source of truth (read in this order before significant work)

1. `packages/protocol/SPEC.md` — the `<nihil-*>` protocol contract. Authoritative
   for parser, runner, daemon, and UI behavior. Read it BEFORE touching any of those.
2. `docs/technical-spec.md` — architecture, ExecutionTarget interface, roadmap.
3. `HANDOFF.md` — milestone task breakdown, reference repos, vendoring process.
4. `DECISIONS.md` — post-handoff decision log (continues the HANDOFF §3 table).
5. `docs/source-mapping.md` — why each pattern was chosen (background).

## Invariants (never break)

- `packages/protocol` tests stay green: `cd packages/protocol && npx vitest run` → 20/20.
  Protocol changes require SPEC.md + conformance-test updates in the same PR.
- No code from `~/refs/libra` (AGPL) or `~/refs/dyad/src/pro/` (proprietary). Ever.
- No `@webcontainer/api` dependency.
- Model-provided paths always go through `normalizeProjectPath`.
- `<nihil-run>` executes named workflows only — never raw shell from the model.
- System prompts are original text; never copy from leaked prompt collections.

## Layout & status

- `packages/protocol` ✅ implemented (streaming parser, edit apply chain, output serializer)
- `apps/daemon` — M1: engine/ (vendored ACP+BYOK) · agent/ (loop, runner, healer) ·
  exec/ (ExecutionTarget impls; local-process is default) · mobile/ · db/ (SQLite+Drizzle)
- `apps/desktop` — Tauri 2 + React shell, daemon as sidecar
- `packages/templates` — vite-react-shadcn, vite-react-capacitor
- `packages/knowledge` — skills/ design-systems/ craft/

## Reference repos

Cloned read-only at `~/refs/` (open-design, dyad, open-lovable, bolt.new, bolt.diy,
december, libra). Vendoring source: `~/refs/open-design/apps/daemon/src/`
(ACP client + `runtimes/`) → `apps/daemon/src/engine/`, pinned commit recorded in
`apps/daemon/src/engine/VENDOR.md`, header comments + NOTICE updated per HANDOFF §6.

## Commands

```bash
pnpm install                 # workspace install
pnpm test                    # turbo run test
cd packages/protocol && npx vitest watch   # protocol TDD loop
```

## Conventions

- Code/comments/docs/commits in English; TypeScript strict, ESM (NodeNext);
  vitest; no default exports in daemon code; zero runtime deps in the
  @nihil/protocol main entry (`./schemas` peer-depends on zod — DECISIONS #10).
- Conventional Commits (`feat(daemon): …`). Git transactions inside generated
  apps carry a `Nihil-Message-Id:` trailer.
- Plan-first on large tasks: present the plan before writing code.
