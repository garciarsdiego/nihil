import {
  TAG_NAMES,
  CONTAINER_TAGS,
  type TagName,
  type NihilAction,
  type ParserEvents,
  type ProtocolError,
  type ActionMeta,
} from "./types.js";
import { unescapeXml, normalizeProjectPath } from "./escape.js";
import { parseEditBlocks } from "./edit-blocks.js";

const OPEN_PREFIX = "<nihil-";
const MAX_TAG_NAME_LEN = 32;
const MAX_HEADER_LEN = 4096;
/** Window kept un-skippable at the buffer tail so a close tag split across chunks is always found. */
const CLOSE_SCAN_BACKTRACK = 256;

const REQUIRED_ATTRS: Record<TagName, string[]> = {
  write: ["path"],
  edit: ["path"],
  rename: ["from", "to"],
  delete: ["path"],
  copy: ["from", "to"],
  "add-dependency": ["packages"],
  "remove-dependency": ["packages"],
  run: ["workflow"],
  plan: ["title"],
};

const PATH_ATTRS = new Set(["path", "from", "to"]);

type Mode = "prose" | "content" | "skip";

interface OpenAction {
  id: number;
  name: TagName;
  attrs: Record<string, string>;
  contentStart: number;
  emittedUpTo: number;
  searchFrom: number;
  leadingNewlineSkipped: boolean;
}

interface SkipState {
  closeTag: string;
  searchFrom: number;
}

interface MsgState {
  pos: number;
  mode: Mode;
  actionId: number;
  current?: OpenAction;
  skip?: SkipState;
  /** "plan" | "actions" once the first action kind lands; drives PLAN_MODE_VIOLATION. */
  messageKind?: "plan" | "actions";
  finalized: boolean;
}

const NAME_CHAR = /[a-z-]/;

function isNameTerminator(c: string): boolean {
  return c === " " || c === "\t" || c === "\n" || c === "\r" || c === "/" || c === ">";
}

function parseAttrs(headerAfterName: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z][\w-]*)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(headerAfterName)) !== null) {
    attrs[m[1]] = unescapeXml(m[2]);
  }
  return attrs;
}

/** Trim leading/trailing blank lines, strip stray markdown fences, unescape entities. */
function processWriteContent(raw: string): string {
  let lines = raw.split("\n");
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  if (lines.length && lines[0].trimStart().startsWith("```")) lines.shift();
  if (lines.length && lines[lines.length - 1].trimStart().startsWith("```")) lines.pop();
  return unescapeXml(lines.join("\n"));
}

export class NihilStreamParser {
  #messages = new Map<string, MsgState>();
  #events: Partial<ParserEvents>;

  constructor(events: Partial<ParserEvents> = {}) {
    this.#events = events;
  }

  reset(messageId?: string): void {
    if (messageId === undefined) this.#messages.clear();
    else this.#messages.delete(messageId);
  }

  /**
   * Re-entrant incremental parse. Call with the FULL accumulated text each
   * time a chunk arrives; parsing resumes from the saved offset. Calling
   * twice with identical text emits nothing the second time (idempotent).
   */
  parse(messageId: string, text: string): void {
    let st = this.#messages.get(messageId);
    if (!st) {
      st = { pos: 0, mode: "prose", actionId: 0, finalized: false };
      this.#messages.set(messageId, st);
    }
    if (st.finalized) return;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (st.pos >= text.length && st.mode === "prose") break;
      if (st.mode === "prose") {
        if (!this.#parseProse(messageId, st, text)) break;
      } else if (st.mode === "content") {
        if (!this.#parseContent(messageId, st, text)) break;
      } else {
        if (!this.#parseSkip(messageId, st, text)) break;
      }
    }
  }

  /**
   * EOF handling. Returns finalize-time errors (e.g. STREAM_TRUNCATED).
   * Pass the final accumulated text so prose suspended on a partial tag
   * prefix (e.g. a message ending in "<nihil-") is flushed, not lost.
   */
  finalize(messageId: string, finalText?: string): ProtocolError[] {
    const st = this.#messages.get(messageId);
    const errors: ProtocolError[] = [];
    if (!st) return errors;
    if (st.mode === "prose" && finalText !== undefined && st.pos < finalText.length) {
      this.#emitProse(messageId, finalText.slice(st.pos));
      st.pos = finalText.length;
    }
    if (st.mode === "content" && st.current) {
      errors.push(this.#error(messageId, {
        code: "STREAM_TRUNCATED",
        severity: "error",
        actionId: st.current.id,
        message: `stream ended inside open <nihil-${st.current.name}>; action discarded`,
      }));
    } else if (st.mode === "skip" && st.skip) {
      errors.push(this.#error(messageId, {
        code: "STREAM_TRUNCATED",
        severity: "warning",
        message: `stream ended inside skipped tag body (${st.skip.closeTag})`,
      }));
    }
    st.finalized = true;
    st.mode = "prose";
    st.current = undefined;
    st.skip = undefined;
    return errors;
  }

  // ── prose ──────────────────────────────────────────────────────────────

  /** @returns false to suspend (wait for more input). */
  #parseProse(messageId: string, st: MsgState, text: string): boolean {
    const lt = text.indexOf("<", st.pos);
    if (lt === -1) {
      this.#emitProse(messageId, text.slice(st.pos));
      st.pos = text.length;
      return false;
    }
    if (lt > st.pos) {
      this.#emitProse(messageId, text.slice(st.pos, lt));
      st.pos = lt;
    }

    const rest = text.slice(lt);
    // Could this still become an open tag? (prefix of "<nihil-")
    if (rest.length < OPEN_PREFIX.length) {
      if (OPEN_PREFIX.startsWith(rest)) return false; // suspend
      this.#emitProse(messageId, "<");
      st.pos = lt + 1;
      return true;
    }
    if (!rest.startsWith(OPEN_PREFIX)) {
      this.#emitProse(messageId, "<");
      st.pos = lt + 1;
      return true;
    }

    // Read the tag name after "<nihil-"
    let i = OPEN_PREFIX.length;
    while (i < rest.length && NAME_CHAR.test(rest[i]) && i - OPEN_PREFIX.length <= MAX_TAG_NAME_LEN) i++;
    const name = rest.slice(OPEN_PREFIX.length, i);
    if (i >= rest.length) {
      if (name.length <= MAX_TAG_NAME_LEN) return false; // mid-name, suspend
      this.#emitProse(messageId, "<");
      st.pos = lt + 1;
      return true;
    }
    if (!isNameTerminator(rest[i])) {
      // e.g. "<nihil-write2" — not a protocol tag
      this.#emitProse(messageId, "<");
      st.pos = lt + 1;
      return true;
    }

    const gt = rest.indexOf(">", i);
    if (gt === -1) {
      if (rest.length > MAX_HEADER_LEN) {
        this.#emitProse(messageId, "<");
        st.pos = lt + 1;
        return true;
      }
      return false; // header incomplete, suspend
    }

    const header = rest.slice(0, gt + 1);
    const selfClosing = /\/\s*>$/.test(header);
    const attrs = parseAttrs(header.slice(OPEN_PREFIX.length + name.length, selfClosing ? header.lastIndexOf("/") : gt));
    const afterHeader = lt + gt + 1;
    const known = (TAG_NAMES as readonly string[]).includes(name);

    if (!known) {
      this.#error(messageId, {
        code: "UNKNOWN_TAG",
        severity: "warning",
        message: `unknown tag <nihil-${name}>; body skipped`,
      });
      st.pos = afterHeader;
      if (!selfClosing) {
        st.mode = "skip";
        st.skip = { closeTag: `</nihil-${name}>`, searchFrom: afterHeader };
      }
      return true;
    }

    const tag = name as TagName;
    const invalid = this.#validateAttrs(messageId, tag, attrs);
    if (invalid) {
      st.pos = afterHeader;
      if (!selfClosing && CONTAINER_TAGS.has(tag)) {
        st.mode = "skip";
        st.skip = { closeTag: `</nihil-${tag}>`, searchFrom: afterHeader };
      } else if (!selfClosing && !CONTAINER_TAGS.has(tag)) {
        st.mode = "skip";
        st.skip = { closeTag: `</nihil-${tag}>`, searchFrom: afterHeader };
      }
      return true;
    }

    if (CONTAINER_TAGS.has(tag) && !selfClosing) {
      const id = st.actionId++;
      st.current = {
        id,
        name: tag,
        attrs,
        contentStart: afterHeader,
        emittedUpTo: afterHeader,
        searchFrom: afterHeader,
        leadingNewlineSkipped: false,
      };
      st.mode = "content";
      st.pos = afterHeader;
      this.#events.onActionOpen?.(messageId, id, { kind: tag, attrs } satisfies ActionMeta);
      return true;
    }

    // Non-container (or a self-closed container, treated as empty body)
    const id = st.actionId++;
    this.#events.onActionOpen?.(messageId, id, { kind: tag, attrs } satisfies ActionMeta);
    const action = this.#buildAction(messageId, id, tag, attrs, "");
    if (action) this.#closeAction(messageId, st, id, action);
    st.pos = afterHeader;
    if (!selfClosing && !CONTAINER_TAGS.has(tag)) {
      // bodied non-container: tolerate and discard narration until the close tag
      st.mode = "skip";
      st.skip = { closeTag: `</nihil-${tag}>`, searchFrom: afterHeader };
    }
    return true;
  }

  // ── content ────────────────────────────────────────────────────────────

  #parseContent(messageId: string, st: MsgState, text: string): boolean {
    const cur = st.current!;
    const closeTag = `</nihil-${cur.name}>`;

    if (!cur.leadingNewlineSkipped && text.length > cur.contentStart) {
      if (text[cur.contentStart] === "\r" && text.length <= cur.contentStart + 1) return false;
      if (text[cur.contentStart] === "\r" && text[cur.contentStart + 1] === "\n") {
        cur.contentStart += 2;
      } else if (text[cur.contentStart] === "\n") {
        cur.contentStart += 1;
      }
      cur.emittedUpTo = Math.max(cur.emittedUpTo, cur.contentStart);
      cur.searchFrom = Math.max(cur.searchFrom, cur.contentStart);
      cur.leadingNewlineSkipped = true;
    }

    const found = this.#findLineStartClose(text, closeTag, cur.searchFrom, cur.contentStart);
    if (found) {
      const { idx, lineStart } = found;
      const rawContent = text.slice(cur.contentStart, lineStart);
      if (lineStart > cur.emittedUpTo) {
        this.#events.onActionContent?.(messageId, cur.id, text.slice(cur.emittedUpTo, lineStart));
      }
      const action = this.#buildAction(messageId, cur.id, cur.name, cur.attrs, rawContent);
      if (action) this.#closeAction(messageId, st, cur.id, action);
      st.pos = idx + closeTag.length;
      st.mode = "prose";
      st.current = undefined;
      return true;
    }

    // No close yet: emit content up to the last complete line, hold back the
    // partial tail (it may contain a split close tag), and advance the search
    // window so repeated scans stay linear.
    const lastNl = text.lastIndexOf("\n");
    const safeEnd = lastNl >= cur.contentStart ? lastNl + 1 : cur.contentStart;
    if (safeEnd > cur.emittedUpTo) {
      this.#events.onActionContent?.(messageId, cur.id, text.slice(cur.emittedUpTo, safeEnd));
      cur.emittedUpTo = safeEnd;
    }
    cur.searchFrom = Math.max(
      cur.contentStart,
      text.length - (closeTag.length + CLOSE_SCAN_BACKTRACK),
    );
    return false;
  }

  #parseSkip(messageId: string, st: MsgState, text: string): boolean {
    const sk = st.skip!;
    const found = this.#findLineStartClose(text, sk.closeTag, sk.searchFrom, sk.searchFrom);
    if (found) {
      st.pos = found.idx + sk.closeTag.length;
      st.mode = "prose";
      st.skip = undefined;
      return true;
    }
    sk.searchFrom = Math.max(sk.searchFrom, text.length - (sk.closeTag.length + CLOSE_SCAN_BACKTRACK));
    return false;
  }

  /**
   * Find `closeTag` at the start of a line (optionally indented with
   * spaces/tabs), or at the very start of the content region.
   */
  #findLineStartClose(
    text: string,
    closeTag: string,
    from: number,
    contentStart: number,
  ): { idx: number; lineStart: number } | null {
    let idx = text.indexOf(closeTag, from);
    while (idx !== -1) {
      let j = idx;
      while (j > contentStart && (text[j - 1] === " " || text[j - 1] === "\t")) j--;
      if (j === contentStart || text[j - 1] === "\n") {
        return { idx, lineStart: j === contentStart ? j : j };
      }
      idx = text.indexOf(closeTag, idx + 1);
    }
    return null;
  }

  // ── action construction ────────────────────────────────────────────────

  #validateAttrs(
    messageId: string,
    tag: TagName,
    attrs: Record<string, string>,
  ): boolean {
    for (const req of REQUIRED_ATTRS[tag]) {
      if (!(req in attrs) || attrs[req].length === 0) {
        this.#error(messageId, {
          code: "MALFORMED_TAG",
          severity: "error",
          message: `<nihil-${tag}> is missing required attribute "${req}"`,
        });
        return true;
      }
    }
    for (const key of Object.keys(attrs)) {
      if (!PATH_ATTRS.has(key)) continue;
      const res = normalizeProjectPath(attrs[key]);
      if (!res.ok) {
        this.#error(messageId, {
          code: "PATH_FORBIDDEN",
          severity: "error",
          path: attrs[key],
          message: `<nihil-${tag}> ${key}="${attrs[key]}": ${res.reason}`,
        });
        return true;
      }
      attrs[key] = res.path;
    }
    return false;
  }

  #buildAction(
    messageId: string,
    actionId: number,
    tag: TagName,
    attrs: Record<string, string>,
    rawContent: string,
  ): NihilAction | null {
    switch (tag) {
      case "write":
        return {
          kind: "write",
          path: attrs.path,
          content: processWriteContent(rawContent),
          description: attrs.description,
        };
      case "edit": {
        const trimmed = rawContent.replace(/^\s*\n/, "").replace(/\s+$/, "");
        const { blocks, error } = parseEditBlocks(unescapeXml(trimmed));
        if (error) {
          this.#error(messageId, {
            code: "MALFORMED_TAG",
            severity: "error",
            actionId,
            path: attrs.path,
            message: `<nihil-edit path="${attrs.path}">: ${error}`,
          });
          return null;
        }
        return { kind: "edit", path: attrs.path, blocks, description: attrs.description };
      }
      case "plan":
        return { kind: "plan", title: attrs.title, body: rawContent.trim() };
      case "rename":
        return { kind: "rename", from: attrs.from, to: attrs.to };
      case "delete":
        return { kind: "delete", path: attrs.path };
      case "copy":
        return { kind: "copy", from: attrs.from, to: attrs.to, description: attrs.description };
      case "add-dependency":
        return { kind: "add-dependency", packages: attrs.packages.split(/\s+/).filter(Boolean) };
      case "remove-dependency":
        return { kind: "remove-dependency", packages: attrs.packages.split(/\s+/).filter(Boolean) };
      case "run":
        return { kind: "run", workflow: attrs.workflow, args: attrs.args };
    }
  }

  /** Enforces the plan-mode exclusivity rule, then emits onActionClose. */
  #closeAction(messageId: string, st: MsgState, actionId: number, action: NihilAction): void {
    const kind = action.kind === "plan" ? "plan" : "actions";
    if (st.messageKind && st.messageKind !== kind) {
      this.#error(messageId, {
        code: "PLAN_MODE_VIOLATION",
        severity: "error",
        actionId,
        message:
          kind === "plan"
            ? "a <nihil-plan> may not share a message with other actions"
            : `<nihil-${action.kind}> rejected: this message contains a <nihil-plan>`,
      });
      return;
    }
    st.messageKind = kind;
    this.#events.onActionClose?.(messageId, actionId, action);
  }

  #emitProse(messageId: string, textChunk: string): void {
    if (textChunk.length > 0) this.#events.onProse?.(messageId, textChunk);
  }

  #error(messageId: string, error: ProtocolError): ProtocolError {
    this.#events.onProtocolError?.(messageId, error);
    return error;
  }
}
