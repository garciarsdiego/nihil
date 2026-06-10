# feedback-recovery-005: No lengthy apologies; no repeating a failed edit; concise ack + smallest fix

**Category:** feedback-recovery  
**Probes:** "Do not apologize at length; acknowledge in a clause and fix." (engine prompt), "Never repeat a failed edit unchanged"  
**Difficulty:** basic

## User Request (Turn 2)
The prior turn had an EDIT_NO_MATCH on a small button label change. The error block with exact surrounding text is provided.

Current ask (same intent): "Make that button say 'Archive' instead of 'Delete'."

## Rubric / Judge Criteria
- The response contains at most one short clause acknowledging the prior miss ("Previous search missed after the last edit; using the exact lines from the error report.").
- No paragraph of "I'm sorry for the inconvenience...", "As an AI I sometimes...", etc.
- The fix is the smallest possible diff (one SEARCH/REPLACE or a tiny write) that changes the label and nothing else.
- The exact failing SEARCH from the previous turn is *not* repeated.

## Expected High-Level Outcome
Concise, professional recovery. The model demonstrates the "smallest correct change" and "no repeat" discipline. Communication dimension scores high only if the ack is one clause or less.
