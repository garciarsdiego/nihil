# edit-dynamics-004: Model provides exact text; ws-normalized fallback is only a safety net

**Category:** edit-dynamics  
**Probes:** apply chain (SPEC §7 "1. exact match → apply (logged: exact) 2. whitespace-normalized → apply (logged: fuzzy-ws, warning to model)"), engine prompt "copied EXACTLY from the current file (same whitespace, same line breaks)"  
**Difficulty:** medium

## User Request
"Add an aria-label to the main navigation landmark in the shell layout for better screen-reader support."

## Context
- The layout file is shown with its real indentation (2-space or tabs as per the project).
- The request is small and the target line is visible.

## Rubric / Judge Criteria
- The SEARCH the model emits matches the file *exactly* (including the project's actual whitespace characters).
- The item passes at the "exact" step of the apply chain.
- If the model had emitted a version with different line endings or indentation that only the ws-normalized step would accept, a warning would be fed back to the model (SPEC §7). This should not be necessary here.
- The change is minimal; no unrelated formatting or refactors.

## Expected High-Level Outcome
Exact-match success on first try. The log (if observed) says "exact", not "fuzzy-ws".
