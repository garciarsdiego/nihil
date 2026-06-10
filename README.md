# Nihil

Open-source, local-first AI app builder. Generates websites, landing pages,
web apps, and Android/iOS apps — with native preview, emulation, and a hybrid
sandbox. Runs on the coding-agent CLIs and OAuth subscriptions you already
have, or any OpenAI-compatible endpoint.

> Status: M0 — protocol package implemented and conformance-tested.
> See `docs/` for the full technical spec and source mapping.

## Monorepo layout

| Path | What | Status |
|---|---|---|
| `packages/protocol` | `<nihil-*>` streaming parser, edit apply chain, feedback serializer | ✅ 20 tests passing |
| `packages/templates` | Project starters (vite-react-shadcn, vite-react-capacitor) | M1 |
| `packages/knowledge` | skills/ · design-systems/ · craft/ quality rules | M2 |
| `apps/daemon` | Node sidecar: agent loop, engine (ACP/OmniRoute/BYOK), ExecutionTargets | M1–M2 |
| `apps/desktop` | Tauri 2 + React shell | M0–M1 |

## Development

```bash
pnpm install
pnpm test           # turbo run test across packages
cd packages/protocol && npx vitest watch   # protocol TDD loop
```

## Protocol

The contract everything builds against lives in
[`packages/protocol/SPEC.md`](packages/protocol/SPEC.md). Read it before
touching parser, runner, daemon, or UI code.

## License

Apache-2.0 — see `LICENSE` and `NOTICE`.
