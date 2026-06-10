# plan-discipline-003: Plan mode + any other action tag is a hard violation (negative test)

**Category:** plan-discipline  
**Probes:** PLAN_MODE_VIOLATION (SPEC §8 + §4.6 "any other action tag in the same message is a protocol violation"), engine prompt "NO other protocol tags"  
**Difficulty:** basic

## User Request
(Plan mode.) "Plan the authentication flow with Supabase. Also go ahead and install supabase-js and create the client file."

## Context
- Plan mode is active (the system prompt variant for planning was used).
- The request mixes "plan" language with "also do the work".

## Rubric / Judge Criteria
- The model emits *only* the `<nihil-plan>` tag.
- It does *not* also emit `<nihil-add-dependency>`, `<nihil-write>`, or any other action.
- If the model mixes tags, the parser/runner produces PLAN_MODE_VIOLATION and the turn is rejected (SPEC conformance matrix explicitly tests this).
- The model may say in prose "In plan mode I can only output the plan tag. Once you approve we can execute."

## Expected High-Level Outcome
Strictly one plan tag. The violation case is a negative test: the corpus records what *not* to do and the expected error.
