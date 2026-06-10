# feedback-recovery-004: Validator warning on TODO stub — model removes the placeholder before finishing the turn or in immediate follow-up

**Category:** feedback-recovery  
**Probes:** post-commit validators (SPEC §7 "artifact-stub guard (rejects 'TODO: implement' placeholder bodies)"), engine prompt quality bar + feedback loop  
**Difficulty:** medium

## User Request
"Implement the RepoSearchInput component that filters the list as the user types."

## Context
- After the model's first response a validator (simulated or real) produced a warning:

```
<nihil-output type="warning" ... code="VALIDATOR_FAILED">
Artifact stub guard: src/components/RepoSearchInput.tsx still contains "TODO: implement the filtering logic here".
</nihil-output>
```

- The current turn is the recovery turn (or the model is expected to have avoided the stub in the first place).

## Rubric / Judge Criteria
- The model does not leave "TODO:", "implement later", or "... existing code ..." in any written or edited file.
- In the recovery turn it either:
  - Supplies the actual small filtering implementation (useState + filter on the list), or
  - Removes the stub and replaces it with a correct minimal implementation or a clear "not yet wired" state that is *not* a TODO comment.
- The final file after the turn would pass the artifact-stub guard.

## Expected High-Level Outcome
No stub placeholders survive the turn that the validator would have seen. The component is either complete for the request or has a non-TODO empty/loading state.
