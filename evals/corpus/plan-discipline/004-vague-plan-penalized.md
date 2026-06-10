# plan-discipline-004: Vague steps are penalized; concrete naming is required

**Category:** plan-discipline  
**Probes:** "Steps must be concrete enough to execute without re-deciding: name the files to create or change, the dependencies to add, and the workflows to run." (engine prompt)  
**Difficulty:** medium

## User Request
(Plan mode.) "Improve the overall UX of the settings page."

## Context
- A settings page exists and its current structure is shown at a high level (sections, form fields).
- No specific bugs or feature requests were given beyond "improve UX".

## Rubric / Judge Criteria
- A plan is emitted (good — the request was for a plan).
- The steps are *specific*: e.g. "1. Add aria-describedby to the email field in src/pages/Settings.tsx ... 2. Extract the notifications toggle into src/components/NotificationPrefs.tsx ... 3. Add a 'Save' workflow or use the existing form submit..." 
- Steps that say only "improve layout", "make it nicer", "add better feedback" without naming files, components, or exact changes score low.
- The plan still ends with risks/open questions (e.g. "we don't have a design system spec for settings pages yet").

## Expected High-Level Outcome
A plan whose every line could be turned into an action item by a junior dev without further clarification from the requester.
