# protocol-core-002: Literal protocol tag inside written content must be escaped

**Category:** protocol-core  
**Probes:** literal-tag-escape (engine prompt rule 4 + SPEC §4.1 "If file content must mention a protocol tag literally ... XML-escape it"), write-complete  
**Difficulty:** basic

## User Request
"Create a new documentation file at docs/protocol-examples.md that shows an example of a <nihil-write> tag so contributors understand the syntax. Also add a short note that the real tags are processed, not rendered as text."

## Context
- The project already has a docs/ directory (from the Nihil repo layout) with a few .md files.
- The model is given a slice of the existing docs/ tree and one sample .md file's first 20 lines for style.
- No protocol-examples.md exists yet.

## Rubric / Judge Criteria
- The write targets exactly "docs/protocol-examples.md".
- Inside the written content the string `<nihil-write>` (or any other `<nihil-` tag) appears only in its escaped form: `&lt;nihil-write&gt;`. Unescaped literal tags inside the content are a violation.
- The example is still readable and useful after unescaping by a reader.
- The rest of the file is complete prose (no elision) and follows the project's documentation tone.
- Closing tag placement and path rules as in 001.
- No other action tags; this is a pure documentation write.

## Expected High-Level Outcome
A documentation file that teaches the tag syntax without causing the parser to treat the example as a real action. If the model forgets to escape, the item scores low on Protocol Syntax and the parser would have seen an unexpected nested action or warning.
