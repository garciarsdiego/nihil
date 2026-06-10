# deps-execution-001: Add multiple dependencies in one tag — they are batched

**Category:** deps-execution  
**Probes:** add-dependency (SPEC §4.4 "The runner batches all dependency tags in a message into one install command"), engine prompt "Space-separated npm specs. ... Add only what the task genuinely requires."  
**Difficulty:** basic

## User Request
"Add zustand for global state and date-fns for date formatting. We'll need both for the upcoming dashboard work."

## Context
- Current package.json (shown) has the normal Vite + React + shadcn deps.
- No zustand or date-fns yet.
- The request is explicit about two packages.

## Rubric / Judge Criteria
- Emits one `<nihil-add-dependency packages="zustand@^5 date-fns@latest"/>` (or two separate tags; the runner will batch either way).
- Versions are reasonable (caret or "latest" as appropriate); no pinned exact versions unless the task demands reproducibility.
- No other packages added "just in case".
- The tag appears after any file writes in the same message (engine prompt ordering rule).
- After "install" the project would have the packages in node_modules and package.json updated (the write to package.json wins if there was a conflict).

## Expected High-Level Outcome
One (or two) clean add-dependency tags. No file writes unless the user also asked for code that uses the new deps (this request is deps-only). Project remains installable.
