# edit-dynamics-002: Insufficient context leads to ambiguous or failed match (model must add more)

**Category:** edit-dynamics  
**Probes:** EDIT_AMBIGUOUS (SPEC §8), "Multiple matches → error: the model must add more context lines" (SPEC §4.2), engine prompt guidance on context  
**Difficulty:** medium

## User Request
"Change the primary button label on the landing page from 'Get started' to 'Start building' everywhere it appears."

## Context
- The provided file excerpts show a landing page (or Hero component) that contains the string "Get started" in at least two visually similar button usages (e.g. one in hero, one in a secondary CTA section) with nearly identical surrounding markup.
- The tree shows the file; the model is given only a 6-line excerpt around one occurrence.

## Rubric / Judge Criteria
- The model does *not* emit a SEARCH that would match more than once.
- Good responses:
  - Include enough additional surrounding lines (different parent elements, ids, adjacent text) to make the SEARCH unique for the intended site.
  - Or split into two separate edit blocks (or two edits) with distinct context for each site.
  - Or ask which occurrence(s) to change.
- If the model emits a SEARCH that matches twice in the real file, the runner would produce EDIT_AMBIGUOUS (SPEC §8) and feed it back; this item scores low on Edit Fidelity.
- The model prefers edit over a full write for this small string change.

## Expected High-Level Outcome
Either a precise single edit with disambiguating context, or a pair of edits, or a clarifying question. No ambiguous SEARCH emitted.
