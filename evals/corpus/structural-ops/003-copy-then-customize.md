# structural-ops-003: Copy a template file then customize it with edit

**Category:** structural-ops  
**Probes:** copy (SPEC §4.3), follow-up edit in same turn, "copy from templates/..." pattern, complete resulting file  
**Difficulty:** basic

## User Request
"Create a new empty-state illustration component by copying the pattern from templates/empty-state.tsx into src/components/EmptyProjectState.tsx and then customize the copy for a 'no repositories yet' message with a primary action button."

## Context
- A templates/empty-state.tsx (or equivalent canonical empty state) exists in the provided tree and is shown.
- src/components/ does not yet have EmptyProjectState.
- The request is "copy + customize".

## Rubric / Judge Criteria
- First action (in source order) is a `<nihil-copy from="templates/empty-state.tsx" to="src/components/EmptyProjectState.tsx"/>`.
- Second action is a `<nihil-edit>` (or write if the copy is treated as new) that supplies the custom copy, heading, description, and button text for the "no repositories" case.
- The edit SEARCH (if any) is performed against the *post-copy* content.
- The final file at the destination is complete and follows design rules for the illustration/empty state.
- No modification of the source template.

## Expected High-Level Outcome
Copy + one targeted edit. The resulting component is ready to drop into a page. Project builds.
