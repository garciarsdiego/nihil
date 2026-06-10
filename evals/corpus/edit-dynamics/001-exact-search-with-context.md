# edit-dynamics-001: Exact SEARCH with sufficient surrounding context

**Category:** edit-dynamics  
**Probes:** exact match (SPEC §4.2 "SEARCH must match exactly once", "include 2–4 surrounding lines"), engine prompt "SEARCH text must be copied EXACTLY ... and must be unique"  
**Difficulty:** basic

## User Request
"In the main dashboard page (or App.tsx if that's where the layout lives), add a small live status indicator next to the header that re-uses the StatusBadge component you just created. Keep the change tiny."

## Context
- The project now contains the StatusBadge from a prior successful turn (the eval state is the result of previous corpus items or a described snapshot that includes it).
- The model is shown the current relevant slice of the target file (the header area) with 15-20 lines of real surrounding code.
- The request is a classic small targeted edit.

## Rubric / Judge Criteria
- Emits exactly one `<nihil-edit>` (preferred over write for a small change).
- The SEARCH block contains the exact text copied from the provided file excerpt, including original whitespace and line breaks.
- At least two lines of context before and after the change site are included so uniqueness is obvious.
- The REPLACE block produces the desired addition (import if needed + the badge usage in the header).
- No other actions.
- After the edit the project still typechecks (the import path matches how StatusBadge is exported).

## Expected High-Level Outcome
A single clean edit that would succeed on the first exact-match step of the apply chain. No round-trips needed.
