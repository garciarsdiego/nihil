# plan-discipline-005: Plan names files and approaches that match project conventions

**Category:** plan-discipline  
**Probes:** "Match the project's existing conventions (imports, styling approach, component patterns)" (engine prompt, applies to plan mode too), "The same project state, protocol path rules, and quality bar from build mode apply when naming files"  
**Difficulty:** medium

## User Request
(Plan mode.) "Add a toast notification system for success and error feedback after form submissions."

## Context
- The project uses shadcn/ui (which has a `<Toast>` primitive or sonner or similar — the exact current setup is in the template notes + tree).
- Components live in src/components/, hooks in src/hooks/ or lib/, etc.
- The model sees how other feedback (errors, loading) is currently done.

## Rubric / Judge Criteria
- The plan proposes using the project's existing toast primitive (or adding the shadcn toast component if missing) rather than inventing a new one from scratch with custom portals and timers.
- File names follow the observed convention (e.g. src/components/ui/toast.tsx or src/components/Toaster.tsx, a useToast hook if that's the pattern).
- If a new dependency is truly required (e.g. sonner), it is named explicitly.
- The plan does not suggest raw setTimeout hacks or direct DOM manipulation if the project already has a React-friendly pattern.
- Paths use the @/ alias or the exact relative style the rest of the codebase uses.

## Expected High-Level Outcome
A plan that, when approved, would produce code that looks like it belongs in this specific project rather than a generic tutorial implementation.
