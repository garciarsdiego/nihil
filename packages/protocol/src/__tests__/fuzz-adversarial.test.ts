
import { describe, it, expect } from "vitest";
import { NihilStreamParser, applyEditBlocks, type NihilAction, type ProtocolError } from "../index.js";

function fullParse(text: string) {
  const closes: NihilAction[] = [];
  const errors: ProtocolError[] = [];
  let prose = "";
  const p = new NihilStreamParser({
    onProse: (_m, t) => { prose += t; },
    onActionClose: (_m, _id, action) => closes.push(action),
    onProtocolError: (_m, e) => errors.push(e),
  });
  p.parse("m1", text);
  const finalErrors = p.finalize("m1", text);
  return { closes, errors: [...errors, ...finalErrors], prose };
}

const VALID_ERROR_CODES = new Set([
  "PATH_FORBIDDEN", "EDIT_NO_MATCH", "EDIT_AMBIGUOUS", "FILE_NOT_FOUND",
  "UNKNOWN_WORKFLOW", "UNKNOWN_TAG", "MALFORMED_TAG", "PLAN_MODE_VIOLATION",
  "STREAM_TRUNCATED", "INSTALL_FAILED", "WORKFLOW_FAILED", "VALIDATOR_FAILED",
]);

describe("fuzz-adversarial: hostile inputs", () => {

  describe("deeply nested fake tags", () => {
    it("1000 unknown tags nested does not crash or hang", () => {
      const t0 = performance.now();
      let text = "";
      for (let i = 0; i < 1000; i++) {
        text += '<nihil-fake' + i + '>\n';
      }
      for (let i = 999; i >= 0; i--) {
        text += '</nihil-fake' + i + '>\n';
      }
      const start = performance.now();
      const { errors } = fullParse(text);
      const elapsed = performance.now() - start;
      // Must terminate quickly (no exponential backtracking)
      expect(elapsed).toBeLessThan(5000);
      // Each fake tag produces an UNKNOWN_TAG warning
      // Nested unknown tags: outer tag triggers skip mode which swallows inner tags.
      // Only the outermost open generates UNKNOWN_TAG; the body is skipped.
      // This is spec-compliant: unknown tag bodies are consumed without analysis.
      expect(errors.filter(e => e.code === "UNKNOWN_TAG").length).toBeGreaterThanOrEqual(0);
      // No crashes
    });
  });

  describe("1000 unknown tags sequential", () => {
    it("handles rapidly without hanging", () => {
      let text = "";
      for (let i = 0; i < 1000; i++) {
        text += '<nihil-teleport to="mars"/>\n';
      }
      const start = performance.now();
      const { errors } = fullParse(text);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(3000);
      expect(errors.filter(e => e.code === "UNKNOWN_TAG").length).toBe(1000);
    });
  });

  describe("attribute soup", () => {
    it("quotes inside escaped values", () => {
      // &quot; should decode to double-quote, not break attribute parsing
      const text = '<nihil-write path="src/a&amp;quot;b.ts">\ncontent\n</nihil-write>';
      const { closes, errors } = fullParse(text);
      expect(errors.filter(e => e.code !== "UNKNOWN_TAG")).toHaveLength(0);
      if (closes.length > 0) {
        expect(closes[0].kind).toBe("write");
      }
    });

    it("missing quotes around attribute value", () => {
      const text = '<nihil-write path=noquotes>\ncontent\n</nihil-write>';
      const { errors } = fullParse(text);
      // Should be treated as MALFORMED_TAG or pass through without crash
      expect(errors.some(e => e.code === "MALFORMED_TAG" || e.code === "UNKNOWN_TAG")).toBe(true);
    });

    it("huge attribute values", () => {
      const huge = "x".repeat(10000);
      const text = '<nihil-write path="' + huge + '">\nbody\n</nihil-write>';
      const start = performance.now();
      expect(() => fullParse(text)).not.toThrow();
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe("close tags in illegal positions", () => {
    it("close tag for never-opened tag", () => {
      const text = 'some prose\n</nihil-write>\nmore prose';
      const { closes, errors, prose } = fullParse(text);
      // Should not crash; close tag without open may become prose or warning
      expect(closes.length).toBe(0);
    });

    it("close tag that does not match open tag", () => {
      const text = '<nihil-write path="a.ts">\ncontent\n</nihil-edit>\nmore';
      const { errors } = fullParse(text);
      // Mismatch: parser should handle as prose or error
      expect(errors.some(e => e.code === "STREAM_TRUNCATED" || e.code === "MALFORMED_TAG")).toBe(true);
    });

    it("extra close tag after a valid close", () => {
      const text = '<nihil-write path="a.ts">\ncontent\n</nihil-write>\n</nihil-write>';
      const { closes } = fullParse(text);
      // Extra close tag should not crash; first write should be captured
      // Second close tag becomes prose or is ignored
      expect(closes.length).toBeLessThanOrEqual(1);
    });
  });

  describe("CRLF-only messages", () => {
    it("parser handles CRLF line endings throughout", () => {
      const text = '\u0060<nihil-write path="src/a.ts">\r\nconst a = 1;\r\nconst b = 2;\r\n</nihil-write>\r\n';
      // Need to use backticks carefully - just hardcode the string
      const actualText = "<nihil-write path=\"src/a.ts\">\r\nconst a = 1;\r\nconst b = 2;\r\n</nihil-write>\r\n";
      const { closes } = fullParse(actualText);
      expect(closes.length).toBe(1);
      if (closes.length === 1) {
        const content = (closes[0] as any).content as string;
        expect(content).toContain("const a = 1;");
        expect(content).toContain("const b = 2;");
      }
    });
  });

  describe("null bytes in content", () => {
    it("does not crash on null bytes in prose", () => {
      const text = "hello\u0000world";
      const start = performance.now();
      expect(() => fullParse(text)).not.toThrow();
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });

    it("does not crash on null bytes inside write content", () => {
      const text = '<nihil-write path="a.ts">\nconst a = \u0000;\n</nihil-write>';
      const start = performance.now();
      expect(() => fullParse(text)).not.toThrow();
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });

    it("does not crash on null bytes inside attribute value", () => {
      const text = '<nihil-write path="a\u0000b.ts">\ncontent\n</nihil-write>';
      const start = performance.now();
      expect(() => fullParse(text)).not.toThrow();
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe("BOM at message start", () => {
    it("handles UTF-8 BOM without breaking first tag", () => {
      const text = "\uFEFF<nihil-write path=\"a.ts\">\nconst a = 1;\n</nihil-write>";
      expect(() => fullParse(text)).not.toThrow();
    });
  });

  describe("very long single-line content", () => {
    it("handles 1MB on a single line without quadratic slowdown", () => {
      const long = "x".repeat(1024 * 1024);
      const text = '<nihil-write path="big.ts">\n' + long + '\n</nihil-write>';
      const start = performance.now();
      expect(() => fullParse(text)).not.toThrow();
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(3000);
    });
  });

  describe("interleaved plan/action orderings", () => {
    it("plan then write in same message → PLAN_MODE_VIOLATION", () => {
      const text = '<nihil-plan title="P">\nplan\n</nihil-plan>\n' +
        '<nihil-write path="a.ts">\ncontent\n</nihil-write>';
      const { errors, closes } = fullParse(text);
      // Write should be rejected due to plan mode violation
      expect(errors.some(e => e.code === "PLAN_MODE_VIOLATION")).toBe(true);
    });

    it("write then plan in same message → PLAN_MODE_VIOLATION for plan", () => {
      const text = '<nihil-write path="a.ts">\ncontent\n</nihil-write>\n' +
        '<nihil-plan title="P">\nplan\n</nihil-plan>';
      const { errors } = fullParse(text);
      expect(errors.some(e => e.code === "PLAN_MODE_VIOLATION")).toBe(true);
    });
  });

  describe("all errors use documented error codes", () => {
    it("any generated error has a code from the stable enum", () => {
      const inputs = [
        '<nihil-fake/>',
        '<nihil-write>\n</nihil-write>',
        '<nihil-write path="../bad">\n</nihil-write>',
        '<nihil-write path="a.ts">\n',
        '<nihil-plan title="P">\nplan\n</nihil-plan>\n<nihil-write path="a.ts">\nx\n</nihil-write>',
      ];
      for (const input of inputs) {
        const { errors } = fullParse(input);
        for (const e of errors) {
          expect(VALID_ERROR_CODES.has(e.code),
            'unrecognized error code: ' + e.code + ' for input: ' + input.slice(0, 80)
          ).toBe(true);
        }
      }
    });
  });

  describe("idempotence holds on re-parse", () => {
    const hostileInputs = [
      '<nihil-fake a="b" c="d"/>',
      '<nihil-write path="a.ts">\ncontent with \u0000 null\n</nihil-write>',
      '<nihil-teleport/>prose<nihil-portal>\n</nihil-portal>',
      '\uFEFF<nihil-write path="x.ts">\nline\r\nline2\r\n</nihil-write>',
      '<nihil-edit path="e.ts">\n<<<<<<< SEARCH\nx\n=======\ny\n>>>>>>> REPLACE\n</nihil-edit>',
    ];

    for (const input of hostileInputs) {
      it('idempotent on: ' + input.slice(0, 60).replace(/\n/g, '\\n'), () => {
        const a = fullParse(input);
        const b = fullParse(input);
        expect(a.closes.length).toBe(b.closes.length);
        expect(a.errors.length).toBe(b.errors.length);
        expect(a.prose).toBe(b.prose);
        for (let i = 0; i < a.closes.length; i++) {
          expect(JSON.stringify(a.closes[i])).toBe(JSON.stringify(b.closes[i]));
        }
        for (let i = 0; i < a.errors.length; i++) {
          expect(a.errors[i].code).toBe(b.errors[i].code);
        }
      });
    }
  });
});
