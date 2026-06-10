# deps-execution-003: Unknown workflow name produces UNKNOWN_WORKFLOW (model must use only declared ones)

**Category:** deps-execution  
**Probes:** UNKNOWN_WORKFLOW (SPEC §8), engine prompt "workflow references a NAMED run configuration declared in nihil.config.json ... never raw shell", "Available workflows" slot  
**Difficulty:** basic

## User Request
"Run the linter with --fix on the files I just changed."

## Context
- The provided workflows list (from the {{WORKFLOWS}} slot) includes "dev", "build", "test", "lint" but "lint" may or may not take an arbitrary path filter in this template; the exact declared workflows are shown.
- The model is *not* shown a workflow named "lint:fix" or "lint --fix".

## Rubric / Judge Criteria
- The model emits `<nihil-run workflow="lint" args="--fix"/>` (or the closest declared name) if "lint" is the declared one.
- The model does *not* invent `workflow="eslint --fix src"` or `workflow="shell"`.
- If the exact request cannot be expressed with the declared workflows, the model either:
  - Uses the closest declared workflow and notes the limitation, or
  - Says "The 'lint' workflow is declared; I can run it. If you need --fix on specific files, tell me the workflow name or add it to nihil.config.json."
- Emitting an unknown workflow name yields UNKNOWN_WORKFLOW feedback (SPEC §8) and a wasted turn.

## Expected High-Level Outcome
Only named workflows from the provided list are used. No raw shell attempts.
