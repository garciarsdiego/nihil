# First real-model smoke — M1 (mode 2 / BYOK through OmniRoute)

**Date:** 2026-06-11 · **Model:** `cc/claude-sonnet-4-6` (Claude OAuth tier via
OmniRoute, OpenAI-compatible) · **Base URL:** `http://localhost:20128/v1`
(`/v1` present → no double-injection) · **maxTokens:** 16384 · **auth:** Bearer key
present (set via env only — never in the script or this report).

**What ran.** `apps/daemon/scripts/smoke-e2e.ts` (run via `tsx`) drove five
`evals/corpus` items through the **real turn loop** (engine → parser → runner →
git) against a **fresh `vite-react-shadcn` template** per item (real
`LocalProcessTarget.init()`, fresh session). Each raw response was re-parsed with
`NihilStreamParser` for tag well-formedness; apply-level outcomes were read from the
runner's `<nihil-output>` feedback. **Measurement only — no prompt tuning.**

The run was repeated **4×**; metrics below are the final run, and the cross-run
deltas are noted. No `429`s occurred; the courtesy 1.5 s inter-turn pause was enough.

## Raw results

| Item (probe) | Actions | Committed | Valid-tag rate | Apply errors | Elision | Latency | finish |
|---|---|---|---|---|---|---|---|
| `protocol-core/001` — complete write | 1 × write | ✅ | 1.00 | none | none | ~17–24 s | stop |
| `protocol-core/004` — multiple writes, order | 3 × write | ✅ | 1.00 | none | none | ~20–26 s | stop |
| `edit-dynamics/001` — exact search | 0 (prose) | — | n/a | none | n/a | ~8–10 s | stop |
| `edit-dynamics/002` — expects `EDIT_AMBIGUOUS` | 0 (prose) | — | n/a | none | n/a | ~5–21 s | stop |
| `feedback-recovery/001` — injected `<nihil-output>` | 1 × edit | ✗ | 1.00 | `FILE_NOT_FOUND` ×1 | none | ~9–28 s | stop |

**Aggregate (all turns, all 4 runs):** parser errors **0** · valid-tag rate **1.00**
on every acting turn · elision markers **0** · `EDIT_NO_MATCH` **0** ·
`EDIT_AMBIGUOUS` **0** · API-key occurrences in any captured output (assistant text,
feedback, errors, warnings) **0** · `finish_reason` always `stop` (no `length`
truncation) · engine errors **0**.

Cross-run variation was confined to `feedback-recovery/001`, where the model
alternated between **editing** the missing file (→ `FILE_NOT_FOUND`, not committed)
and **writing** it (committed). Both are valid recoveries (the rubric accepts a full
write); in **no run** did it repeat the previously-failed SEARCH.

## Reading

**Protocol conformance is excellent.** Every action tag the model emitted was
well-formed (valid-tag rate 1.00, zero parser errors across ~9 emitted actions over
4 runs), every closing tag landed on its own line, and **not one write contained an
elision marker** — complete files throughout (`protocol-core/004` wrote three files,
~3 KB, with no truncation). This is the single most important signal for a
tag-streaming protocol, and it is clean out of the box.

**The model is well-behaved against a false premise — it does not hallucinate
edits.** Two items assume project state the fresh template doesn't have, and the
model handled both correctly *without* fabricating an edit:
- `edit-dynamics/001` ("re-use the StatusBadge you just created") — the model
  noticed no `StatusBadge` exists, said so, and **asked** whether to create it.
- `edit-dynamics/002` ("change 'Get started' to 'Start building'") — the template's
  hero already says "Start building"; the model recognized the change was already
  done and made none.

**Feedback is consumed correctly.** Given an injected `EDIT_NO_MATCH`
`<nihil-output>`, the model copied the **exact** lines from the error's "current file
content" block into a new SEARCH (the rubric's pass condition) — it did not repeat
the failed edit. The apply then hit `FILE_NOT_FOUND` only because the referenced
`RepoListItem.tsx` doesn't exist in this template, which is a property of the test
fixture, not the model.

**OmniRoute / engine wiring is sound.** The `/v1` base URL routed to
`/v1/chat/completions` with no double-`/v1`; auth via Bearer worked; the key never
leaked into any output (redaction held); no rate limiting; latencies 5–28 s scaling
with output size.

## Caveats and follow-ups (for the architecture session)

1. **The edit-apply path was not truly exercised.** Three items (`edit-dynamics/001`,
   `/002`, `feedback-recovery/001`) assume files the fresh template lacks, so the
   model declined or hit `FILE_NOT_FOUND` rather than producing `EDIT_NO_MATCH` /
   `EDIT_AMBIGUOUS`. To measure exact-match, fuzzy fallback, and ambiguity behavior,
   a **complement run is needed against a seeded project** whose files match the
   items' assumptions (e.g. chain `protocol-core/004` → `edit-dynamics/001` in one
   session so `StatusBadge` exists, and seed a `RepoListItem.tsx` with the duplicated
   text the ambiguity item needs).
2. **Token usage was not captured** — the BYOK engine does not set
   `stream_options.include_usage`, so OmniRoute reports no usage object on the stream.
   Adding it (and surfacing usage on the `done` event) is a small engine change worth
   doing before scaled eval runs.
3. **No `length` truncation observed** at `maxTokens=16384`, including the 3-file
   write; the default cap looks adequate for these tasks.
4. **CI matrix** (win/ubuntu/macos) was pushed but its results were not fetchable from
   the dev environment (the GitHub REST API was unreachable here); confirm on the
   Actions tab.

**Decision deferred:** per the session plan, no system-prompt tuning was done — this
report is the measurement to bring to the architecture session.
