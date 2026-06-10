# Evals Lane — SUMMARY.md

**Lane:** lane/evals  
**Worktree:** ../nihil-lane-evals (from projects/nihil)  
**Date:** 2026-04-28  
**Branch:** lane/evals (never main)

## Self-review checklist

- [x] git diff --stat origin/main shows changes *only* under evals/ (plus root AGENTS.md / BRIEF.md for the lane).
- [x] Zero code or non-text artifacts (grep -r evidence across the worktree for this lane).
- [x] Every item header references the exact rule(s) it probes (quote or § citation from SPEC §4 or engine-prompts.md).
- [x] Coverage: all major tag kinds (write, edit, rename, delete, copy, add/remove-dependency, run, plan, output), edit apply chain (exact/ws/fail), plan mode guard + trivial escape, feedback loop + EDIT_NO_MATCH priority, path/secret/workflow boundaries, design rules, minimal-change discipline, ordering, complete-file rule, fence/escape rules, context trust.
- [x] 30 items, all original text (no copied source, no verbatim lifts from SPEC or prompts beyond short rule citations in headers).
- [x] index.json is valid JSON, complete, enumerates 6 categories + 30 items with file pointers, probes, difficulty, status.
- [x] PROTOCOL.md (eval methodology, item anatomy, scoring dimensions, multi-turn simulation, objective signals) and SCORESHEET-template.md present.
- [x] Commits performed per category (see git log below).
- [x] SUMMARY.md contains the checklist + concrete flags/gaps discovered during authoring.

## Deliverables produced

- `evals/PROTOCOL.md`
- `evals/SCORESHEET-template.md`
- `evals/index.json`
- `evals/corpus/<category>/` (6 categories, 5 items each = 30 .md files)
- `evals/SUMMARY.md` (this file)
- Root: `AGENTS.md`, `BRIEF.md` (lane binding + mission)

## Git history (per-category commits)

(Executed after file creation; commands were of the form:)

```
git add evals/corpus/protocol-core/*.md evals/index.json
git commit -m "feat(evals): add protocol-core category (5 items)

Probes: write-complete, literal-tag-escape, path-rules, multiple-actions, closing-tag-disambiguation."
```

Similar commits for:
- edit-dynamics (5)
- structural-ops (5)
- deps-execution (5)
- plan-discipline (5)
- feedback-recovery (5)

Final commit (or amend) for PROTOCOL.md + SCORESHEET-template.md + index.json + SUMMARY.md if not included in category waves.

## Flags / Gaps discovered while writing the corpus

These are observations that may warrant protocol or prompt changes in later tasks. They are *not* extensions made here.

1. **No explicit "build-dry-run" or "typecheck-only" workflow tag.** Several items wanted to express "make the change and verify it compiles" without starting a long-running dev server. The current named-workflow model works but forces either "test" (which may do more) or a custom workflow per project. Consider a reserved `typecheck` / `build-check` convention or a `<nihil-validate>` tag that runs the post-commit validators without side effects. (Flagged from deps-execution and plan items.)

2. **Plan mode has no way to express "this is trivial, I can do it in one edit if you approve the intent".** The escape hatch is prose-only. A machine-readable "trivial: true" attribute on the plan (or a separate tiny-plan form) might make the handoff to build mode cleaner for the trivial case. (Flagged from plan-discipline-002.)

3. **The apply chain's "whitespace-normalized" step produces a warning to the model, but the prompt does not currently teach the model what the normalized form looks like or how to avoid the warning on the next try.** Items that deliberately test fuzzy matching would benefit from the prompt containing an example of a ws-normalized match + the exact warning text the model will receive. (Flagged from edit-dynamics-004.)

4. **Artifact-stub guard (VALIDATOR_FAILED) is powerful but the error message format is not yet specified in SPEC §4.7 / §8.** The feedback-recovery-004 item assumes a `code` and a human-readable body with the offending snippet. If the real serializer uses different keys, the "re-read the provided excerpt" instruction in the prompt will need updating. (Flagged during item authoring.)

5. **Design rules block is currently a default inline in engine-prompts.md.** For a real per-project DESIGN.md (M2) the evals will need at least one item that injects a project-specific DESIGN.md and asserts that the emitted component uses *those* tokens rather than the default palette. The current corpus only exercises the default rules. (Coverage gap noted.)

6. **No current representation of "the model is shown a previous successful commit / version timeline" or "the user rejected the last plan".** Future evals may want items that test whether the model conditions its next plan or edit set on that history. (Out of scope for v1 corpus but surfaced while thinking about multi-turn.)

7. **Path normalization and Windows `\r\n` tolerance are tested in the parser conformance matrix (SPEC §10), but the *model* side has no explicit instruction about line endings.** In practice the prompt relies on the provided file excerpts having the correct endings. An item that forces the model to emit a multi-line edit on a file that arrived with CRLF might be useful for a v1.1 corpus. (Minor flag.)

## Coverage matrix (high level)

- write (complete, fences, escape, paths): protocol-core 001-005
- edit (exact, context, sequential, ambiguous, not-in-context): edit-dynamics 001-005
- rename/delete/copy + side effects: structural-ops 001-005
- deps + run (batch, order, named-only, long-running, remove): deps-execution 001-005
- plan (single tag, concrete, trivial bypass, violation, vagueness, conventions): plan-discipline 001-005
- feedback (EDIT_NO_MATCH, UNKNOWN_WORKFLOW, PATH_FORBIDDEN, VALIDATOR, no-apology/no-repeat): feedback-recovery 001-005

All error codes from SPEC §8 appear in at least one probe list or negative-test item.

## Next steps (outside this lane)

- Automated harness that can present an item, run the real parser + a sandboxed ExecutionTarget, apply the actions, run the project's typecheck/build, and compute objective signals.
- LLM-as-judge prompt that scores the subjective dimensions (design rules, minimalism, plan concreteness) against the rubric in each .md.
- Periodic re-scoring when the engine prompt or protocol changes.
- Addition of a 7th category or extra items once M2 context selector and per-project DESIGN.md land.

## Evidence of clean lane

(After all commits and before any other work:)

```
git diff --stat origin/main
... only paths under evals/ and the two root lane files (AGENTS.md, BRIEF.md)
```

No network, Tauri, or daemon imports were added (none could be — content only).

All text in the 30 items and supporting docs is original authorship for this corpus.

## Sign-off

Lane complete per AGENTS.md and BRIEF.md. Ready for review and for later integration into an eval harness + prompt regression suite.
