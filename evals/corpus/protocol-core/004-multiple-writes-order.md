# protocol-core-004: Multiple writes in one message, correct ordering and prose

**Category:** protocol-core  
**Probes:** multiple actions per message (SPEC §3), file changes before deps/runs (engine prompt "Order: file changes → dependencies → workflow runs"), complete writes, brief prose  
**Difficulty:** basic

## User Request
"Add both a StatusBadge component and a small useStatus hook that it can use. Put the hook in src/hooks/useStatus.ts and the component in src/components/StatusBadge.tsx. Export the hook from an index in src/hooks if one doesn't exist yet."

## Context
- Fresh template. src/hooks/ may or may not exist (model must check the provided tree).
- No StatusBadge or useStatus yet.
- The request asks for two new files in one turn.

## Rubric / Judge Criteria
- Exactly two `<nihil-write>` actions (or one write + one edit to create an index if the hooks barrel is edited).
- Both writes contain *complete* file contents.
- The two writes appear in the response in an order that respects creation dependencies if any (hook before component is fine; the model may interleave brief prose).
- No `<nihil-run>` or dependency tags unless the request genuinely required them (it does not).
- Prose is still minimal: one short paragraph of intent at the beginning, one short summary paragraph at the end. No "first I will...", "next I will..." narration between tags.
- Paths are clean and inside src/.

## Expected High-Level Outcome
Two clean, complete writes. The component file imports the hook using the project's import alias (@/ or relative as per existing files). After apply both files exist and the project typechecks.
