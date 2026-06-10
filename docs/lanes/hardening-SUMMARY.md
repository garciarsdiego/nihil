# HARDENING REPORT — Lane 3 (DeepSeek V4)

**Branch:** lane/hardening  
**Date:** 2026-06-10  
**Package:** @nihil/protocol  
**Status:** Complete — no bugs found, no quarantines needed

## Summary

- **Tests added:** 73 new tests across 3 files
- **Existing tests:** 20/20 conformance tests still pass
- **Zero existing files modified** (confirmed via git diff --stat origin/main..HEAD)
- **Zero quarantined tests** — all failures were in test design, corrected per brief protocol
- **One spike delivered:** spikes/iframe-lite/ (standalone browser prototype + FEASIBILITY.md)

---

## Task 1: Protocol Fuzz & Property Tests

### 1a. fuzz-chunking.test.ts — Chunking Property Fuzz
**File:** packages/protocol/src/__tests__/fuzz-chunking.test.ts  
**Tests:** 31 (1 seed check + 10 corpus x 3 assertions)  
**Seed:** 0xFEED_C0DE (mulberry32 PRNG)

**Corpus (10 messages):**
1. Plain prose (no tags)
2. Simple write
3. Prose + write + prose
4. Two writes back to back
5. Edit with multi-block
6. Self-closing tags (rename, delete, run)
7. Unknown tags mixed in
8. Plan tag
9. Add-dependency tag
10. Complex mixed message (writes + dependency + rename + prose)

**Per-corpus assertions:**
- Exhaustive 1-char chunking produces identical result to single-pass parse
- 200 random partitions per message produce identical result
- Idempotence: double parse of same accumulated text yields same events

**Coverage rationale:** The primary property test — proves the parser's re-entrant
position tracking works correctly regardless of chunk boundaries. Covers
unicode splitting, mid-tag splits, mid-attribute splits, close-tag
disambiguation at chunk boundaries, and the partial-suspend mechanism.

### 1b. fuzz-adversarial.test.ts — Hostile Inputs
**File:** packages/protocol/src/__tests__/fuzz-adversarial.test.ts  
**Tests:** 22

**Test categories:**
- Deeply nested fake tags: 1000 nested tags, parser terminates via skip mode
- 1000 unknown tags sequential: mass UNKNOWN_TAG spam without hanging
- Attribute soup: escaped quotes, missing quotes, huge attribute values (10KB)
- Close tags in illegal positions: never-opened, mismatched, extra close
- CRLF-only messages: parser handles \r\n throughout
- Null bytes in prose, write content, and attribute values
- BOM at message start: UTF-8 BOM does not break first tag
- Very long single-line content: 1MB on one line without quadratic slowdown
- Interleaved plan/action orderings: both directions trigger PLAN_MODE_VIOLATION
- Error code validation: all errors use documented stable enum codes
- Idempotence: 5 hostile inputs re-parsed, results match exactly

### 1c. property-edit-blocks.test.ts — applyEditBlocks Invariants
**File:** packages/protocol/src/__tests__/property-edit-blocks.test.ts  
**Tests:** 20  
**Seed:** 0xBEEF (mulberry32 PRNG)

**Invariants tested:**
- Atomicity: EDIT_AMBIGUOUS/EDIT_NO_MATCH return original; multi-block rollback
- Sequentiality: block N sees block N-1's result (50 generated 3-block chains)
- Exact-before-fuzzy precedence: exact preferred; fuzzy fallback when exact fails
- Ambiguity detection: duplicate search, fuzzy ambiguity, disambiguation via context
- CRLF/LF handling: CRLF file with LF search, CRLF with CRLF, mixed CRLF/LF
- parseEditBlocks edge cases: empty body, unexpected content, unterminated, indented markers

### Performance
Total added test time: ~80ms (well under 30s guard).

---

## Task 2: iframe-lite Spike

**Directory:** spikes/iframe-lite/  
**Files:** index.html (231 lines), FEASIBILITY.md (105 lines)

**Prototype:** Single self-contained HTML page that:
1. Loads esbuild-wasm from esm.sh CDN
2. Takes an in-memory FileMap (editable JSON textarea)
3. Compiles React/TSX via custom esbuild plugin that resolves imports from FileMap
4. Renders result in a sandboxed iframe (sandbox="allow-scripts")
5. React 18 served via import maps from esm.sh CDN

**FEASIBILITY.md answers:**
- Works: TSX compile, bundle approach, error display
- Hard limits: Tailwind v4 Play CDN only, no HMR, CDN deps only, CSS limits
- M2 recommendation: viable as Tier-0 for landing pages
- Exact constraints table
- Estimated integration effort (1-2 days integrate, 2-3 days productionize)
- Run instructions (npx serve . or python3 -m http.server)

---

## Quarantined Findings

**None.** Two test failures were encountered and determined to be test design
issues, not implementation bugs:

1. **Nested unknown tags (fuzz-adversarial):** The parser enters skip mode for
   the outer unknown tag and consumes all inner content including inner unknown
   tags silently — this is spec-compliant (SPEC 6.5: skip body, warn). Test was
   corrected to match spec.

2. **Fuzzy ambiguity (property-edit-blocks):** The test case exact-matched before
   fuzzy ever ran. Test case corrected to use a search that exact-fails so fuzzy
   runs and correctly detects ambiguity. Exact-before-fuzzy precedence is correct.

---

## Fuzz Seeds Used

| File | Seed | PRNG |
|---|---|---|
| fuzz-chunking.test.ts | 0xFEED_C0DE (4277004510) | mulberry32 |
| property-edit-blocks.test.ts | 0xBEEF (48879) | mulberry32 |

---

## Checklist

- [x] **Zero existing files modified** — git diff --stat confirms 5 new, 0 modified
- [x] **Existing suites still green** — protocol 20/20 (93/93 with new tests)
- [x] **All fuzz uses logged seeds** — 0xfeedc0de and 0xbeef, reproducible
- [x] **Quarantine protocol followed** — no quarantine needed (all test-side)
- [x] **Spike runs standalone** — open spikes/iframe-lite/index.html with static server
- [x] **FEASIBILITY.md answers all questions** — works, limits, M2 rec, constraints, effort
- [x] **Pushed to lane/hardening** — 2 conventional commits pushed
- [x] **SSE check:** apps/daemon/src/engine/sse.ts exists on origin/main but
  brief says "you MAY also add tests" — skipped as optional, focused on required tasks
