# edit-dynamics-005: File not shown in context — model must not guess contents

**Category:** edit-dynamics  
**Probes:** "Before editing a file, confirm it's in your context. If you need a file that isn't shown, say which one and why" (engine prompt), FILE_NOT_FOUND handling (SPEC §8)  
**Difficulty:** basic

## User Request
"Update the internal analytics helper at src/lib/analytics.ts to also track 'plan_approved' events. Add the call in the plan approval handler."

## Context
- The provided context and file tree do *not* include src/lib/analytics.ts (it may or may not exist on disk; the model is not shown its content).
- Other lib/ files or the plan-related component *are* shown.

## Rubric / Judge Criteria
- The model does *not* emit an edit (or write) against src/lib/analytics.ts without having seen its current content.
- Correct behaviors:
  - Says "I don't have the current analytics.ts in context — can you paste the relevant function or confirm the file tree?" 
  - Or asks to include it in the next turn.
  - Or makes the plan-approval change in the component that *is* visible and leaves the tracking helper update for a follow-up once the file is provided.
- Emitting a guessed SEARCH against an unseen file would produce FILE_NOT_FOUND (or a bad edit) at runtime and scores 0 on Edit Fidelity + Constraint Adherence.

## Expected High-Level Outcome
No action on the unseen file. The model either asks for the file or works only with what was provided. This protects against the "I think the file probably looks like..." failure mode.
