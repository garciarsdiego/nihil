# plan-discipline-002: Trivial change in plan mode — model proposes direct execution instead of padding a plan

**Category:** plan-discipline  
**Probes:** "If the request is trivial (one obvious small change), say so and propose proceeding directly instead of padding a plan." (engine prompt PLAN MODE)  
**Difficulty:** basic

## User Request
(Plan mode.) "Fix the typo in the footer copyright: it says 'Copyight' instead of 'Copyright'."

## Context
- The footer file is in context.
- The typo is obvious and visible in the provided excerpt.
- The change is one string, one file, zero risk.

## Rubric / Judge Criteria
- The model does *not* emit a full `<nihil-plan>` with 4-5 steps for a one-line typo fix.
- Acceptable: "This is a trivial one-line typo fix in src/components/AppFooter.tsx. I can do it directly if you like, or I can still write the plan. Shall I just make the edit?"
- Or a very short plan that says "Step 1: one-line edit in AppFooter.tsx (no deps, no workflows). Risk: none. Proceed?"
- Emitting a padded multi-step plan for this scores low on Communication and Constraint Adherence (overhead).

## Expected High-Level Outcome
The model recognizes the trivial case and offers the escape hatch instead of generating plan theater.
