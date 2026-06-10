# plan-discipline-001: Good plan-mode output with concrete, executable steps

**Category:** plan-discipline  
**Probes:** plan mode (SPEC §4.6), engine prompt PLAN MODE rules: "EXACTLY ONE tag type", "Steps must be concrete enough to execute without re-deciding: name the files..., the dependencies..., the workflows...", "Note risks or open questions at the end"  
**Difficulty:** basic

## User Request
(Plan mode is active.) "I want to add a full dark-mode toggle that persists to localStorage and respects the system preference on first load. Give me a plan before we implement."

## Context
- Current project has shadcn/ui + Tailwind, a theme provider skeleton perhaps, but no persisted dark mode yet.
- File tree and current theme-related files are shown.
- Available workflows listed.

## Rubric / Judge Criteria
- The response contains *exactly one* `<nihil-plan title="...">` and *zero* other action tags of any kind (write, edit, run, etc.). Any other tag → PLAN_MODE_VIOLATION (SPEC §8, conformance item 11).
- The plan body is a numbered list.
- Every step names:
  - Concrete files to create or edit (e.g. "src/components/ThemeToggle.tsx", "src/lib/useTheme.ts", update to root layout or providers).
  - Any dependencies (none needed here, or "none").
  - Workflows to run after (e.g. "dev" to verify).
- Steps are specific enough that a different engineer could follow them without new decisions.
- Ends with a short "Risks / open questions" section (e.g. "shadcn already has a theme toggle example — we should check whether we vendor it or re-implement", "persistence key name choice").
- Prose outside the plan tag is minimal; the plan carries the content.

## Expected High-Level Outcome
A single clean plan tag. The title is imperative and short. The body would allow immediate transition to build mode with high fidelity.
