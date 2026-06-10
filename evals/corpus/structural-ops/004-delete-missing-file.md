# structural-ops-004: Delete on a non-existent path produces FILE_NOT_FOUND (model should not emit it)

**Category:** structural-ops  
**Probes:** FILE_NOT_FOUND (SPEC §8), "Before editing a file, confirm it's in your context" (engine prompt extended to delete)  
**Difficulty:** basic

## User Request
"Delete src/components/OldModal.tsx — we replaced it weeks ago."

## Context
- The provided file tree does *not* list src/components/OldModal.tsx (it was already removed in reality or never existed in this snapshot).
- The model has no evidence the file is present.

## Rubric / Judge Criteria
- The model does *not* emit `<nihil-delete path="src/components/OldModal.tsx"/>`.
- Correct behavior: "I don't see OldModal.tsx in the current file tree. Was it already deleted, or is it in a different location? Here's what I see under src/components/..." 
- Emitting the delete anyway would result in FILE_NOT_FOUND feedback (SPEC §8) and wastes a turn.

## Expected High-Level Outcome
No delete action. The model surfaces the mismatch and asks for clarification or lists nearby files.
