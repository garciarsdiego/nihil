
import { describe, it, expect } from "vitest";
import { applyEditBlocks, parseEditBlocks, type SearchReplaceBlock } from "../index.js";

/**
 * Seeded PRNG for deterministic edit-block property tests.
 * SEED LOG: 0xBEEF (48879)
 */
const SEED = 0xbeef;
function mulberry32(): () => number {
  let state = SEED;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32();

describe("property-edit-blocks: applyEditBlocks invariants", () => {

  it("seed logged: 0xbeef", () => {
    expect(SEED).toBe(0xbeef);
  });

  describe("atomicity: any failure => output === input", () => {
    it("EDIT_AMBIGUOUS returns original content (exact match, duplicate)", () => {
      const file = "let x = 1;\nlet x = 1;\n";
      const res = applyEditBlocks(file, [{ search: "let x = 1;", replace: "let x = 2;" }]);
      expect(res.ok).toBe(false);
      expect(res.error?.code).toBe("EDIT_AMBIGUOUS");
      expect(res.content).toBe(file);
    });

    it("EDIT_NO_MATCH returns original content", () => {
      const file = "const y = 42;\n";
      const res = applyEditBlocks(file, [{ search: "const z = 99;", replace: "const z = 100;" }]);
      expect(res.ok).toBe(false);
      expect(res.error?.code).toBe("EDIT_NO_MATCH");
      expect(res.content).toBe(file);
    });

    it("partial failure in multi-block rolls back to original", () => {
      const file = "first line\nsecond line\nthird line\n";
      const blocks = [
        { search: "first line", replace: "modified first" },
        { search: "NONEXISTENT", replace: "WILL NEVER MATCH" },
      ];
      const res = applyEditBlocks(file, blocks);
      expect(res.ok).toBe(false);
      // Atomic: content must be exactly the original file
      expect(res.content).toBe(file);
      // First block may or may not be reported as applied depending on rollback
      // But the content must match original
    });

    it("multi-block where second fails returns original (generated)", () => {
      for (let i = 0; i < 50; i++) {
        const original = "lineA\nlineB\nlineC\n";
        const blocks: SearchReplaceBlock[] = [
          { search: "lineA", replace: "lineA_mod" },
          { search: "line" + String(Math.floor(rng() * 10)), replace: "will_fail" },
        ];
        const res = applyEditBlocks(original, blocks);
        if (!res.ok) {
          expect(res.content).toBe(original);
        }
      }
    });
  });

  describe("sequentiality: block N sees block N-1's result", () => {
    it("two blocks, second depends on first's output", () => {
      const file = "step1\nstep2\n";
      const res = applyEditBlocks(file, [
        { search: "step1", replace: "modified_step1" },
        { search: "modified_step1", replace: "twice_modified_step1" },
      ]);
      expect(res.ok).toBe(true);
      expect(res.content).toBe("twice_modified_step1\nstep2\n");
      expect(res.applied.every(a => a.mode === "exact")).toBe(true);
    });

    it("generated sequential dependency: block N matches what block N-1 produced", () => {
      for (let i = 0; i < 50; i++) {
        const tag = "MARK" + Math.floor(rng() * 10000);
        const v1 = "VAL1_" + tag;
        const v2 = "VAL2_" + tag;
        const v3 = "VAL3_" + tag;
        const file = tag + "\nrest\n";
        const blocks: SearchReplaceBlock[] = [
          { search: tag, replace: v1 },
          { search: v1, replace: v2 },
          { search: v2, replace: v3 },
        ];
        const res = applyEditBlocks(file, blocks);
        expect(res.ok).toBe(true);
        expect(res.content).toBe(v3 + "\nrest\n");
      }
    });
  });

  describe("exact-before-fuzzy precedence", () => {
    it("exact match is preferred over fuzzy when both possible", () => {
      // Exact and fuzzy could both match, but exact must win
      const file = "hello  world\n";
      // exact match requires the double space; fuzzy would match any whitespace run
      const res = applyEditBlocks(file, [{ search: "hello  world", replace: "hello world" }]);
      expect(res.ok).toBe(true);
      expect(res.applied[0].mode).toBe("exact");
    });

    it("fuzzy fallback used when exact fails", () => {
      const file = "hello    world\n";
      // Different whitespace width - exact fails, fuzzy should match
      const res = applyEditBlocks(file, [{ search: "hello  world", replace: "hello world" }]);
      expect(res.ok).toBe(true);
      expect(res.applied[0].mode).toBe("fuzzy-ws");
    });

    it("exact match on a unique line succeeds without fuzzy", () => {
      const file = "line 1\nline 2\n";
      // "line 1" is unique and matches exactly; no fuzzy fallback is needed.
      const res = applyEditBlocks(file, [{ search: "line 1", replace: "LINE ONE" }]);
      expect(res.ok).toBe(true);
      expect(res.applied[0].mode).toBe("exact");
    });
  });

  describe("ambiguity detection with crafted duplicate contexts", () => {
    it("detects ambiguity when same text appears twice", () => {
      const file = "TODO: implement\nTODO: implement\n";
      const res = applyEditBlocks(file, [{ search: "TODO: implement", replace: "DONE" }]);
      expect(res.ok).toBe(false);
      expect(res.error?.code).toBe("EDIT_AMBIGUOUS");
    });

    it("detects fuzzy ambiguity with whitespace variations", () => {
      const file = "TODO fix\nTODO   fix\n";
      const res = applyEditBlocks(file, [{ search: "TODO  fix", replace: "DONE" }]);
      expect(res.ok).toBe(false);
      expect(res.error?.code).toBe("EDIT_AMBIGUOUS");
    });

    it("disambiguation via extra context lines resolves ambiguity", () => {
      const file = "before\nTODO\nmiddle\nTODO\nafter\n";
      const res = applyEditBlocks(file, [
        { search: "before\nTODO", replace: "before\nDONE" },
      ]);
      expect(res.ok).toBe(true);
      expect(res.content).toContain("DONE");
      expect(res.content).toContain("middle\nTODO");
    });
  });

  describe("CRLF/LF mixed files", () => {
    it("CRLF file with LF search matches via fuzzy", () => {
      const file = "function a() {\r\n  return 1;\r\n}\r\n";
      const res = applyEditBlocks(file, [
        { search: "function a() {\n  return 1;\n}", replace: "function a() {\n  return 2;\n}" },
      ]);
      expect(res.ok).toBe(true);
      expect(res.applied[0].mode).toBe("fuzzy-ws");
    });

    it("CRLF file with CRLF search matches via exact", () => {
      const file = "function a() {\r\n  return 1;\r\n}\r\n";
      const res = applyEditBlocks(file, [
        { search: "function a() {\r\n  return 1;\r\n}", replace: "function a() {\r\n  return 2;\r\n}" },
      ]);
      expect(res.ok).toBe(true);
      expect(res.applied[0].mode).toBe("exact");
    });

    it("mixed CRLF/LF file handled correctly", () => {
      const file = "line1\r\nline2\nline3\r\n";
      const res = applyEditBlocks(file, [
        { search: "line2", replace: "LINE2" },
      ]);
      expect(res.ok).toBe(true);
      expect(res.applied[0].mode).toBe("exact");
      // CRLF before and after line2 should be preserved
      expect(res.content).toContain("line1\r\n");
      expect(res.content).toContain("\nline3");
    });
  });

  describe("parseEditBlocks edge cases", () => {
    it("empty body returns error", () => {
      const { blocks, error } = parseEditBlocks("");
      expect(blocks).toHaveLength(0);
      expect(error).toBeDefined();
    });

    it("unexpected content outside blocks returns error", () => {
      const { blocks, error } = parseEditBlocks("garbage content");
      expect(blocks).toHaveLength(0);
      expect(error).toBeDefined();
    });

    it("unterminated SEARCH returns error", () => {
      const { blocks, error } = parseEditBlocks("<<<<<<< SEARCH\ncontent\n");
      expect(blocks).toHaveLength(0);
      expect(error).toBeDefined();
    });

    it("marker not at column 0 is not recognized as marker", () => {
      // Indented marker - should be treated as content
      const { blocks, error } = parseEditBlocks("  <<<<<<< SEARCH\ncontent\n=======\nreplacement\n>>>>>>> REPLACE");
      expect(blocks).toHaveLength(0);
      expect(error).toBeDefined();
    });
  });
});
