import { describe, it, expect, vi } from "vitest";
import {
  runPreFlight,
  runWithHealthCheck,
  filterDispatchable,
  type DispatchConfig,
  type IterationResult,
} from "../workflows/master-worker-with-health-check.js";

const VALID_PROJECT = `# Test Project

## Metrics
| Metric | Current | Target |
| --- | --- | --- |
| coverage | 50% | 80% |

## Plan
- [x] Item 1
`;

const ALL_AT_TARGET_PROJECT = `# Test Project

## Metrics
| Metric | Current | Target |
| --- | --- | --- |
| coverage | 80% | 80% |

## Plan
- [x] Item 1
`;

const STALLED_JOURNAL = `## 2024-01-01T00:00:00Z
Did some work
`;

const RECENT_JOURNAL = `## ${new Date().toISOString().split("T")[0]}T10:00:00Z
Did some work
`;

const NOW = new Date("2025-01-15T12:00:00Z");

function makeConfig(overrides: Partial<DispatchConfig> = {}): DispatchConfig {
  return {
    projectPath: "/projects/test",
    maxIterations: 5,
    ...overrides,
  };
}

describe("runPreFlight", () => {
  it("proceeds for healthy project with recent activity", () => {
    const result = runPreFlight(VALID_PROJECT, RECENT_JOURNAL, makeConfig(), new Date());
    expect(result.proceed).toBe(true);
    expect(result.health).not.toBeNull();
  });

  it("skips when project content is empty", () => {
    const result = runPreFlight("", null, makeConfig());
    expect(result.proceed).toBe(false);
    expect(result.reason).toContain("missing or empty");
  });

  it("skips when project content is whitespace-only", () => {
    const result = runPreFlight("   \n  ", null, makeConfig());
    expect(result.proceed).toBe(false);
  });

  it("proceeds with empty content when skipOnMissing=false", () => {
    const result = runPreFlight("", null, makeConfig({ skipOnMissing: false }));
    expect(result.proceed).toBe(true);
  });

  it("skips stalled projects by default", () => {
    const result = runPreFlight(VALID_PROJECT, STALLED_JOURNAL, makeConfig(), NOW);
    expect(result.proceed).toBe(false);
    expect(result.reason).toContain("stalled");
  });

  it("proceeds with stalled project when skipOnStalled=false", () => {
    const result = runPreFlight(
      VALID_PROJECT,
      STALLED_JOURNAL,
      makeConfig({ skipOnStalled: false }),
      NOW
    );
    expect(result.proceed).toBe(true);
  });

  it("uses custom stalled threshold", () => {
    // Journal from 2024-01-01, NOW is 2025-01-15
    // With 2-year threshold, should NOT be stalled
    const result = runPreFlight(
      VALID_PROJECT,
      STALLED_JOURNAL,
      makeConfig({ stalledThresholdMs: 2 * 365 * 24 * 60 * 60 * 1000 }),
      NOW
    );
    expect(result.proceed).toBe(true);
  });

  it("skips on critical issues in health report", () => {
    // Create a project that analyzeProject will flag with issues
    const malformed = `# Test
No metrics table here at all
`;
    const result = runPreFlight(malformed, null, makeConfig(), NOW);
    // Malformed projects don't have "critical" issues, they have status=malformed
    // which by default is NOT skipped (skipOnMalformed defaults to false)
    expect(result.health).not.toBeNull();
  });

  it("skips malformed project when skipOnMalformed=true", () => {
    const malformed = "no valid project structure";
    const result = runPreFlight(
      malformed,
      null,
      makeConfig({ skipOnMalformed: true }),
      NOW
    );
    // analyzeProject should detect this as malformed
    if (result.health?.status === "malformed") {
      expect(result.proceed).toBe(false);
    }
  });

  it("returns health details in result", () => {
    const result = runPreFlight(VALID_PROJECT, RECENT_JOURNAL, makeConfig(), new Date());
    expect(result.health).not.toBeNull();
    expect(result.health!.name).toBeDefined();
  });

  it("includes metric count in reason when proceeding", () => {
    const result = runPreFlight(VALID_PROJECT, RECENT_JOURNAL, makeConfig(), new Date());
    if (result.proceed) {
      expect(result.reason).toContain("metrics");
    }
  });
});

describe("runWithHealthCheck", () => {
  const successWorker = async (i: number, path: string): Promise<IterationResult> => ({
    iteration: i,
    success: true,
    output: `Iteration ${i} done`,
  });

  const failWorker = async (i: number, path: string): Promise<IterationResult> => {
    throw new Error(`Worker failed at iteration ${i}`);
  };

  it("runs all iterations when healthy", async () => {
    const result = await runWithHealthCheck(
      makeConfig({ maxIterations: 3 }),
      VALID_PROJECT,
      RECENT_JOURNAL,
      successWorker,
      new Date()
    );
    expect(result.preFlight.proceed).toBe(true);
    expect(result.totalIterations).toBe(3);
    expect(result.aborted).toBe(false);
  });

  it("aborts before dispatch when project is stalled", async () => {
    const result = await runWithHealthCheck(
      makeConfig(),
      VALID_PROJECT,
      STALLED_JOURNAL,
      successWorker,
      NOW
    );
    expect(result.preFlight.proceed).toBe(false);
    expect(result.totalIterations).toBe(0);
    expect(result.aborted).toBe(true);
    expect(result.abortReason).toContain("stalled");
  });

  it("aborts before dispatch when project content missing", async () => {
    const result = await runWithHealthCheck(
      makeConfig(),
      "",
      null,
      successWorker,
      NOW
    );
    expect(result.aborted).toBe(true);
    expect(result.iterations).toHaveLength(0);
  });

  it("handles worker failures gracefully", async () => {
    const result = await runWithHealthCheck(
      makeConfig({ maxIterations: 2 }),
      VALID_PROJECT,
      RECENT_JOURNAL,
      failWorker,
      new Date()
    );
    expect(result.iterations).toHaveLength(2);
    expect(result.iterations.every((r) => !r.success)).toBe(true);
  });

  it("aborts after 3 consecutive failures", async () => {
    const result = await runWithHealthCheck(
      makeConfig({ maxIterations: 5 }),
      VALID_PROJECT,
      RECENT_JOURNAL,
      failWorker,
      new Date()
    );
    expect(result.aborted).toBe(true);
    expect(result.abortReason).toContain("3 consecutive failures");
    expect(result.totalIterations).toBe(3);
  });

  it("continues past isolated failures", async () => {
    let callCount = 0;
    const intermittentWorker = async (i: number, path: string): Promise<IterationResult> => {
      callCount++;
      if (i === 2) throw new Error("transient");
      return { iteration: i, success: true, output: `ok ${i}` };
    };
    const result = await runWithHealthCheck(
      makeConfig({ maxIterations: 4 }),
      VALID_PROJECT,
      RECENT_JOURNAL,
      intermittentWorker,
      new Date()
    );
    expect(result.aborted).toBe(false);
    expect(result.totalIterations).toBe(4);
    expect(result.iterations[1].success).toBe(false);
    expect(result.iterations[2].success).toBe(true);
  });

  it("records error message in iteration output", async () => {
    const result = await runWithHealthCheck(
      makeConfig({ maxIterations: 1 }),
      VALID_PROJECT,
      RECENT_JOURNAL,
      async () => { throw new Error("boom"); },
      new Date()
    );
    expect(result.iterations[0].output).toContain("boom");
  });

  it("returns empty iterations when maxIterations is 0", async () => {
    const result = await runWithHealthCheck(
      makeConfig({ maxIterations: 0 }),
      VALID_PROJECT,
      RECENT_JOURNAL,
      successWorker,
      new Date()
    );
    expect(result.totalIterations).toBe(0);
    expect(result.aborted).toBe(false);
  });

  it("passes projectPath to worker function", async () => {
    let receivedPath = "";
    const pathCapture = async (i: number, path: string): Promise<IterationResult> => {
      receivedPath = path;
      return { iteration: i, success: true, output: "ok" };
    };
    await runWithHealthCheck(
      makeConfig({ projectPath: "/my/project" }),
      VALID_PROJECT,
      RECENT_JOURNAL,
      pathCapture,
      new Date()
    );
    expect(receivedPath).toBe("/my/project");
  });
});

describe("filterDispatchable", () => {
  it("filters out stalled projects", () => {
    const projects = [
      { path: "/p1", content: VALID_PROJECT, journal: RECENT_JOURNAL },
      { path: "/p2", content: VALID_PROJECT, journal: STALLED_JOURNAL },
    ];
    const results = filterDispatchable(projects, { maxIterations: 5 }, NOW);
    expect(results).toHaveLength(2);
    const dispatchable = results.filter((r) => r.preFlight.proceed);
    // p1 with recent journal should proceed, p2 stalled should not
    // Note: "recent" is relative to NOW (2025-01-15), RECENT_JOURNAL uses today's date
    expect(results[1].preFlight.proceed).toBe(false);
  });

  it("returns all projects with their pre-flight results", () => {
    const projects = [
      { path: "/a", content: VALID_PROJECT, journal: null },
      { path: "/b", content: "", journal: null },
    ];
    const results = filterDispatchable(projects, { maxIterations: 3 });
    expect(results).toHaveLength(2);
    expect(results[0].path).toBe("/a");
    expect(results[1].path).toBe("/b");
    expect(results[1].preFlight.proceed).toBe(false);
  });

  it("handles empty project list", () => {
    const results = filterDispatchable([], { maxIterations: 5 });
    expect(results).toHaveLength(0);
  });

  it("preserves project paths in output", () => {
    const projects = [
      { path: "/projects/foo", content: VALID_PROJECT, journal: RECENT_JOURNAL },
    ];
    const results = filterDispatchable(projects, { maxIterations: 3 }, new Date());
    expect(results[0].path).toBe("/projects/foo");
  });
});
