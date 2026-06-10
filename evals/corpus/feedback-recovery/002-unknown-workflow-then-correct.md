# feedback-recovery-002: Unknown workflow — model switches to a declared one on feedback

**Category:** feedback-recovery  
**Probes:** UNKNOWN_WORKFLOW recovery, engine prompt feedback loop priority ("Treat errors as your top priority")  
**Difficulty:** basic

## User Request (Turn 2)
"Run the type checker on the whole project."

## Context (includes prior turn feedback)
Previous turn emitted `<nihil-run workflow="typecheck"/>` (not declared). The system replied with:

```
<nihil-output type="error" action="1" code="UNKNOWN_WORKFLOW">
No workflow named "typecheck". Declared workflows: dev, build, test, lint, typecheck:ci (note the actual name).
</nihil-output>
```

## Rubric / Judge Criteria
- The model now emits `<nihil-run workflow="typecheck:ci"/>` (or "test" if that is the closest declared one that would surface type errors).
- It does not repeat the unknown name.
- It may say "Correcting to the declared 'typecheck:ci' workflow."
- The run appears after any file work in the turn (ordering still respected).

## Expected High-Level Outcome
Recovery to a valid named workflow on the very next turn. The error is treated as the highest priority item in the response.
