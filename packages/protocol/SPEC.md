# Nihil Protocol Specification

**Version:** 1.0-draft · **Package:** `@nihil/protocol` · **Status:** Design review
**Informed by:** bolt.new `StreamingMessageParser` (MIT), dyad `dyad_tag_parser` + `response_processor` (Apache-2.0) — patterns studied, implementation original.

---

## 1. Purpose & Scope

The Nihil Protocol defines how an LLM expresses **actions** (file operations, dependency changes, workflow runs, plans) inside a streamed natural-language response, and how the daemon parses, validates, executes, and reports those actions.

It is the contract between four components:

```
LLM response stream → PARSER (incremental) → RUNNER (executes vs ExecutionTarget)
                            ↓ events                    ↓ results
                       UI (live render)          FEEDBACK (<nihil-output> → next turn)
```

Out of scope: the system prompt that teaches the model the protocol (lives in `packages/knowledge`), and ExecutionTarget internals (lives in `apps/daemon/src/exec`).

## 2. Design Principles

1. **Stream-first.** Tags are parsed incrementally as chunks arrive; the UI renders action cards and file content live (bolt pattern). No buffering of the full response before showing progress.
2. **Execute-on-close, commit-on-end.** File actions execute as soon as their closing tag is parsed (instant feel), but the entire message is one **git transaction**: staged during the stream, committed when the message completes successfully, rolled back (`git checkout .` + clean) on abort/fatal error (dyad-inspired safety, bolt-inspired speed).
3. **Deterministic over clever.** Search/replace blocks are applied byte-exact first; fuzzy matching is an explicit, logged fallback; full-file rewrite is the escape hatch. No silent magic.
4. **Closed feedback loop.** Every warning/error is serialized back into the conversation as `<nihil-output>` so the model can self-correct on the next turn (dyad pattern).
5. **Forward-compatible.** Unknown `nihil-*` tags are surfaced as warnings, never crashes. Protocol version is negotiated via the system prompt.

## 3. Transport Assumptions

- The response is a UTF-8 text stream delivered in arbitrary chunk sizes. **A tag, attribute, or even a single multi-byte character may be split across chunks.** The parser tracks absolute position per message and never assumes chunk alignment.
- Tags may be interleaved with free-form markdown prose. Prose outside tags is passed through to the UI untouched.
- One message may contain zero or many actions. Actions are NOT wrapped in an artifact envelope (divergence from bolt: the message itself is the envelope; simpler grammar, one less nesting level for the model to get wrong).

## 4. Tag Catalog

All tags use the `nihil-` prefix. Attributes are double-quoted, XML-escaped (`&quot; &amp; &lt; &gt;`). Paths are always **relative to project root**, forward slashes, normalized by the parser.

### 4.1 `<nihil-write>` — create or overwrite a file

```xml
<nihil-write path="src/components/Hero.tsx" description="Hero section with CTA">
const Hero = () => { ... }
export default Hero
</nihil-write>
```

| Attr | Req | Notes |
|---|---|---|
| `path` | ✓ | Relative; parser rejects traversal (`..`), absolute paths, paths outside root |
| `description` | – | Shown on the UI action card and used in the git commit body |

Content rules: raw file content. Leading/trailing blank lines trimmed; if the first and last content lines are markdown fences (```` ``` ````), they are stripped (models add them by reflex — dyad-proven mitigation). XML entities in content are unescaped.

### 4.2 `<nihil-edit>` — search/replace edit (primary edit verb)

```xml
<nihil-edit path="src/App.tsx" description="Add router import">
<<<<<<< SEARCH
import React from "react";
=======
import React from "react";
import { BrowserRouter } from "react-router-dom";
>>>>>>> REPLACE
</nihil-edit>
```

- One `<nihil-edit>` may contain **multiple** SEARCH/REPLACE blocks, applied top-to-bottom.
- SEARCH must match **exactly once** in the current file state (after prior blocks in the same tag). Zero matches → apply-chain fallback (§7). Multiple matches → error: the model must add more context lines.
- Marker lines (`<<<<<<< SEARCH`, `=======`, `>>>>>>> REPLACE`) must start at column 0 and occupy the whole line.

### 4.3 `<nihil-rename>` / `<nihil-delete>` / `<nihil-copy>`

```xml
<nihil-rename from="src/old.tsx" to="src/new.tsx"/>
<nihil-delete path="src/unused.tsx"/>
<nihil-copy from="templates/card.tsx" to="src/components/Card.tsx"/>
```

Self-closing or empty-bodied; bodies, if present, are ignored (models sometimes narrate inside — tolerate it). Rename updates are the model's job; Nihil does not rewrite imports automatically in v1 (validator pass flags broken imports instead).

### 4.4 `<nihil-add-dependency>` / `<nihil-remove-dependency>`

```xml
<nihil-add-dependency packages="zustand@^4 react-router-dom@latest"/>
```

`packages`: space-separated npm specs. The runner batches all dependency tags in a message into **one** install command, executed **before** any `<nihil-run>` and **after** all file writes (so a written `package.json` wins over incremental adds — conflict resolved in favor of the explicit file).

### 4.5 `<nihil-run>` — named workflow execution

```xml
<nihil-run workflow="dev"/>
<nihil-run workflow="test" args="--filter Hero"/>
```

`workflow` references a **named run configuration** declared in `nihil.config.json` (`dev`, `build`, `test`, `lint`, `cap:sync`, `cap:run:android`, …) — never raw shell (Replit pattern; this is the protocol's security boundary). Unknown workflow → error fed back. Raw shell exists only as a user-toggled capability that maps to a generated workflow, off by default.

### 4.6 `<nihil-plan>` — plan-mode output

```xml
<nihil-plan title="Add authentication">
1. Install supabase-js …
2. Create AuthProvider …
</nihil-plan>
```

Markdown body, rendered as an approvable plan card. In plan mode, **any other action tag in the same message is a protocol violation** (rejected, fed back). Approval flips the session to build mode with the plan injected as context.

### 4.7 `<nihil-output>` — system → model feedback (reserved)

Never emitted by the model (if it is, it's stripped and warned). The daemon serializes execution results into the next user turn:

```xml
<nihil-output type="error" action="3" path="src/App.tsx" code="EDIT_NO_MATCH">
SEARCH block 2 matched 0 locations. Current file content near line 14: …
</nihil-output>
```

`type`: `error | warning | info`. `code` is a stable enum (§8). Includes enough context (surrounding file content, exact diff of what failed) for one-shot self-correction.

## 5. Grammar (informal EBNF)

```
message      = { prose | action } ;
action       = write | edit | rename | delete | copy | addDep | removeDep | run | plan ;
write        = "<nihil-write" attrs ">" raw-content "</nihil-write>" ;
edit         = "<nihil-edit" attrs ">" { sr-block } "</nihil-edit>" ;
sr-block     = SEARCH-line { line } SEP-line { line } REPLACE-line ;
attrs        = { WS name "=" '"' xml-escaped '"' } ;
```

**Closing-tag disambiguation rule:** a closing tag (`</nihil-write>` etc.) is only recognized when it appears at the **start of a line** (optionally preceded by whitespace). This makes it possible to write files that *contain* protocol-tag strings inline (docs, tests, the Nihil codebase itself) — the system prompt additionally instructs the model to XML-escape literal protocol tags in content. Defense in depth; bolt has neither and it's a known footgun.

## 6. Streaming Parser — state machine

States: `PROSE → TAG_CANDIDATE → IN_TAG_HEADER → IN_CONTENT → (PROSE)`

Requirements (each maps to a test in §10):

1. **Position tracking per message id** — `parse(messageId, fullTextSoFar)` is re-entrant; resumes from the saved offset (bolt model). Idempotent on repeated input.
2. **Partial-tag suspension** — on encountering `<` followed by a possible prefix of any known tag at end of buffer, suspend (keep offset before `<`) and wait for the next chunk. Same for an unterminated attribute section or a content region whose line-initial close tag hasn't arrived.
3. **Prefix discrimination** — `<nihil-write` must not be confused with a hypothetical `<nihil-writeup`; after the tag name, the next char must be WS, `/`, or `>`.
4. **Events emitted:** `onProse(text)`, `onActionOpen(meta)` (UI card appears, spinner), `onActionContent(delta)` (live file body render), `onActionClose(action)` (handed to runner), `onProtocolError(err)`.
5. **Malformed input policy:** unparseable tag header → emit as prose + warning (never lose model output); unknown `nihil-*` tag → skip body, warn; EOF inside an open tag → action discarded, `STREAM_TRUNCATED` error queued for feedback, transaction proceeds with completed actions only.

## 7. Execution Semantics

**Ordering:** actions execute in stream order, except dependency installs are batched (§4.4) and `<nihil-run workflow="dev">` (or any server-starting workflow) is deferred to last — declared via `"longRunning": true` in the workflow config (bolt prompt rule, enforced mechanically instead).

**Apply chain for `<nihil-edit>` (per SEARCH block):**

```
1. exact match            → apply                      (logged: exact)
2. whitespace-normalized  → apply                      (logged: fuzzy-ws, warning to model)
3. [v1.1] local fast-apply model via OmniRoute `apply` tier
4. fail → EDIT_NO_MATCH / EDIT_AMBIGUOUS feedback; file untouched
```

**Transactionality:** before the first action, the runner snapshots HEAD. All writes are applied to the working tree. On message completion: `git add -A && git commit` (message = chat summary + per-action descriptions). On user abort or fatal protocol error: hard reset to the snapshot. The chat message id is stored in the commit trailer (`Nihil-Message-Id:`) for version↔chat linkage.

**Post-commit validators (plugin passes, openv0 pattern):** typecheck/build dry-run, broken-import scan, artifact-stub guard (rejects "TODO: implement" placeholder bodies — open-design pattern), optional security review. Findings → `<nihil-output type="warning">`.

## 8. Error Codes (stable enum)

`PATH_FORBIDDEN` · `EDIT_NO_MATCH` · `EDIT_AMBIGUOUS` · `FILE_NOT_FOUND` (edit/rename/delete on missing file) · `UNKNOWN_WORKFLOW` · `UNKNOWN_TAG` · `MALFORMED_TAG` · `PLAN_MODE_VIOLATION` · `STREAM_TRUNCATED` · `INSTALL_FAILED` · `WORKFLOW_FAILED` · `VALIDATOR_FAILED`

## 9. TypeScript Surface (package exports)

```ts
type NihilAction =
  | { kind: "write";  path: string; content: string; description?: string }
  | { kind: "edit";   path: string; blocks: SearchReplaceBlock[]; description?: string }
  | { kind: "rename"; from: string; to: string }
  | { kind: "delete"; path: string }
  | { kind: "copy";   from: string; to: string }
  | { kind: "add-dependency";    packages: string[] }
  | { kind: "remove-dependency"; packages: string[] }
  | { kind: "run";    workflow: string; args?: string }
  | { kind: "plan";   title: string; body: string };

interface SearchReplaceBlock { search: string; replace: string }

interface ParserEvents {
  onProse(messageId: string, text: string): void;
  onActionOpen(messageId: string, actionId: number, meta: ActionMeta): void;
  onActionContent(messageId: string, actionId: number, delta: string): void;
  onActionClose(messageId: string, actionId: number, action: NihilAction): void;
  onProtocolError(messageId: string, error: ProtocolError): void;
}

declare class NihilStreamParser {
  constructor(events: Partial<ParserEvents>);
  parse(messageId: string, accumulatedText: string): void;  // re-entrant
  finalize(messageId: string): ProtocolError[];             // EOF handling
  reset(messageId?: string): void;
}

declare function serializeOutput(o: NihilOutput): string;   // <nihil-output> builder
declare const PROTOCOL_VERSION: "1.0";
```

Zod schemas ship alongside the types for runtime validation at the daemon boundary.

## 10. Conformance Test Matrix (parser must pass before M1)

1. Tag split mid-name across chunks (`<nihil-wr` ▌ `ite path=…>`)
2. Attribute value split across chunks; multi-byte UTF-8 char split across chunks
3. Close tag split across chunks; close tag NOT at line start → treated as content
4. File content containing literal `</nihil-write>` mid-line → preserved
5. Two writes back-to-back with no prose between
6. Edit with 3 SR blocks where block 2 depends on block 1's result
7. SEARCH matching twice → `EDIT_AMBIGUOUS`, file untouched
8. Markdown fences as first/last content lines → stripped; fences mid-content → preserved
9. Unknown tag `<nihil-teleport>` → warning, prose continues
10. Stream ends inside open content → `STREAM_TRUNCATED`, prior actions committed
11. `<nihil-plan>` + `<nihil-write>` in same message → `PLAN_MODE_VIOLATION`
12. Re-parse same accumulated text twice → zero duplicate events (idempotence)
13. Windows `\r\n` content normalized per `.gitattributes`, SEARCH matching tolerant to EOL
14. 5 MB single file write → no quadratic slowdown (position-tracked, no re-scan)

## 11. Versioning

The system prompt declares `protocol=1.0`. Additive changes (new tags, new optional attrs) bump minor; breaking changes bump major and require parser dual-support for one release. The parser reports the highest version it supports in daemon handshake.
