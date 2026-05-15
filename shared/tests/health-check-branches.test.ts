import { describe, it, expect } from "bun:test";

// Import the health check functions
const healthModule = await import("../workflows/health-check.ts");
const { analyzeProject, checkHealth } = healthModule;

describe("health-check uncovered branches", () => {
  // Lines 195-206: status determination branches
  
  it("returns 'stalled' when stalled and not all metrics at target", () => {
    const projectContent = `# Project
## Metrics
| Metric | Current | Target | Met |
|--------|---------|--------|-----|
| Coverage | 50% | 80% | ❌ |
`;
    // Use a very old date so it's definitely stalled
    const journalContent = `## 2020-01-01
- Did something
`;
    const now = new Date("2025-01-01");
    const result = analyzeProject("test", projectContent, journalContent, now, 24 * 60 * 60 * 1000);
    expect(result.status).toBe("stalled");
  });

  it("returns 'healthy' when all metrics at target", () => {
    const projectContent = `# Project
## Metrics
| Metric | Current | Target | Met |
|--------|---------|--------|-----|
| Coverage | 80% | 80% | ✅ |
`;
    const journalContent = `## ${new Date().toISOString().split("T")[0]}
- Active work
`;
    const result = analyzeProject("test", projectContent, journalContent, new Date());
    expect(result.status).toBe("healthy");
  });

  it("returns 'healthy' when metrics exist, not all at target, not stalled", () => {
    const projectContent = `# Project
## Metrics
| Metric | Current | Target | Met |
|--------|---------|--------|-----|
| Coverage | 50% | 80% | ❌ |
`;
    const now = new Date();
    const journalContent = `## ${now.toISOString().split("T")[0]}
- Active work
`;
    const result = analyzeProject("test", projectContent, journalContent, now, 24 * 60 * 60 * 1000);
    expect(result.status).toBe("healthy");
  });

  it("returns 'malformed' when no metrics found", () => {
    const projectContent = `# Project
No metrics here.
`;
    const result = analyzeProject("test", projectContent, null, new Date());
    expect(result.status).toBe("malformed");
    expect(result.issues).toContain("No metrics found in project.md");
  });

  it("checkHealth aggregates multiple projects", () => {
    const projects = [
      { name: "a", projectContent: "# A\nNo metrics", journalContent: null },
      { name: "b", projectContent: "# B\nNo metrics", journalContent: null },
    ];
    const report = checkHealth(projects);
    expect(report.projects).toHaveLength(2);
  });

  it("handles null projectContent", () => {
    const result = analyzeProject("test", null, null, new Date());
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("stalled with no activity timestamps", () => {
    const projectContent = `# Project
## Metrics
| Metric | Current | Target | Met |
|--------|---------|--------|-----|
| Coverage | 50% | 80% | ❌ |
`;
    const result = analyzeProject("test", projectContent, "", new Date(), 1); // 1ms threshold
    expect(result.status).toBe("stalled");
  });
});
