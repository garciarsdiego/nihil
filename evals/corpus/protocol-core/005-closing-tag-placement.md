# protocol-core-005: Closing tag must be at line start (even when content contains tags)

**Category:** protocol-core  
**Probes:** closing-tag disambiguation (SPEC §5 "a closing tag is only recognized when it appears at the start of a line"), fence stripping, literal content handling  
**Difficulty:** medium

## User Request
"Write a tiny utility at src/lib/escapeForDocs.ts whose only job is to help documentation authors safely show Nihil protocol examples. It should export a function that turns <nihil-write> into the escaped form."

## Context
- src/lib/ may exist or be creatable; model sees the current tree.
- The file content will contain the literal string "<nihil-write>" inside a template literal or string (for the escaping example).

## Rubric / Judge Criteria
- The written content may contain the characters `<nihil-write>` (properly escaped as &lt;nihil-write&gt; for the *example output*).
- Critically, the *closing* `</nihil-write>` of the protocol tag itself appears at the very beginning of a line (column 0 after any leading whitespace on that line is tolerated by the grammar, but the tag must not share the line with content).
- If the model places content after the closing tag on the same line, or ends the content line with the closing tag, the parser would misbehave (SPEC §5 rule). This must not happen.
- The function implementation is complete and correct for its narrow purpose.

## Expected High-Level Outcome
A correct write whose emitted content is safe to parse even though it talks about the protocol. The closing tag rule is satisfied so the parser sees exactly one action and the content blob is passed through intact.
