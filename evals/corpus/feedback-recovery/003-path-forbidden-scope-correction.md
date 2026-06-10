# feedback-recovery-003: PATH_FORBIDDEN — model narrows scope to the visible project root on recovery

**Category:** feedback-recovery  
**Probes:** PATH_FORBIDDEN (SPEC §8), engine prompt "Never absolute, never containing '..' ", "Trust the provided file tree"  
**Difficulty:** medium

## User Request (Turn 1, then Turn 2)
Turn 1 (for context): "Put the shared design tokens at ../../shared/tokens.ts so the whole monorepo can use them."

(That turn produced a PATH_FORBIDDEN or the model correctly refused; the corpus provides the output block.)

Turn 2 request: "Ok, put the tokens inside this app at src/lib/tokens.ts instead and export a small hook that reads them."

## Context
- The prior error (or model's own refusal) is in the injected <nihil-output>.
- The current tree root is the app; src/lib/ is writable.

## Rubric / Judge Criteria
- In Turn 2 the model emits a write (or plan) strictly inside the visible root (src/lib/tokens.ts or similar conventional location).
- It does not re-attempt any path with .. or absolute segments.
- It acknowledges the boundary in one short clause if it speaks about the prior attempt.
- The emitted tokens file follows design rules (the 3-5 color roles are defined using the template's semantic tokens, not arbitrary new ones).

## Expected High-Level Outcome
Clean recovery to an in-project location. The model treats the path error as authoritative and does not re-test the boundary.
