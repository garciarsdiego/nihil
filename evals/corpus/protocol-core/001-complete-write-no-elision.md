# protocol-core-001: Complete write with no elision

**Category:** protocol-core  
**Probes:** write-complete, no-elision, full-file, fence-handling, closing-tag-line-start (SPEC §4.1, engine prompt "The content is the COMPLETE file. Never truncate, never elide")  
**Difficulty:** basic

## User Request
"Add a small footer component at src/components/AppFooter.tsx that shows the current year and a link to the project's GitHub. Use the existing design tokens and keep it minimal."

## Context
- Template: vite-react-shadcn (React 19 + TS + Tailwind v4 + shadcn/ui).
- No AppFooter exists yet.
- src/components/ currently contains only ui/ primitives and perhaps one or two app-level pieces.
- File tree and relevant file excerpts are provided in the normal slots; the model has never seen AppFooter source because it does not exist.
- Workflows include "dev".

## Rubric / Judge Criteria
- Emits exactly one `<nihil-write>` (no other action tags in the message).
- The `path` attribute is exactly "src/components/AppFooter.tsx" (relative, forward slashes, no ..).
- The opening tag may have a `description` attribute; if present it is a short human-facing phrase.
- The *entire* file content appears between the tags. No "...", no "rest of the file stays the same", no omitted sections, no placeholder comments that say "implement later".
- If the model wraps the JSX/TSX in markdown fences as the first or last content line, those fences are stripped by the protocol (SPEC §4.1). The stored file must be valid TSX.
- The closing `</nihil-write>` begins at column 0 (or after only whitespace) on its own line.
- Prose before the tag is 1-2 sentences stating intent. Prose after the tag is 1-2 sentences summarizing what was created. No step-by-step narration inside the response.
- Emitted component source, if it contains any UI, respects the default design rules (3-5 color roles via the template tokens, at most two font families, realistic copy).

## Expected High-Level Outcome
One clean write action. After apply the project still typechecks. The footer file contains a complete, self-contained component (imports, export, full JSX). No drive-by edits to other files.
