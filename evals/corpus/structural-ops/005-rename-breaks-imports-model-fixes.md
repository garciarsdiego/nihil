# structural-ops-005: Rename that would break imports — model fixes in same turn or notes the risk

**Category:** structural-ops  
**Probes:** rename does not auto-update (engine prompt), "Note risks or open questions at the end" (plan mode, but analogous for build), minimal change + completeness  
**Difficulty:** medium

## User Request
"Rename the main API client file from src/lib/api.ts to src/lib/httpClient.ts. Make sure the app still works."

## Context
- src/lib/api.ts is imported in many places (the tree + excerpts show 6-8 distinct import sites across services and pages).
- Some imports are `import { api } from '@/lib/api'`, others are default or namespace.

## Rubric / Judge Criteria
- The rename is emitted.
- The model also emits the *complete set* of import edits required (or a single edit to a barrel if one exists) so that after the turn the project has no broken imports.
- If the number of sites is large, an acceptable alternative (still scoring well) is a clear note in the summary prose: "This rename touches 8 import sites; I updated the most critical ones. The remaining ones will cause type errors on next dev start — want me to do the rest in the next turn?"
- Simply renaming and hoping the user will fix imports later scores lower on Outcome Quality.

## Expected High-Level Outcome
Rename + sufficient edits (or explicit partial + risk note). After apply, the main dev workflow would start without immediate import errors for the primary usage paths.
