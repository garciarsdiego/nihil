# feedback-recovery-001: EDIT_NO_MATCH — model must re-read the excerpt and use exact text or switch to write

**Category:** feedback-recovery  
**Probes:** EDIT_NO_MATCH (SPEC §8), engine prompt "EDIT_NO_MATCH means your SEARCH text didn't match the real file — re-read the provided file excerpt and either retry with exact text or rewrite the file completely. Never repeat a failed edit unchanged."  
**Difficulty:** medium

## User Request (Turn 2)
"Add the missing 'archive' button to the repo list item."

## Context (includes prior turn feedback)
The previous turn produced this `<nihil-output>` (injected at the front of the current user message):

```
<nihil-output type="error" action="2" path="src/components/RepoListItem.tsx" code="EDIT_NO_MATCH">
SEARCH block 1 matched 0 locations. Current file content near line 14:
  <div className="flex items-center gap-2">
    <span>{repo.name}</span>
    <Button size="sm" variant="ghost">Delete</Button>
  </div>
</nihil-output>
```

The current file excerpt shown to the model includes the exact lines around the button area (the "Delete" button exists; there is no "Archive" yet).

## Rubric / Judge Criteria
- The model does *not* re-emit the exact same failing SEARCH from the previous turn.
- It either:
  - Copies the exact surrounding text from the `<nihil-output>` "Current file content near line 14" block into a new SEARCH (now guaranteed to match), or
  - Switches to a full `<nihil-write>` with the complete corrected file (acceptable per prompt).
- The fix adds the Archive button next to Delete with appropriate handler stub.
- Acknowledgment is one clause ("The previous search didn't match after the prior edit; using the exact lines from the error...").

## Expected High-Level Outcome
A successful edit (or write) on the second attempt. No repeated failing SEARCH. The recovery is the smallest change that addresses the exact error.
