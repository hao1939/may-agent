import { describe, it, expect } from "vitest";
import { filterContext } from "../shared/lib/context-filter.ts";

describe("filterContext (EXP-235)", () => {
  it("returns filtered context for bug-fix tasks", () => {
    const result = filterContext("coder", "Fix bug: calculator returns wrong output");
    expect(result.stats.reductionPct).toBeGreaterThanOrEqual(50);
    expect(result.skills).toContain("diagnosis-before-action.md");
  });

  it("returns filtered context for delete tasks", () => {
    const result = filterContext("coder", "Delete temporary files from data/");
    expect(result.stats.reductionPct).toBeGreaterThanOrEqual(50);
  });

  it("returns filtered context for review tasks", () => {
    const result = filterContext("coder", "Review PR: new API endpoint");
    expect(result.skills).toContain("second-look-verification.md");
  });

  it("returns empty for non-existent agent", () => {
    const result = filterContext("nonexistent-agent", "some task");
    expect(result.filteredContext).toBe("");
    expect(result.stats.originalLines).toBe(0);
  });

  it("always includes mandatory sections", () => {
    const result = filterContext("coder", "Fix a bug");
    // Filtered context should not be empty even for minimal tasks
    expect(result.filteredContext.length).toBeGreaterThan(0);
  });
});
