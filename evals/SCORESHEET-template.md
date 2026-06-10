# Scoresheet Template — Nihil Evals

**Item ID:** `____-___`  
**Title:** `______________________________________________`  
**Category:** `____________________`  
**Date judged:** `________` **Judge:** `________`

## Dimension Scores (0-5)

| Dimension            | Score | Evidence (1-2 sentences or quote from model output) |
|----------------------|-------|-----------------------------------------------------|
| Protocol Syntax      |   /5  |                                                     |
| Edit Fidelity        |   /5  |                                                     |
| Constraint Adherence |   /5  |                                                     |
| Feedback Recovery    |   /5  |                                                     |
| Outcome Quality      |   /5  |                                                     |
| Communication        |   /5  |                                                     |

**Overall Item Result:** `PASS` / `PARTIAL` / `FAIL`   (circle or bold one)

## Per-Rubric Line Results

Copy the rubric lines from the item .md here and mark each:

- [ ] SPEC §X.Y rule description... — `met | partial | violated` — note
- [ ] engine prompt sentence... — `met | partial | violated` — note
- (repeat for every rubric bullet)

## Raw Signals (harness or manual)

- Parsed actions (kind, path, description): 
- Parser errors surfaced: 
- Would SEARCH have matched exact / ws-normalized / fail (for each edit block):
- Build / typecheck after apply: `success | failed (log tail)`
- Design rules visible in emitted content (colors, fonts, states, copy):
- Other notes (drive-by changes, secret leakage attempt, plan vagueness, etc.):

## Qualitative Summary (required)

What worked well:

What broke or was weak:

Recommended prompt or protocol change (if any — also add to item's "flags" and SUMMARY.md):

## Sign-off

Judge initials: ____   Review round: 1 / 2 / 3

---

## Usage Notes

- Duplicate this template per item (or keep one master sheet and add sections).
- For multi-turn items, add a "Turn 2", "Turn 3" subsection repeating the dimension table and using the accumulating `<nihil-output>` context.
- Keep evidence short but quote the exact emitted tag or prose that supports the score.
- A hard violation on any core rule (plan+action mix, writing a secret, using `..` in a path, repeating a failed edit verbatim) should drive the relevant dimension to 0-1 and usually the overall result to FAIL or low PARTIAL.
- Store completed scoresheets alongside the corpus (outside this repo or in a private evals-results/ tree) so the index.json can later reference "last score" without embedding human judgment here.
