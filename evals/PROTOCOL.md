# Nihil Evals Protocol (Corpus v1)

**Scope:** This document defines how the corpus in `evals/corpus/` is used to evaluate an engine (LLM + prompt assembly + protocol adherence). It is descriptive; the actual harness lives in a future task.

## Item Anatomy (every .md)
- Header with stable `id` (category-NNN), title, category, `probes` (list of rule citations or keywords), difficulty.
- **User Request:** the natural language ask the user would type. May include follow-ups for multi-turn items.
- **Context:** high-level description of the project state presented to the model (template, key files present/absent, any DESIGN.md or nihil.config.json facts). Never large verbatim source dumps.
- **Simulated Prior Turns (when relevant):** the exact `<nihil-output>...</nihil-output>` blocks that would be injected into the next user message per the runner.
- **Rubric / Judge Criteria:** 4–8 concrete, scorable statements. Each must map to a sentence or table row in `packages/protocol/SPEC.md` §4 or a bullet in `packages/knowledge/prompts/engine-prompts.md`. Example citations: "SPEC §4.2 exact match requirement", "engine prompt: complete file, never elide", "engine prompt: for EDIT_NO_MATCH, re-read excerpt and either retry exact or rewrite", "SPEC §8 PLAN_MODE_VIOLATION".
- **Expected High-Level Outcome:** what a correct response looks like (tags emitted or not, order, recovery behavior, final state properties).

## Scoring Dimensions (use SCORESHEET-template.md)
1. **Protocol Syntax (0-5):** Did emitted tags parse cleanly? Correct closing placement, attribute escaping, path normalization, fence stripping for writes, self-closing for structural ops, only allowed tags.
2. **Edit Fidelity (0-5):** For edit tags, were SEARCH strings byte-exact (or ws-normalized with warning) and unique? Did multi-block edits apply sequentially? Did the model add sufficient context lines?
3. **Constraint Adherence (0-5):** Followed minimal-change, no unrequested deps/features, named workflows only, no secrets, design rules in any UI code emitted, conversation-first when appropriate, plan-mode exclusivity.
4. **Feedback Recovery (0-5):** When `<nihil-output>` present, treated errors as top priority; produced smallest correct fix; did not repeat a failing edit unchanged; concise ack.
5. **Outcome Quality (0-5):** After "execution" (manual or harness apply + build), the change matches the request exactly, project remains in a buildable state, emitted content follows design rules, no placeholders or stubs left.
6. **Communication (0-5):** Brief intent statement + 1-2 sentence summary; realistic copy (no lorem); appropriate plan concreteness or "trivial, proceeding directly" escape.

Overall item score is not a simple average; a single hard failure on a core rule (e.g. emitting a plan tag + write tag in plan mode) can cap the item at 2/5 regardless of other dimensions.

## Multi-Turn Simulation
For recovery items the corpus provides the prior `<nihil-output>` XML exactly as the daemon would serialize it (see SPEC §4.7). In a harness this block is prepended to the next user message before the current request. The model sees the error details (including surrounding file content where supplied) and must act on it.

## Objective Signals (harness can compute these)
- Run the real `NihilStreamParser` (from `@nihil/protocol`) over the model's full response text. Record:
  - `actions` parsed (count + kinds)
  - `protocolErrors` (UNKNOWN_TAG, MALFORMED_TAG, PLAN_MODE_VIOLATION, STREAM_TRUNCATED, etc.)
  - For every edit action, whether its SEARCH blocks would have hit exact / ws-normalized / fail under the apply chain rules (this requires a snapshot of target file content at that point in the stream).
- Ordering check: file actions before batched deps before (non-long-running) runs; long-running runs appear last.
- No raw shell in any `<nihil-run workflow>` value.
- Path checks: all paths relative, no `..` segments (parser would have rejected; model should not emit them).

## Subjective / Quality Signals (human or LLM-as-judge with strict prompt)
- Design rules adherence for any emitted component/page content (3-5 color roles, ≤2 font families, realistic text, meaningful states, shadcn/ui preference, AA contrast implied by token use).
- Minimalism: no drive-by refactors, no extra files, no bonus dependencies.
- Plan quality (when plan mode): every step names concrete files, dependencies, or workflows; risks or open questions listed; no vague "improve the UX".
- Recovery quality: smallest diff that addresses the exact error reported.

## Execution Model for an Item (idealized harness loop)
1. Assemble the engine prompt (BUILD or PLAN) with the item's project state (file tree slice + selected file excerpts + workflows + template notes + design rules).
2. If the item supplies prior outputs, inject them as the first part of the "user" message.
3. Send the current user request.
4. Capture the *entire* assistant response (no post-processing that would hide tags).
5. Parse with the real parser → obtain actions + errors.
6. If plan mode item: assert zero non-plan actions and no PLAN_MODE_VIOLATION error (unless the item is testing the violation case).
7. Materialize actions against a fresh temp copy of the described project state (using the real runner or a test ExecutionTarget).
8. Run the project's typecheck/build (or dry-run equivalent) and record success/failure + any validator warnings.
9. Score each rubric line 0/1 and produce dimension scores + free-text notes.
10. For multi-turn items, feed any produced `<nihil-output>` back and repeat from step 3 with the item's next request.

## Item Lifecycle Flags (recorded in index.json or per-item frontmatter)
- `status`: draft | ready | reviewed | stable
- `lastReviewed`: date
- `knownHarnessGaps`: list of things the current parser/runner cannot yet signal automatically (e.g. "design rule color count requires visual/LLM judge")

## Versioning
Corpus version lives in `index.json`. When a protocol or prompt change makes an item invalid or too easy, the item is either updated (with a note) or superseded by a new id in the same category; old id remains for historical comparison.

## Anti-Patterns (forbidden in this corpus)
- Copying large chunks of real project source into items.
- Items that only test "the model is creative" rather than rule fidelity.
- Rubrics that cannot be traced to a sentence in SPEC §4 or the engine prompt.
- Items that would require the model to violate "never write secrets" to pass.

This protocol + the corpus items together form the ground truth for later automated regression and for prompt/protocol refinement loops.
