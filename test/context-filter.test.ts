import { describe, it, expect } from "vitest";
import { filterContext, loadSkills } from "../shared/lib/context-filter.ts";

describe("filterContext (EXP-235)", () => {
  it("returns filtered context for bug-fix tasks", () => {
    const result = filterContext("tech-lead", "Fix bug: workflow returns wrong output");
    expect(result.stats.reductionPct).toBeGreaterThanOrEqual(20);
    expect(result.filteredContext).toContain("WHEN MAKING CODE CHANGES");
    expect(result.skills).toContain("verify-after-edit.md");
  });

  it("returns filtered context for delete tasks", () => {
    const result = filterContext("tech-lead", "Delete temporary files from data/");
    expect(result.stats.reductionPct).toBeGreaterThanOrEqual(20);
    expect(result.filteredContext).toContain("SESSION START");
  });

  it("returns filtered context for review tasks", () => {
    const result = filterContext("tech-lead", "Review PR: new API endpoint");
    expect(result.filteredContext).toContain("BEFORE FINISH");
  });

  it("returns empty for non-existent agent", () => {
    const result = filterContext("nonexistent-agent", "some task");
    expect(result.filteredContext).toBe("");
    expect(result.stats.originalLines).toBe(0);
  });

  it("always includes mandatory sections", () => {
    const result = filterContext("tech-lead", "Fix a bug");
    expect(result.filteredContext.length).toBeGreaterThan(0);
  });

  it("loads skills from the current agents directory", () => {
    const skills = loadSkills("tech-lead", ["verify-after-edit.md"]);
    expect(skills).toHaveLength(1);
    expect(skills[0]).toContain("Verify After Edit");
  });
});
