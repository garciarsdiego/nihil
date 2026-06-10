import { describe, expect, it } from "vitest";
import { actionSummary, countLines, isCompactAction } from "./action-summary.js";

describe("action-summary", () => {
  it("counts lines in streamed content", () => {
    expect(countLines("a\nb\nc")).toBe(3);
    expect(countLines("")).toBe(0);
  });

  it("summarizes write actions with line count", () => {
    const summary = actionSummary(
      { kind: "write", path: "src/App.tsx", content: "line1\nline2\n" },
      "",
    );
    expect(summary).toContain("src/App.tsx");
    expect(summary).toContain("+3 lines");
  });

  it("marks compact action kinds", () => {
    expect(isCompactAction({ kind: "rename", from: "a", to: "b" })).toBe(true);
    expect(isCompactAction({ kind: "write", path: "x", content: "" })).toBe(false);
  });
});
