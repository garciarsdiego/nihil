# deps-execution-005: Remove a dependency that is no longer used

**Category:** deps-execution  
**Probes:** remove-dependency (SPEC §4.4), engine prompt "Add only what the task genuinely requires" (symmetric for removal), batching with other dep ops if present  
**Difficulty:** basic

## User Request
"We switched away from react-query. Remove @tanstack/react-query from the project."

## Context
- The package is listed in package.json.
- A quick tree + import search (provided) shows no remaining imports of it in the current source.
- The task is a pure removal.

## Rubric / Judge Criteria
- Emits `<nihil-remove-dependency packages="@tanstack/react-query"/>`.
- No other packages are removed unless the user asked.
- If the model also wants to clean up config or lockfile artifacts it does so with a write/edit, not by assuming the remove tag does everything.
- After the dep change the project would still install and the (now unused) package is gone from package.json.

## Expected High-Level Outcome
Clean removal. The model does not also delete random other packages "for good measure".
