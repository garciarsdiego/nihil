# edit-dynamics-003: Multi-block edit where later blocks depend on earlier results

**Category:** edit-dynamics  
**Probes:** sequential application (SPEC §4.2 "later blocks see earlier blocks' results", SPEC §7 "Edit with 3 SR blocks where block 2 depends on block 1's result" in conformance), engine prompt "Multiple blocks in one tag apply top to bottom"  
**Difficulty:** medium

## User Request
"Refactor the header component so that the mobile menu state lives in a small custom hook, and update the header to use that hook. Do the extraction and the call site update in one edit if possible."

## Context
- A Header.tsx (or equivalent) exists with inline useState for isOpen / mobile menu.
- The model is shown the full current file content (or a large enough excerpt).
- The task requires first extracting the state logic, then changing the call site inside the same file.

## Rubric / Judge Criteria
- One `<nihil-edit>` containing *two or more* SEARCH/REPLACE blocks.
- Block 1 extracts the logic (creates the hook usage or moves state).
- Block 2 (and any later) operates on the *post-block-1* text of the file; its SEARCH therefore matches text that only exists after block 1 has been applied.
- The final result after all blocks in the tag is correct and typechecks.
- If the model puts the blocks in the wrong order or writes SEARCHes that assume the original file for every block, the apply would fail on block 2+ and the item fails Edit Fidelity.

## Expected High-Level Outcome
A single edit tag with correctly ordered dependent blocks. The runner's sequential apply succeeds without EDIT_NO_MATCH on later blocks.
