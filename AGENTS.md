# AGENTS.md — Nihil Lane: evals (corpus & evaluation protocol)

This worktree is ONE lane of a parallel effort on Nihil. These rules
bind all work.

## Hard boundaries
- WRITE access: `evals/**` only (new top-level directory). 
- READ-ONLY everything else. Never modify: apps/**, packages/**, docs/**, root configs, or any source.
- Branch: `lane/evals` only. Never push to main.
- CONTENT ONLY: Markdown files + index.json. No code, no test fixtures containing source, no scripts, no executables.
- All text must be original. Items exist to probe the *real* rules.
- Read `packages/protocol/SPEC.md` §4 (Tag Catalog, grammar, apply chain, error codes, plan violation, conformance) and `packages/knowledge/prompts/engine-prompts.md` (BUILD/PLAN prompts, complete-write rule, exact SEARCH, feedback priority, named-workflows only, design rules, minimal change, no secrets) *before authoring any item*.
- If a corpus item reveals a missing field, ambiguous rule, or untested failure mode in the protocol or prompt: flag it explicitly in SUMMARY.md. Do not unilaterally extend either.

## Corpus rules
- ~30 items total.
- Organized by category subdirectories under `evals/corpus/`.
- Each item is a self-contained .md with: ID, title, category, probes list, difficulty, user request, relevant project state (high-level, no large code dumps), and a clear rubric / judge criteria that maps back to specific sentences in SPEC §4 or the engine prompt.
- Commit changes per category (one commit = one category's items + any index updates for them).
- Final artifacts at `evals/` root: PROTOCOL.md (how the corpus is used), SCORESHEET-template.md, index.json, SUMMARY.md.

## Self-review checklist (copy into evals/SUMMARY.md)
- [ ] git diff --stat origin/main shows changes *only* under evals/ (plus root AGENTS.md / BRIEF.md if added for the lane).
- [ ] Zero code or non-text artifacts (grep -r evidence).
- [ ] Every item header references the exact rule(s) it probes (quote or § citation).
- [ ] Coverage: all major tag kinds, edit apply chain, plan mode guard, feedback loop, path/secret/workflow boundaries, design rules, minimal-change discipline.
- [ ] ~30 items, original text throughout.
- [ ] index.json is valid and complete; categories enumerated.
- [ ] PROTOCOL.md and SCORESHEET-template.md present and self-explanatory.
- [ ] SUMMARY.md contains the checklist + concrete flags/gaps discovered.
- [ ] Commits are per-category; branch is lane/evals; push performed.
