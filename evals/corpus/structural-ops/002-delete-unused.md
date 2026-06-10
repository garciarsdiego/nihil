# structural-ops-002: Delete a file that is confirmed unused

**Category:** structural-ops  
**Probes:** delete (SPEC §4.3), engine prompt "implement exactly what was asked — nothing more", no drive-by cleanup of other "similar" files  
**Difficulty:** basic

## User Request
"The old LegacyHeader.tsx is no longer referenced anywhere. Delete it."

## Context
- The file tree and a "find references" summary (or the model's prior knowledge from the tree) confirm LegacyHeader is imported zero times.
- The model is shown the file's location and a one-line confirmation that it is dead.

## Rubric / Judge Criteria
- Exactly one `<nihil-delete path=".../LegacyHeader.tsx"/>`.
- The path is exact and the file exists in the provided tree.
- No other deletes, no "while I'm at it" removal of similar dead files the user did not mention.
- No write or edit that would have been unnecessary.
- After delete the project still builds (no import left that would cause a missing module error — the premise is that it was already unused).

## Expected High-Level Outcome
A single, precise delete. The model does not expand the request.
