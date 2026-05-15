import { describe, it, expect } from "bun:test";

const { analyzeProject } = await import("../workflows/health-check.ts");

describe("health-check analyzeProject status branches", () => {
  const now = new Date("2025-01-20T12:00:00Z");

  it("returns malformed when no metrics found", () => {
    const result = analyzeProject("test", "# Project\nJust text, no metrics table.", null, now);
    expect(result.status).toBe("malformed");
    expect(result.issues).toContain("No metrics found in project.md");
  });

  it("returns healthy when all metrics at target", () => {
    const content = `# Project
## Metrics
| Metric | Current | Target | Met? |
|--------|---------|--------|------|
| Coverage | 90% | 80% | ✅ |
| Tests | 100 | 50 | ✅ |
`;
    const journal = `- 2025-01-20: Made progress`;
    const result = analyzeProject("test", content, journal, now);
    expect(result.status).toBe("healthy");
  });

  it("returns stalled when metrics not at target and stalled", () => {
    const content = `# Project
## Metrics
| Metric | Current | Target | Met? |
|--------|---------|--------|------|
| Coverage | 10% | 80% | ❌ |
`;
    // Very old activity - stalled
    const journal = `- 2024-01-01: Last activity`;
    const result = analyzeProject("test", content, journal, now, 24 * 60 * 60 * 1000);
    expect(result.status).toBe("stalled");
  });

  it("returns healthy when not all at target but not stalled", () => {
    const content = `# Project
## Metrics
| Metric | Current | Target | Met? |
|--------|---------|--------|------|
| Coverage | 50% | 80% | ❌ |
| Tests | 100 | 50 | ✅ |
`;
    const journal = `- 2025-01-20: Active today`;
    const result = analyzeProject("test", content, journal, now);
    expect(result.status).toBe("healthy");
  });

  it("returns missing when projectContent is null", () => {
    const result = analyzeProject("test", null, null, now);
    expect(result.status).toBe("missing");
  });

  it("returns malformed when projectContent is empty", () => {
    const result = analyzeProject("test", "", null, now);
    expect(result.status).toBe("malformed");
  });

  it("handles the else branch (all at target + stalled = healthy)", () => {
    // This hits the final else: totalMetrics > 0, metricsAtTarget === totalMetrics, stalled
    const content = `# Project
## Metrics
| Metric | Current | Target | Met? |
|--------|---------|--------|------|
| Coverage | 90% | 80% | ✅ |
`;
    // Old activity - stalled, but all metrics met
    const journal = `- 2024-01-01: Last activity`;
    const result = analyzeProject("test", content, journal, now, 24 * 60 * 60 * 1000);
    expect(result.status).toBe("healthy");
  });
});
