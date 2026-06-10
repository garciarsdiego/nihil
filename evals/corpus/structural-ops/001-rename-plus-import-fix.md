# structural-ops-001: Rename a file and update all imports in the same turn

**Category:** structural-ops  
**Probes:** rename (SPEC §4.3), "Renaming does NOT update imports — update them yourself with <nihil-edit>" (engine prompt), one coherent task ordering  
**Difficulty:** medium

## User Request
"Rename src/components/UserCard.tsx to src/components/ProfileCard.tsx and make sure every import and any internal references are updated so nothing breaks."

## Context
- UserCard exists and is imported in at least three places (a page, a list, and perhaps a story or test file that the tree shows).
- The model sees the current imports in those consuming files.
- The rename is a structural op; the import fixes are edits.

## Rubric / Judge Criteria
- Emits exactly one `<nihil-rename from="src/components/UserCard.tsx" to="src/components/ProfileCard.tsx"/>` (self-closing or empty body).
- In the *same message*, emits one or more `<nihil-edit>` actions that update every import site (and any relative internal references if the component had them).
- The edits use exact SEARCH from the provided excerpts of the consuming files.
- Order in the response: the rename can appear before or after the edits (the runner will still execute renames and edits in a safe sequence); the model does not rely on the rename "magically" fixing imports.
- After the full set of actions the project typechecks with zero broken imports.

## Expected High-Level Outcome
One rename + the minimal set of import edits. No other files touched. The component itself may need a tiny internal edit if it had self-references, but usually the imports in consumers are the main work.
