# BRIEF — Lane: Evals (Engine & Protocol Corpus)

## Mission
Produce a high-signal, original-text evaluation corpus (~30 items) that exercises the Nihil engine prompt and the protocol defined in SPEC.md. The corpus lives in a new top-level `evals/` directory as pure content (Markdown + supporting index/scoresheet/protocol docs). It is used later to measure and improve how faithfully the model emits protocol tags, recovers from feedback, respects constraints (design rules, named workflows, minimal change, plan discipline), and produces executable, high-quality outcomes.

No code changes, no daemon modifications, no new runtime harness in this lane — only the corpus and its documentation.

## Setup (as provided)
```
cd ~/projects/nihil && git fetch origin
git worktree add ../nihil-lane-evals -b lane/evals origin/main
cd ../nihil-lane-evals
```
Read first (mandatory):
- packages/protocol/SPEC.md §4 (full Tag Catalog, execution semantics, error codes, plan rules, conformance matrix)
- packages/knowledge/prompts/engine-prompts.md (BUILD MODE and PLAN MODE full text, design rules block, feedback instructions)

Copy AGENTS.md (this lane's binding rules) to the worktree root, then execute.

## Hard rules (binding)
- Write **only** inside the new top-level `evals/` directory for corpus content. Root may hold the lane's AGENTS.md + BRIEF.md + SUMMARY.md for the lane.
- Content only: Markdown + JSON index. No TypeScript, no test code, no copied source from templates or elsewhere.
- All text original — do not lift examples verbatim from SPEC or prompts; rephrase tasks and rubrics.
- Branch `lane/evals` exclusively. Never push to main.
- Items must be constructed so that a judge (human or future harness) can present the item, capture the model's raw response, and score it against explicit criteria that trace directly to the protocol and prompt rules.

## Deliverables (inside / at evals/)
- `evals/PROTOCOL.md` — evaluation methodology, item format, scoring dimensions, multi-turn feedback simulation, how to use the real parser/runner for objective signals.
- `evals/SCORESHEET-template.md` — reusable template for recording per-item scores and qualitative notes.
- `evals/index.json` — machine-readable catalog (id, category, file, probes, difficulty, status).
- `evals/corpus/<category>/NNN-title.md` — ~30 items total across 6 categories.
- `evals/SUMMARY.md` — self-review checklist (above) + flags (gaps found in protocol/prompt while writing items, coverage notes, open questions).

## Categories (initial)
1. protocol-core — basic tag emission, write completeness, path rules, escaping, closing-tag placement.
2. edit-dynamics — exact SEARCH, context sufficiency, sequential blocks, ambiguity detection, apply-chain behavior.
3. structural-ops — rename (with required import fixes), delete, copy, missing-file handling.
4. deps-execution — dependency batching, named-workflow only, ordering (files → deps → runs), long-running last.
5. plan-discipline — plan mode exclusivity, concrete step naming, trivial-task escape hatch, violation detection.
6. feedback-recovery — EDIT_NO_MATCH and other <nihil-output> handling, smallest-correct-fix, no-repeat-failure, error prioritization.

Target: 5 items per category = 30. Each item explicitly lists the rules (§ or sentence) it is probing.

## Gates
- All items original and traceable to SPEC §4 + engine-prompts rules.
- Commits land per category.
- SUMMARY.md checklist complete with evidence (diff stat, file counts, grep for "no code").
- Push to the lane branch.
- Any discovered ambiguities or missing test surface in the protocol/prompt are called out in SUMMARY.md (these become input to later protocol or prompt refinement).

## Non-goals for this lane
- Implementing an automated eval harness (that is Task X+).
- Changing the daemon, parser, or prompts.
- Adding real project fixtures with source trees (describe state at high level only).

Execute the plan in AGENTS.md.
