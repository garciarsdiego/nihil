import { describe, it, expect } from "vitest";
import {
  NihilStreamParser,
  applyEditBlocks,
  type NihilAction,
  type ProtocolError,
} from "../index.js";

interface Collected {
  prose: string[];
  opens: { id: number; kind: string }[];
  deltas: Map<number, string>;
  closes: { id: number; action: NihilAction }[];
  errors: ProtocolError[];
}

function harness() {
  const c: Collected = { prose: [], opens: [], deltas: new Map(), closes: [], errors: [] };
  const parser = new NihilStreamParser({
    onProse: (_m, t) => c.prose.push(t),
    onActionOpen: (_m, id, meta) => c.opens.push({ id, kind: meta.kind }),
    onActionContent: (_m, id, d) => c.deltas.set(id, (c.deltas.get(id) ?? "") + d),
    onActionClose: (_m, id, action) => c.closes.push({ id, action }),
    onProtocolError: (_m, e) => c.errors.push(e),
  });
  return { parser, c };
}

/** Feed `text` to the parser in chunks of the given sizes (cycled). */
function feed(parser: NihilStreamParser, text: string, chunkSizes: number[] = [text.length]) {
  let acc = "";
  let i = 0;
  let s = 0;
  while (i < text.length) {
    const size = chunkSizes[s % chunkSizes.length];
    s++;
    acc = text.slice(0, Math.min(text.length, i + size));
    i += size;
    parser.parse("m1", acc);
  }
  return parser.finalize("m1");
}

const WRITE = (path: string, body: string, extra = "") =>
  `<nihil-write path="${path}"${extra}>\n${body}\n</nihil-write>`;

describe("Nihil Protocol conformance (SPEC §10)", () => {
  it("1. tag split mid-name across chunks", () => {
    const { parser, c } = harness();
    const text = `before ${WRITE("a.ts", "const a = 1;")} after`;
    // chunk sizes chosen so the boundary lands inside "<nihil-wr|ite"
    feed(parser, text, [9, 5, 1000]);
    expect(c.closes).toHaveLength(1);
    const a = c.closes[0].action;
    expect(a).toMatchObject({ kind: "write", path: "a.ts", content: "const a = 1;" });
    expect(c.prose.join("")).toBe("before  after");
    expect(c.errors).toHaveLength(0);
  });

  it("2. attribute value and multi-byte UTF-8 split across chunks", () => {
    const { parser, c } = harness();
    const body = "const emoji = \u201c\u{1F419}\u201d; // polvo";
    const text = WRITE("src/components/Tako.tsx", body);
    // 1-char chunks: every boundary possible, including inside surrogate pairs
    feed(parser, text, [1]);
    expect(c.closes).toHaveLength(1);
    expect(c.closes[0].action).toMatchObject({
      kind: "write",
      path: "src/components/Tako.tsx",
      content: body,
    });
  });

  it("3. close tag split across chunks; mid-line close treated as content", () => {
    const { parser, c } = harness();
    const body = `const s = "</nihil-write>"; // inline mention stays`;
    const text = WRITE("a.ts", body);
    // boundary inside the real closing tag
    feed(parser, text, [text.length - 7, 7]);
    expect(c.closes).toHaveLength(1);
    expect((c.closes[0].action as any).content).toBe(body);
    expect(c.errors).toHaveLength(0);
  });

  it("4. file content containing literal close tag mid-line is preserved", () => {
    const { parser, c } = harness();
    const body = `it("parses </nihil-write> safely", () => {});`;
    feed(parser, WRITE("p.test.ts", body), [13]);
    expect(c.closes).toHaveLength(1);
    expect((c.closes[0].action as any).content).toBe(body);
  });

  it("5. two writes back-to-back with no prose between", () => {
    const { parser, c } = harness();
    const text = WRITE("a.ts", "export const a = 1;") + "\n" + WRITE("b.ts", "export const b = 2;");
    feed(parser, text, [17]);
    expect(c.closes.map((x) => (x.action as any).path)).toEqual(["a.ts", "b.ts"]);
    expect(c.prose.join("").trim()).toBe("");
  });

  it("6. edit with 3 SR blocks where block 2 depends on block 1's result", () => {
    const file = "function a() {}\n";
    const tag = `<nihil-edit path="x.ts">
<<<<<<< SEARCH
function a() {}
=======
function a() { return 1; }
>>>>>>> REPLACE
<<<<<<< SEARCH
function a() { return 1; }
=======
function a() { return 2; }
export const done = true;
>>>>>>> REPLACE
<<<<<<< SEARCH
export const done = true;
=======
export const done = "yes";
>>>>>>> REPLACE
</nihil-edit>`;
    const { parser, c } = harness();
    feed(parser, tag, [11]);
    expect(c.closes).toHaveLength(1);
    const action = c.closes[0].action as Extract<NihilAction, { kind: "edit" }>;
    expect(action.blocks).toHaveLength(3);
    const res = applyEditBlocks(file, action.blocks);
    expect(res.ok).toBe(true);
    expect(res.content).toBe('function a() { return 2; }\nexport const done = "yes";\n');
    expect(res.applied.every((a) => a.mode === "exact")).toBe(true);
  });

  it("7. SEARCH matching twice → EDIT_AMBIGUOUS, file untouched", () => {
    const file = "let x = 1;\nlet x = 1;\n";
    const res = applyEditBlocks(file, [{ search: "let x = 1;", replace: "let x = 2;" }]);
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("EDIT_AMBIGUOUS");
    expect(res.content).toBe(file);
  });

  it("8. markdown fences first/last stripped; fences mid-content preserved", () => {
    const { parser, c } = harness();
    const body = "```tsx\nconst doc = `\n```\ninner fence\n```\n`;\n```";
    feed(parser, `<nihil-write path="d.tsx">\n${body}\n</nihil-write>`);
    const content = (c.closes[0].action as any).content as string;
    expect(content.startsWith("const doc")).toBe(true);
    expect(content.endsWith("`;")).toBe(true);
    expect(content).toContain("```\ninner fence\n```");
  });

  it("9. unknown tag → warning, prose continues", () => {
    const { parser, c } = harness();
    feed(parser, `hello <nihil-teleport target="moon"/> world <nihil-portal>\nsecret body\n</nihil-portal> end`, [7]);
    expect(c.errors.filter((e) => e.code === "UNKNOWN_TAG")).toHaveLength(2);
    expect(c.errors.every((e) => e.severity === "warning")).toBe(true);
    const prose = c.prose.join("");
    expect(prose).toContain("hello");
    expect(prose).toContain("world");
    expect(prose).toContain("end");
    expect(prose).not.toContain("secret body");
    expect(c.closes).toHaveLength(0);
  });

  it("10. stream truncated inside open content → STREAM_TRUNCATED, prior actions kept", () => {
    const { parser, c } = harness();
    const text = WRITE("ok.ts", "export {};") + `\n<nihil-write path="cut.ts">\nconst never = `;
    const finalErrors = feed(parser, text, [19]);
    expect(c.closes).toHaveLength(1);
    expect((c.closes[0].action as any).path).toBe("ok.ts");
    expect(finalErrors.some((e) => e.code === "STREAM_TRUNCATED")).toBe(true);
  });

  it("11. plan + write in same message → PLAN_MODE_VIOLATION", () => {
    const { parser, c } = harness();
    const text = `<nihil-plan title="Auth">\n1. do things\n</nihil-plan>\n` + WRITE("a.ts", "x");
    feed(parser, text, [23]);
    expect(c.closes).toHaveLength(1);
    expect(c.closes[0].action.kind).toBe("plan");
    expect(c.errors.some((e) => e.code === "PLAN_MODE_VIOLATION")).toBe(true);
  });

  it("12. re-parse same accumulated text twice → zero duplicate events", () => {
    const { parser, c } = harness();
    const text = `intro ${WRITE("a.ts", "const a = 1;")}`;
    parser.parse("m1", text);
    const closesAfterFirst = c.closes.length;
    const proseAfterFirst = c.prose.join("");
    parser.parse("m1", text); // identical accumulated input
    expect(c.closes.length).toBe(closesAfterFirst);
    expect(c.prose.join("")).toBe(proseAfterFirst);
  });

  it("13. CRLF file content with LF SEARCH → fuzzy EOL-tolerant apply", () => {
    const file = "function hello() {\r\n  return 1;\r\n}\r\n";
    const res = applyEditBlocks(file, [
      { search: "function hello() {\n  return 1;\n}", replace: "function hello() {\n  return 2;\n}" },
    ]);
    expect(res.ok).toBe(true);
    expect(res.applied[0].mode).toBe("fuzzy-ws");
    expect(res.content).toContain("return 2;");
  });

  it("14. 5 MB single file write streamed in small chunks → linear time", () => {
    const { parser, c } = harness();
    const line = "export const v" + "x".repeat(40) + " = 12345;\n";
    const big = line.repeat(Math.ceil((5 * 1024 * 1024) / line.length));
    const text = `<nihil-write path="big.ts">\n${big}</nihil-write>`;
    const t0 = performance.now();
    let acc = "";
    for (let i = 0; i < text.length; i += 5000) {
      acc = text.slice(0, i + 5000);
      parser.parse("m1", acc);
    }
    parser.finalize("m1");
    const elapsed = performance.now() - t0;
    expect(c.closes).toHaveLength(1);
    expect((c.closes[0].action as any).content.length).toBeGreaterThan(5 * 1024 * 1024 - line.length);
    // quadratic rescanning of a 5MB buffer across ~1100 chunks would take far longer
    expect(elapsed).toBeLessThan(5000);
  });
});

describe("supplementary protocol behavior", () => {
  it("self-closing action tags emit immediately and bodies of bodied non-containers are ignored", () => {
    const { parser, c } = harness();
    feed(
      parser,
      `<nihil-rename from="a.ts" to="b.ts"/>\n<nihil-delete path="c.ts">\nnarration ignored\n</nihil-delete>\n<nihil-add-dependency packages="zustand@^4 jotai@latest"/>\n<nihil-run workflow="dev"/>`,
      [9],
    );
    expect(c.closes.map((x) => x.action.kind)).toEqual(["rename", "delete", "add-dependency", "run"]);
    expect((c.closes[2].action as any).packages).toEqual(["zustand@^4", "jotai@latest"]);
    expect(c.prose.join("")).not.toContain("narration");
  });

  it("path traversal and absolute paths are rejected with PATH_FORBIDDEN", () => {
    const { parser, c } = harness();
    feed(parser, `<nihil-delete path="../etc/passwd"/>\n<nihil-delete path="/root/x"/>`);
    expect(c.errors.filter((e) => e.code === "PATH_FORBIDDEN")).toHaveLength(2);
    expect(c.closes).toHaveLength(0);
  });

  it("NUL and C0 control characters in a path are rejected with PATH_FORBIDDEN", () => {
    const { parser, c } = harness();
    const nul = String.fromCharCode(0x00);
    const ctrl = String.fromCharCode(0x1f);
    feed(parser, `<nihil-write path="src/a${nul}b.ts">\nx\n</nihil-write>\n<nihil-delete path="src/c${ctrl}d.ts"/>`);
    expect(c.errors.filter((e) => e.code === "PATH_FORBIDDEN")).toHaveLength(2);
    expect(c.closes).toHaveLength(0);
  });

  it("missing required attribute → MALFORMED_TAG, body consumed", () => {
    const { parser, c } = harness();
    feed(parser, `<nihil-write description="no path">\nlost content\n</nihil-write>\nafter`);
    expect(c.errors.some((e) => e.code === "MALFORMED_TAG")).toBe(true);
    expect(c.closes).toHaveLength(0);
    expect(c.prose.join("")).toContain("after");
    expect(c.prose.join("")).not.toContain("lost content");
  });

  it("XML-escaped attributes and content are unescaped", () => {
    const { parser, c } = harness();
    feed(parser, `<nihil-write path="src/a&amp;b.ts">\nif (a &lt; b &amp;&amp; c &gt; d) {}\n</nihil-write>`);
    expect((c.closes[0].action as any).path).toBe("src/a&b.ts");
    expect((c.closes[0].action as any).content).toBe("if (a < b && c > d) {}");
  });

  it("indented close tag (line-start with leading whitespace) is recognized", () => {
    const { parser, c } = harness();
    feed(parser, `<nihil-write path="a.ts">\nconst a = 1;\n  </nihil-write> trailing prose`);
    expect(c.closes).toHaveLength(1);
    expect((c.closes[0].action as any).content).toBe("const a = 1;");
    expect(c.prose.join("")).toContain("trailing prose");
  });
});

describe("finalize flush", () => {
  it("trailing prose ending in a partial tag prefix is flushed at finalize", () => {
    const c = { prose: [] as string[] };
    const parser = new NihilStreamParser({ onProse: (_m, t) => c.prose.push(t) });
    const text = "to write files, use <nihil-";
    parser.parse("m1", text);
    parser.finalize("m1", text);
    expect(c.prose.join("")).toBe(text);
  });
});
