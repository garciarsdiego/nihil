# deps-execution-004: Long-running workflow (dev) must be emitted last even if it reads naturally earlier

**Category:** deps-execution  
**Probes:** long-running deferral (SPEC §7 " <nihil-run workflow=\"dev\"> ... is deferred to last", engine prompt "Long-running workflows (dev servers) are automatically started last")  
**Difficulty:** medium

## User Request
"Add a small health check endpoint route and start the dev server so I can test it live."

## Context
- A new API route file (or extension of existing server) is requested.
- "dev" is the long-running workflow.
- The natural English order in the request mentions the dev server first ("start the dev server so I can test it").

## Rubric / Judge Criteria
- The model may write the route file first (correct).
- The `<nihil-run workflow="dev"/>` tag appears in the response text *after* the file action(s) even if the prose mentioned the server early.
- The runner will move the long-running run to the very end mechanically; the model should not fight this by emitting multiple run tags.
- Only the declared "dev" name is used.

## Expected High-Level Outcome
File write(s) then the dev run tag (position in source can be anywhere; the important signal is that the model does not emit other runs after dev or interleave in a way that would start the server before the route file is written).
