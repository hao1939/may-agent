import { describe, it, expect } from "vitest";
import {
  parseMetrics,
  isAtTarget,
  extractLastActivity,
  isStalled,
  analyzeProject,
  checkHealth,
} from "../workflows/health-check.js";

describe("isAtTarget", () => {
  it("matches exact strings", () => {
    expect(isAtTarget("done", "done")).toBe(true);
  });
  it("returns false for mismatched strings", () => {
    expect(isAtTarget("pending", "done")).toBe(false);
  });
  it("handles fraction format — at target", () => {
    expect(isAtTarget("3/5", "3/5")).toBe(true);
  });
  it("handles fraction format — above target", () => {
    expect(isAtTarget("4/5", "3/5")).toBe(true);
  });
  it("handles fraction format — below target", () => {
    expect(isAtTarget("2/5", "3/5")).toBe(false);
  });
  it("handles percentage — at target", () => {
    expect(isAtTarget("80%", "80%")).toBe(true);
  });
  it("handles percentage — above target", () => {
    expect(isAtTarget("90%", "80%")).toBe(true);
  });
  it("handles percentage — below target", () => {
    expect(isAtTarget("70%", "80%")).toBe(false);
  });
  it("handles ≥ target format", () => {
    expect(isAtTarget("15", "≥10")).toBe(true);
    expect(isAtTarget("5", "≥10")).toBe(false);
  });
  it("handles >= target format", () => {
    expect(isAtTarget("20", ">=15")).toBe(true);
  });
  it("handles plain numeric comparison", () => {
    expect(isAtTarget("100", "50")).toBe(true);
    expect(isAtTarget("30", "50")).toBe(false);
  });
  it("returns false for empty values", () => {
    expect(isAtTarget("", "done")).toBe(false);
    expect(isAtTarget("done", "")).toBe(false);
  });
});

describe("parseMetrics", () => {
  it("parses a standard metrics table", () => {
    const content = `
| Metric | Current | Target |
| --- | --- | --- |
| test-coverage | 85% | 80% |
| satellite-progress | 2/2 | 2/2 |
`;
    const metrics = parseMetrics(content);
    expect(metrics).toHaveLength(2);
    expect(metrics[0].name).toBe("test-coverage");
    expect(metrics[0].current).toBe("85%");
    expect(metrics[0].target).toBe("80%");
    expect(metrics[0].atTarget).toBe(true);
    expect(metrics[1].name).toBe("satellite-progress");
    expect(metrics[1].atTarget).toBe(true);
  });

  it("returns empty array for content with no table", () => {
    expect(parseMetrics("# Project\nJust some text")).toEqual([]);
  });

  it("skips header and separator rows", () => {
    const content = `| Metric | Current | Target |\n| --- | --- | --- |\n| speed | 10 | 5 |`;
    const metrics = parseMetrics(content);
    expect(metrics).toHaveLength(1);
    expect(metrics[0].name).toBe("speed");
  });

  it("handles metrics not at target", () => {
    const content = `| Metric | Current | Target |\n| --- | --- | --- |\n| coverage | 40% | 80% |`;
    const metrics = parseMetrics(content);
    expect(metrics[0].atTarget).toBe(false);
  });
});

describe("extractLastActivity", () => {
  it("finds ISO timestamp", () => {
    const journal = `## Iteration 5\n2025-01-15T10:30:00Z\nDid some work`;
    expect(extractLastActivity(journal)).toBe("2025-01-15T10:30:00Z");
  });

  it("finds the latest of multiple timestamps", () => {
    const journal = `2025-01-10T08:00:00Z\n2025-01-15T10:30:00Z\n2025-01-12T05:00:00Z`;
    expect(extractLastActivity(journal)).toBe("2025-01-15T10:30:00Z");
  });

  it("returns null for empty content", () => {
    expect(extractLastActivity("")).toBeNull();
    expect(extractLastActivity("   ")).toBeNull();
  });

  it("returns null for content with no dates", () => {
    expect(extractLastActivity("just some text without dates")).toBeNull();
  });

  it("finds date-only format", () => {
    const journal = `## Entry\n2025-06-20\nSomething happened`;
    expect(extractLastActivity(journal)).toBe("2025-06-20");
  });
});

describe("isStalled", () => {
  const now = new Date("2025-01-20T12:00:00Z");

  it("returns true when no activity", () => {
    expect(isStalled(null, now)).toBe(true);
  });

  it("returns true when activity is older than threshold", () => {
    expect(isStalled("2025-01-18T12:00:00Z", now)).toBe(true); // 48h ago
  });

  it("returns false when activity is within threshold", () => {
    expect(isStalled("2025-01-20T06:00:00Z", now)).toBe(false); // 6h ago
  });

  it("returns true for invalid date string", () => {
    expect(isStalled("not-a-date", now)).toBe(true);
  });

  it("respects custom threshold", () => {
    const oneHour = 60 * 60 * 1000;
    expect(isStalled("2025-01-20T10:00:00Z", now, oneHour)).toBe(true); // 2h ago, 1h threshold
    expect(isStalled("2025-01-20T11:30:00Z", now, oneHour)).toBe(false); // 30min ago
  });
});

describe("analyzeProject", () => {
  const now = new Date("2025-01-20T12:00:00Z");

  it("returns 'missing' for null project content", () => {
    const result = analyzeProject("test-proj", null, null, now);
    expect(result.status).toBe("missing");
    expect(result.issues).toContain("project.md not found");
  });

  it("returns 'malformed' for empty project content", () => {
    const result = analyzeProject("test-proj", "", null, now);
    expect(result.status).toBe("malformed");
    expect(result.issues).toContain("project.md is empty");
  });

  it("returns 'malformed' for content with no metrics", () => {
    const result = analyzeProject("test-proj", "# Project\nNo metrics here", "2025-01-20T11:00:00Z\n", now);
    expect(result.status).toBe("malformed");
  });

  it("returns 'healthy' when all metrics at target and recent activity", () => {
    const project = `| Metric | Current | Target |\n| --- | --- | --- |\n| score | 90% | 80% |`;
    const journal = `2025-01-20T11:00:00Z did stuff`;
    const result = analyzeProject("good-proj", project, journal, now);
    expect(result.status).toBe("healthy");
    expect(result.metrics).toHaveLength(1);
    expect(result.issues).toHaveLength(0);
  });

  it("returns 'stalled' when metrics not at target and no recent activity", () => {
    const project = `| Metric | Current | Target |\n| --- | --- | --- |\n| score | 30% | 80% |`;
    const journal = `2025-01-15T11:00:00Z old stuff`;
    const result = analyzeProject("stalled-proj", project, journal, now);
    expect(result.status).toBe("stalled");
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("returns 'healthy' when metrics not at target but recently active", () => {
    const project = `| Metric | Current | Target |\n| --- | --- | --- |\n| score | 30% | 80% |`;
    const journal = `2025-01-20T11:00:00Z working on it`;
    const result = analyzeProject("active-proj", project, journal, now);
    expect(result.status).toBe("healthy");
  });
});

describe("checkHealth", () => {
  const now = new Date("2025-01-20T12:00:00Z");

  it("returns a complete health report", () => {
    const projects = [
      { name: "proj-a", projectContent: `| Metric | Current | Target |\n| --- | --- | --- |\n| x | 10 | 5 |`, journalContent: `2025-01-20T11:00:00Z` },
      { name: "proj-b", projectContent: null, journalContent: null },
    ];
    const report = checkHealth(projects, now);
    expect(report.projects).toHaveLength(2);
    expect(report.summary.total).toBe(2);
    expect(report.summary.healthy).toBe(1);
    expect(report.summary.missing).toBe(1);
    expect(report.timestamp).toBe(now.toISOString());
  });

  it("handles empty project list", () => {
    const report = checkHealth([], now);
    expect(report.projects).toHaveLength(0);
    expect(report.summary.total).toBe(0);
  });

  it("correctly tallies all status types", () => {
    const projects = [
      { name: "healthy", projectContent: `| Metric | Current | Target |\n| --- | --- | --- |\n| x | 10 | 5 |`, journalContent: `2025-01-20T11:00:00Z` },
      { name: "missing", projectContent: null, journalContent: null },
      { name: "empty", projectContent: "", journalContent: null },
      { name: "stalled", projectContent: `| Metric | Current | Target |\n| --- | --- | --- |\n| x | 1 | 5 |`, journalContent: `2025-01-10T11:00:00Z` },
    ];
    const report = checkHealth(projects, now);
    expect(report.summary.healthy).toBe(1);
    expect(report.summary.missing).toBe(1);
    expect(report.summary.malformed).toBe(1);
    expect(report.summary.stalled).toBe(1);
  });

  it("passes custom stall threshold through", () => {
    const projects = [
      { name: "recent", projectContent: `| Metric | Current | Target |\n| --- | --- | --- |\n| x | 1 | 5 |`, journalContent: `2025-01-20T11:50:00Z` },
    ];
    // 5 minute threshold — 10 min ago should be stalled
    const report = checkHealth(projects, now, 5 * 60 * 1000);
    expect(report.projects[0].status).toBe("stalled");
  });
});
