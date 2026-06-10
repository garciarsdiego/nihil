/**
 * runner.edit-matrix.test.ts
 *
 * Exhaustive <nihil-edit> apply-chain matrix exercised through ProjectRunner.
 * Covers exact match, fuzzy-ws, no-match, ambiguous, multi-block sequential,
 * atomic rollback on partial failure, missing file, and malformed edit tags.
 *
 * Imports only the shared fakes — no disk, no git, no timers.
 */

import { ProjectRunner } from "../agent/runner.js";
import {
  FakeGitBackend,
  FakeTarget,
  MemoryProject,
  singleChunk,
  chunks,
} from "./fakes/memory-project.js";

// ── helpers ────────────────────────────────────────────────────────────────

function makeRunner(
  seed: Record<string, string> = {},
  applyEnabled = true,
) {
  const project = new MemoryProject();
  project.seed(seed);
  const target = new FakeTarget(project);
  const git = new FakeGitBackend(project);
  const runner = new ProjectRunner({ target, git, applyEnabled });
  return { project, target, git, runner };
}

// ── suite ──────────────────────────────────────────────────────────────────

describe("ProjectRunner — <nihil-edit> apply-chain matrix", () => {
  // ── 1. Exact single-block match ─────────────────────────────────────────

  it("exact single-block match: applies the replacement and commits", async () => {
    const original = 'const greeting = "hello";\n';
    const { project, runner } = makeRunner({ "src/greet.ts": original });

    const msg = `<nihil-edit path="src/greet.ts">
<<<<<<< SEARCH
const greeting = "hello";
=======
const greeting = "hello, world";
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m-exact", singleChunk(msg));

    expect(result.committed).toBe(true);
    expect(result.rolledBack).toBe(false);
    // The replacement splices into the full string; the trailing \n from the
    // original line remains because SEARCH matched only the non-newline portion.
    expect(project.files.get("src/greet.ts")).toContain(
      'const greeting = "hello, world"',
    );
    expect(result.outcomes).toEqual([
      { actionId: 0, kind: "edit", ok: true, path: "src/greet.ts" },
    ]);
    // No error feedback for a clean edit
    expect(result.feedback).not.toContain('type="error"');
  });

  // ── 2. Whitespace-fuzzy match ───────────────────────────────────────────

  it("fuzzy-ws match: applies when whitespace differs and committed=true", async () => {
    // File uses two-space indent; SEARCH block uses four-space indent — should fuzzy-match.
    const original = "function foo() {\n  return 1;\n}\n";
    const { project, runner } = makeRunner({ "src/foo.ts": original });

    // SEARCH block has extra leading spaces — fuzzy-ws should kick in.
    const msg = `<nihil-edit path="src/foo.ts">
<<<<<<< SEARCH
function foo() {
    return 1;
}
=======
function foo() {
  return 2;
}
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m-fuzzy", singleChunk(msg));

    // The replacement must have landed; exact text of replace block wins.
    expect(result.committed).toBe(true);
    expect(project.files.get("src/foo.ts")).toContain("return 2");
    expect(result.outcomes[0]).toMatchObject({ kind: "edit", ok: true });
  });

  // ── 3. EDIT_NO_MATCH: file untouched, feedback contains file excerpt ────

  it("EDIT_NO_MATCH: file is untouched and feedback body includes 'Current content of <path>'", async () => {
    const original = "export const x = 42;\n";
    const { project, runner } = makeRunner({ "src/const.ts": original });

    const msg = `<nihil-edit path="src/const.ts">
<<<<<<< SEARCH
export const DOES_NOT_EXIST = 0;
=======
export const y = 99;
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m-nomatch", singleChunk(msg));

    // File must be untouched
    expect(project.files.get("src/const.ts")).toBe(original);

    // Feedback must carry code and file excerpt
    expect(result.feedback).toContain('code="EDIT_NO_MATCH"');
    expect(result.feedback).toContain("Current content of src/const.ts");

    // Outcome records failure
    expect(result.outcomes[0]).toMatchObject({
      kind: "edit",
      ok: false,
      code: "EDIT_NO_MATCH",
      path: "src/const.ts",
    });

    // Nothing committed (no successful changes)
    expect(result.committed).toBe(false);
  });

  // ── 4. EDIT_AMBIGUOUS: search matches >1 location, file untouched ───────

  it("EDIT_AMBIGUOUS: file is untouched when SEARCH matches more than once", async () => {
    // The SEARCH text appears twice in the file.
    const repeated = "const n = 1;\n";
    const original = `${repeated}// separator\n${repeated}`;
    const { project, runner } = makeRunner({ "src/dup.ts": original });

    const msg = `<nihil-edit path="src/dup.ts">
<<<<<<< SEARCH
const n = 1;
=======
const n = 2;
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m-ambig", singleChunk(msg));

    // File MUST remain unchanged
    expect(project.files.get("src/dup.ts")).toBe(original);

    expect(result.feedback).toContain('code="EDIT_AMBIGUOUS"');
    expect(result.outcomes[0]).toMatchObject({
      kind: "edit",
      ok: false,
      code: "EDIT_AMBIGUOUS",
      path: "src/dup.ts",
    });
    expect(result.committed).toBe(false);
  });

  // ── 5. Multi-block: block 2 depends on block 1's result (sequential) ────

  it("multi-block edit: block 2 sees the file state after block 1 applied", async () => {
    // Original: has "alpha" and "beta". Block 1 renames alpha→gamma so block 2
    // can safely match "gamma" (it would miss "alpha").
    const original = "const alpha = 1;\nconst beta = 2;\n";
    const { project, runner } = makeRunner({ "src/seq.ts": original });

    const msg = `<nihil-edit path="src/seq.ts">
<<<<<<< SEARCH
const alpha = 1;
=======
const gamma = 1;
>>>>>>> REPLACE
<<<<<<< SEARCH
const gamma = 1;
=======
const gamma = 100;
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m-seq", singleChunk(msg));

    expect(result.committed).toBe(true);
    const content = project.files.get("src/seq.ts");
    expect(content).toContain("const gamma = 100;");
    expect(content).not.toContain("const alpha");
    expect(result.outcomes[0]).toMatchObject({ kind: "edit", ok: true });
  });

  // ── 6. Atomic: block 1 succeeds but block 2 fails → original restored ───

  it("atomic rollback: when block 2 fails the file is left with the ORIGINAL content", async () => {
    const original = "const a = 1;\nconst b = 2;\n";
    const { project, runner } = makeRunner({ "src/atomic.ts": original });

    // Block 1 matches; block 2 does NOT match → applyEditBlocks returns original.
    const msg = `<nihil-edit path="src/atomic.ts">
<<<<<<< SEARCH
const a = 1;
=======
const a = 100;
>>>>>>> REPLACE
<<<<<<< SEARCH
const MISSING = 999;
=======
const MISSING = 1000;
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m-atomic", singleChunk(msg));

    // applyEditBlocks is atomic: on any block failure it returns original content.
    expect(project.files.get("src/atomic.ts")).toBe(original);
    expect(result.feedback).toContain('code="EDIT_NO_MATCH"');
    expect(result.outcomes[0]).toMatchObject({ kind: "edit", ok: false });
    expect(result.committed).toBe(false);
  });

  // ── 7. FILE_NOT_FOUND: edit on a missing file ───────────────────────────

  it("FILE_NOT_FOUND: editing a file that does not exist gives appropriate feedback", async () => {
    const { project, runner } = makeRunner({}); // no files seeded

    const msg = `<nihil-edit path="src/missing.ts">
<<<<<<< SEARCH
anything
=======
something
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m-notfound", singleChunk(msg));

    // File must not be created
    expect(project.files.has("src/missing.ts")).toBe(false);

    expect(result.feedback).toContain('code="FILE_NOT_FOUND"');
    expect(result.outcomes[0]).toMatchObject({
      kind: "edit",
      ok: false,
      code: "FILE_NOT_FOUND",
      path: "src/missing.ts",
    });
    expect(result.committed).toBe(false);
  });

  // ── 8. MALFORMED_TAG: unterminated SEARCH block ─────────────────────────
  //
  // When parseEditBlocks returns an error, the parser emits MALFORMED_TAG via
  // onProtocolError and returns null from #buildAction → onActionClose is NEVER
  // called. The runner's #onProtocolError records the feedback.
  // The file must remain untouched.

  it("MALFORMED_TAG (unterminated SEARCH): onActionClose not called, file untouched, feedback code=MALFORMED_TAG", async () => {
    const original = "const z = 0;\n";
    const { project, runner } = makeRunner({ "src/malformed.ts": original });

    // Missing >>>>>>> REPLACE line — unterminated block. The close tag IS on its
    // own line so the parser can close the tag, but parseEditBlocks will fail.
    const msg = `<nihil-edit path="src/malformed.ts">
<<<<<<< SEARCH
const z = 0;
=======
const z = 1;
</nihil-edit>`;

    const result = await runner.runMessage("m-malformed", singleChunk(msg));

    // File must be untouched
    expect(project.files.get("src/malformed.ts")).toBe(original);

    // Feedback must carry MALFORMED_TAG
    expect(result.feedback).toContain('code="MALFORMED_TAG"');

    // Nothing was committed
    expect(result.committed).toBe(false);
  });

  // ── 9. MALFORMED_TAG: missing required path attribute ───────────────────

  it("MALFORMED_TAG (missing path attr): file untouched, runner gets MALFORMED_TAG feedback", async () => {
    const original = "export default 1;\n";
    const { project, runner } = makeRunner({ "src/nopath.ts": original });

    // No path= attribute — parser emits MALFORMED_TAG immediately.
    const msg = `<nihil-edit>
<<<<<<< SEARCH
export default 1;
=======
export default 2;
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m-nopath", singleChunk(msg));

    expect(project.files.get("src/nopath.ts")).toBe(original);
    expect(result.feedback).toContain('code="MALFORMED_TAG"');
    expect(result.committed).toBe(false);
  });

  // ── 10. Successful edit does NOT leave error feedback ───────────────────

  it("a successful single-block edit produces no error/warning in feedback", async () => {
    const { project, runner } = makeRunner({
      "src/clean.ts": "export const v = 1;\n",
    });

    const msg = `<nihil-edit path="src/clean.ts">
<<<<<<< SEARCH
export const v = 1;
=======
export const v = 2;
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m-clean", singleChunk(msg));

    expect(result.committed).toBe(true);
    expect(project.files.get("src/clean.ts")).toContain("export const v = 2");
    // No error or warning output
    expect(result.feedback).not.toContain('type="error"');
    expect(result.feedback).not.toContain('type="warning"');
  });

  // ── 11. Edit succeeds after a write in the same message ─────────────────

  it("edit that targets a file written earlier in the same message applies correctly", async () => {
    const { project, runner } = makeRunner();

    // Write creates the file; edit patches it. Because queue is serial, the
    // write completes before the edit starts.
    const msg = `<nihil-write path="src/new.ts">
const val = 1;
</nihil-write>
<nihil-edit path="src/new.ts">
<<<<<<< SEARCH
const val = 1;
=======
const val = 42;
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m-write-then-edit", singleChunk(msg));

    expect(result.committed).toBe(true);
    expect(project.files.get("src/new.ts")).toBe("const val = 42;");
    expect(result.outcomes).toHaveLength(2);
    expect(result.outcomes[0]).toMatchObject({ kind: "write", ok: true });
    expect(result.outcomes[1]).toMatchObject({ kind: "edit", ok: true });
  });

  // ── 12. Two separate edits: first fails, second succeeds ────────────────
  //
  // DECISIONS #16: partial failure commits the succeeded actions.

  it("second edit succeeds even if first edit fails (partial-failure commit semantics)", async () => {
    const { project, runner } = makeRunner({
      "src/a.ts": "const a = 1;\n",
      "src/b.ts": "const b = 2;\n",
    });

    const msg = `<nihil-edit path="src/a.ts">
<<<<<<< SEARCH
NOT_IN_FILE
=======
replaced
>>>>>>> REPLACE
</nihil-edit>
<nihil-edit path="src/b.ts">
<<<<<<< SEARCH
const b = 2;
=======
const b = 99;
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m-partial", singleChunk(msg));

    // File a untouched; file b updated
    expect(project.files.get("src/a.ts")).toBe("const a = 1;\n");
    expect(project.files.get("src/b.ts")).toContain("const b = 99");

    // Partial commit: b's change landed
    expect(result.committed).toBe(true);

    // Outcomes reflect mixed results
    expect(result.outcomes[0]).toMatchObject({ kind: "edit", ok: false, code: "EDIT_NO_MATCH" });
    expect(result.outcomes[1]).toMatchObject({ kind: "edit", ok: true, path: "src/b.ts" });

    // Feedback carries the no-match error
    expect(result.feedback).toContain('code="EDIT_NO_MATCH"');
  });

  // ── 13. Multi-block: all three blocks succeed sequentially ──────────────

  it("three-block edit applied in order with each block seeing the previous result", async () => {
    const original = "a\nb\nc\n";
    const { project, runner } = makeRunner({ "src/three.ts": original });

    // Each block transforms one line; because each is unique after the prior
    // transformation, sequential application should work exactly.
    const msg = `<nihil-edit path="src/three.ts">
<<<<<<< SEARCH
a
=======
x
>>>>>>> REPLACE
<<<<<<< SEARCH
b
=======
y
>>>>>>> REPLACE
<<<<<<< SEARCH
c
=======
z
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m-three", singleChunk(msg));

    expect(result.committed).toBe(true);
    const content = project.files.get("src/three.ts");
    expect(content).toContain("x");
    expect(content).toContain("y");
    expect(content).toContain("z");
    expect(content).not.toContain("a");
    expect(content).not.toContain("b");
    expect(content).not.toContain("c");
    expect(result.outcomes[0]).toMatchObject({ kind: "edit", ok: true });
  });

  // ── 14. Edit on nihil.config.json triggers configChanged flag ───────────

  it("editing nihil.config.json is flagged as a config change in the result", async () => {
    const configContent = JSON.stringify({ workflows: { dev: { command: "vite" } } });
    const { project, runner } = makeRunner({ "nihil.config.json": configContent });

    const msg = `<nihil-edit path="nihil.config.json">
<<<<<<< SEARCH
"vite"
=======
"vite --port 3001"
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m-cfg-edit", singleChunk(msg));

    expect(result.committed).toBe(true);
    expect(result.configChanged).toBe(true);
    // The info feedback about config change must be present (DECISIONS #14)
    expect(result.feedback).toContain('type="info"');
    expect(project.files.get("nihil.config.json")).toContain("3001");
  });

  // ── 15. Edit with empty SEARCH block (edge case) ─────────────────────────
  //
  // Empty search is not special-cased by applyEditBlocks: countOccurrences
  // returns 0 for empty needle, so it falls through to fuzzy. The fuzzy regex
  // for an empty search string emits zero-length matches that are filtered out
  // (matches.filter(m => m[0].length > 0)), so we get EDIT_NO_MATCH.

  it("empty SEARCH block returns EDIT_NO_MATCH and leaves file untouched", async () => {
    const original = "hello\n";
    const { project, runner } = makeRunner({ "src/e.ts": original });

    // Search is empty, replace has content
    const msg = `<nihil-edit path="src/e.ts">
<<<<<<< SEARCH
=======
inserted line
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m-empty-search", singleChunk(msg));

    expect(project.files.get("src/e.ts")).toBe(original);
    // Should produce some form of error (no-match or malformed)
    expect(
      result.feedback.includes('code="EDIT_NO_MATCH"') ||
        result.feedback.includes('code="MALFORMED_TAG"'),
    ).toBe(true);
    expect(result.committed).toBe(false);
  });

  // ── 16. EDIT_AMBIGUOUS via fuzzy path (duplicate whitespace variants) ───

  it("EDIT_AMBIGUOUS via fuzzy: file untouched when fuzzy matches multiple locations", async () => {
    // Two lines that differ only in whitespace from the SEARCH text.
    // No exact match forces fuzzy, which then finds both lines → AMBIGUOUS.
    const original = "  const n = 1;\n  const n = 1;\n";
    const { project, runner } = makeRunner({ "src/fuzz-amb.ts": original });

    // SEARCH won't exact-match (leading spaces differ) but fuzzy will hit both.
    const msg = `<nihil-edit path="src/fuzz-amb.ts">
<<<<<<< SEARCH
const n = 1;
=======
const n = 2;
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m-fuzz-amb", singleChunk(msg));

    expect(project.files.get("src/fuzz-amb.ts")).toBe(original);
    expect(result.feedback).toContain('code="EDIT_AMBIGUOUS"');
    expect(result.outcomes[0]).toMatchObject({ ok: false, code: "EDIT_AMBIGUOUS" });
    expect(result.committed).toBe(false);
  });

  // ── 17. Streaming chunks: edit split across multiple chunks ─────────────

  it("edit tag split across multiple accumulated-text chunks applies correctly", async () => {
    const original = "const split = false;\n";
    const { project, runner } = makeRunner({ "src/split.ts": original });

    // chunks() yields accumulated text snapshots (parser is re-entrant).
    const full = `<nihil-edit path="src/split.ts">
<<<<<<< SEARCH
const split = false;
=======
const split = true;
>>>>>>> REPLACE
</nihil-edit>`;

    // Deliver in two halves
    const half = Math.floor(full.length / 2);
    const result = await runner.runMessage(
      "m-split",
      chunks(full.slice(0, half), full),
    );

    expect(result.committed).toBe(true);
    expect(project.files.get("src/split.ts")).toContain("const split = true");
  });

  // ── 18. commitRef is returned on successful edit ─────────────────────────

  it("commitRef is populated when the edit produces a commit", async () => {
    const { runner } = makeRunner({ "src/r.ts": "const r = 0;\n" });

    const msg = `<nihil-edit path="src/r.ts">
<<<<<<< SEARCH
const r = 0;
=======
const r = 1;
>>>>>>> REPLACE
</nihil-edit>`;

    const result = await runner.runMessage("m-ref", singleChunk(msg));

    expect(result.committed).toBe(true);
    expect(typeof result.commitRef).toBe("string");
    expect(result.commitRef!.length).toBeGreaterThan(0);
  });
});
