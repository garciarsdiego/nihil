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

---

# Round 2 — seeded edit-apply chain + token usage

**Date:** 2026-06-11 · same model/endpoint (`cc/claude-sonnet-4-6` via OmniRoute).
Run: `npx tsx scripts/smoke-e2e.ts round2`.

Round 1 could not exercise the edit-apply path (the fresh template lacked the files
the items assume). Round 2 **seeds the project** with 3 fixture files
(`src/components/StatusBadge.tsx`, `src/components/Header.tsx` with inline
`useState` + a `<nav>` lacking an aria-label, `src/pages/Landing.tsx` with "Get
started" appearing twice) and runs the four edit-dynamics items. The harness now
**re-runs `applyEditBlocks` against the known seed content** to read the apply mode
directly (exact vs fuzzy-ws), and the engine was extended to request + surface a
token-`usage` block (`stream_options.include_usage`).

## Results

| Item | Actions | Apply chain (vs seed) | Committed | prompt tok | completion tok | total | latency |
|---|---|---|---|---|---|---|---|
| `001` status indicator | 2 × edit | Landing **2× exact**; SiteHeader edit on a template file (not a seed) | ✅ | 2052 | 2847 | 4899 | 60.1 s |
| `002` "Get started" → "Start building" everywhere | 1 × edit (2 blocks) | Landing **2× exact** — split into two distinct-context blocks; **no EDIT_AMBIGUOUS** | ✅ | 2030 | 218 | 2248 | 20.6 s |
| `003` extract mobile-menu state into a hook | 1 × write + 1 × edit (3 blocks) | Header **3× exact, sequential** (imports → state → handler) + wrote `useMobileMenu.ts` | ✅ | 13387 | 1936 | 15323 | 30.1 s |
| `004` add aria-label to the nav landmark | 1 × edit | Header **1× exact** | ✅ | 13366 | 1466 | 14832 | 25.4 s |

**Aggregate:** 8 edit blocks applied, **8 exact / 0 fuzzy-ws / 0 EDIT_NO_MATCH / 0
EDIT_AMBIGUOUS**. valid-tag rate **1.00**, elision **0**, key leak **0**. Total
**~37.3 K tokens** across 4 turns (prompt 30.8 K + completion 6.5 K); **cost $0**
(Claude OAuth tier via OmniRoute). Latency 20–60 s, dominated by completion size +
the larger (seeded) prompts on 003/004.

## Reading

**The edit-apply chain works end-to-end with a real model, and the model edits
byte-exact.** All 8 SEARCH blocks matched at the **exact** step — the model copies
the file content it is shown faithfully, so the whitespace-fuzzy fallback was never
needed. That is the desired behavior; it also means the **fuzzy-ws path remains
unexercised by a real model** (it is covered by the protocol property tests, not
here) — to force it you would have to feed the model a deliberately whitespace-drifted
excerpt.

**Ambiguity is avoided by construction (002).** Asked to change "Get started"
"everywhere", the model did **not** emit a single search that would match twice;
it emitted one `<nihil-edit>` with **two distinct-context blocks** (disambiguating
the second occurrence by its `variant="secondary"` attribute) — the corpus rubric's
pass behavior. So `EDIT_AMBIGUOUS` was avoided rather than triggered.

**Sequential multi-block edits apply in order (003).** The model wrote the new hook
and emitted a 3-block edit whose later blocks match text that only exists after the
earlier blocks — all three applied exact, in order.

**Token usage is now captured** (engine `stream_options.include_usage` →
`done.usage` → `TurnResult.usage`). Prompt cost scales with seeded context (2 K vs
13 K when `Header.tsx` is in play).

## Gaps / follow-ups (round 2)

1. **The runner does not surface a fuzzy-ws warning.** On a successful normalized
   (whitespace-fuzzy) apply the runner just writes the file (`runner.ts` edit path)
   — it never feeds the SPEC §7 / eval-004 "ws-normalized, here is the exact form"
   warning back to the model. Real models didn't hit this here (they matched exact),
   but the warning is part of the contract and is currently missing. Architecture
   decision: add it (the apply chain already returns the mode in `applied[].mode`).
2. **Cross-model round (Track B #3) is pending** the OmniRoute model id for a
   non-Claude tier (Kimi / GLM) — the real protocol-robustness test. Harness is
   ready; only the `NIHIL_ENGINE_MODEL` value is needed.
3. Fuzzy-ws remains unexercised by a live model (see Reading) — optional: a fixture
   with deliberately drifted whitespace to confirm the fallback + (1)'s warning.
