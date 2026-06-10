# Nihil — Decision Log

Continues the locked-decision table in [HANDOFF.md §3](HANDOFF.md) (decisions 1–7 live
there and are not repeated). New architecture/product decisions are made in the
architecture session (HANDOFF §10) and appended here; implementation-level decisions
that future sessions must know about may also be recorded, marked as such.

| # | Date | Decision | Rationale |
|---|------|----------|-----------|
| 8 | 2026-06-10 | The WS envelope between daemon and shell is an internal contract living in `@nihil/daemon/contracts`, **not** part of SPEC.md. Envelope payloads that carry protocol concepts MUST use `@nihil/protocol` types directly (`NihilAction`, `ProtocolError`, `ActionMeta`) — never redefine them. SPEC.md §1 scopes transport out explicitly. | Transport evolves with the shell; the protocol governs payload types only. |
| 9 | 2026-06-10 | Sidecar packaging: esbuild single-file bundle with native modules as externals, executed by **system Node ≥ 20** (already a hard product requirement — local-process spawns Node tooling regardless); env doctor validates at shell startup. No SEA/pkg/Bun compile. Revisit a pinned Node sidecar only before public release if support burden demands. | Bundling avoids shipping a runtime; the Node requirement already exists. |
| 10 | 2026-06-10 | `@nihil/protocol` gains a `./schemas` subpath export with `zod` as a **peerDependency**; the main entry stays zero-runtime-deps. Schemas are implemented when the daemon first needs boundary validation (M1 Task 2 acceptable). SPEC.md §9 and the CLAUDE.md invariant reflect this. | Runtime validation at the daemon boundary without polluting the dependency-free core. |
| 11 | 2026-06-10 | Daemon↔shell type sharing via the `@nihil/daemon/contracts` subpath export (type-only consumption by the shell) is approved as an implementation decision. Promote to a `packages/`-level module only if the shell bundler complains. | Avoids premature package proliferation; type-only imports erase at build. |
