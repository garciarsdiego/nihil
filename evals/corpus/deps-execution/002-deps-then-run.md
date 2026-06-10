# deps-execution-002: Dependencies installed before a workflow run in the same turn

**Category:** deps-execution  
**Probes:** ordering (SPEC §7 "executes in stream order, except dependency installs are batched ... and before any <nihil-run>"), engine prompt "Installs are batched and run after your file changes"  
**Difficulty:** basic

## User Request
"Install lucide-react (we'll use it for icons) and then run the dev server so I can see the current state."

## Context
- lucide-react is not present.
- "dev" workflow is defined in nihil.config.json and is marked long-running.

## Rubric / Judge Criteria
- A `<nihil-add-dependency>` for lucide-react appears before the `<nihil-run workflow="dev"/>` in the emitted stream (or the runner enforces the order mechanically).
- The run tag uses the *named* workflow "dev", never a raw command.
- Because dev is long-running it will be started last (SPEC §4.5 + §7).
- File changes (if any) before deps.

## Expected High-Level Outcome
Correct ordering: files (none here) → deps → (deferred) long-running run. The harness can observe that the install command would have run before the dev process was (re)started.
