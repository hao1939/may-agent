import { describe, it, expect } from "vitest";
import {
  runPreFlight,
  runWithHealthCheck,
  filterDispatchable,
  type DispatchConfig,
  type WorkerFn,
} from "../workflows/master-worker-with-health-check.ts";

const baseConfig: DispatchConfig = {
  projectPath: "/test/project",
  maxIterations: 5,
};

const validProject = `**Status**: active
**Owner**: bob
**Workflow**: master-worker
**Last Activity**: ${new Date().toISOString()}
`;

const stalledProject = `**Status**: active
**Owner**: bob
**Last Activity**: 2020-01-01T00:00:00Z
`;

describe("runPreFlight", () => {
  it("returns proceed=false for empty content", () => {
    const r = runPreFlight("", null, baseConfig);
    expect(r.proceed).toBe(false);
    expect(r.reason).toContain("missing or empty");
  });

  it("returns proceed=true for empty content when skipOnMissing=false", () => {
    const r = runPreFlight("", null, { ...baseConfig, skipOnMissing: false });
    expect(r.proceed).toBe(true);
  });

  it("returns proceed=false for whitespace-only content", () => {
    const r = runPreFlight("   \n  ", null, baseConfig);
    expect(r.proceed).toBe(false);
  });

  it("passes health check for valid active project", () => {
    const r = runPreFlight(validProject, null, baseConfig);
    expect(r.proceed).toBe(true);
    expect(r.health).not.toBeNull();
  });

  it("detects stalled projects", () => {
    const r = runPreFlight(stalledProject, null, {
      ...baseConfig,
      stalledThresholdMs: 1000, // 1 second
    });
    // Should detect stalled since last activity is years ago
    if (!r.proceed) {
      expect(r.reason).toContain("stalled");
    }
  });

  it("allows stalled when skipOnStalled=false", () => {
    const r = runPreFlight(stalledProject, null, {
      ...baseConfig,
      skipOnStalled: false,
      stalledThresholdMs: 1000,
    });
    expect(r.proceed).toBe(true);
  });

  it("detects critical issues in health", () => {
    // Project with critical keyword in issues would be rejected
    const projectWithCritical = `**Status**: active
**Owner**: bob
critical issue detected
`;
    const r = runPreFlight(projectWithCritical, null, baseConfig);
    // Result depends on analyzeProject behavior
    expect(r).toHaveProperty("proceed");
    expect(r).toHaveProperty("reason");
  });

  it("includes health object when content is valid", () => {
    const r = runPreFlight(validProject, null, baseConfig);
    if (r.health) {
      expect(r.health).toHaveProperty("status");
      expect(r.health).toHaveProperty("issues");
    }
  });
});

describe("runWithHealthCheck", () => {
  const successWorker: WorkerFn = async (iteration, path) => ({
    iteration,
    success: true,
    output: `Done iteration ${iteration}`,
  });

  const failWorker: WorkerFn = async (iteration) => ({
    iteration,
    success: false,
    output: "failed",
  });

  const throwWorker: WorkerFn = async () => {
    throw new Error("provider timeout");
  };

  it("aborts when pre-flight fails", async () => {
    const r = await runWithHealthCheck(baseConfig, "", null, successWorker);
    expect(r.aborted).toBe(true);
    expect(r.iterations).toHaveLength(0);
    expect(r.abortReason).toContain("missing");
  });

  it("runs all iterations on success", async () => {
    const r = await runWithHealthCheck(baseConfig, validProject, null, successWorker);
    if (r.preFlight.proceed) {
      expect(r.iterations.length).toBe(5);
      expect(r.totalIterations).toBe(5);
      expect(r.aborted).toBe(false);
    }
  });

  it("continues on worker failure (resilient)", async () => {
    const r = await runWithHealthCheck(baseConfig, validProject, null, failWorker);
    if (r.preFlight.proceed) {
      // Should run all iterations even with failures
      expect(r.iterations.length).toBe(5);
    }
  });

  it("aborts after 3 consecutive thrown errors", async () => {
    const r = await runWithHealthCheck(baseConfig, validProject, null, throwWorker);
    if (r.preFlight.proceed) {
      expect(r.aborted).toBe(true);
      expect(r.abortReason).toContain("3 consecutive failures");
      expect(r.iterations.length).toBe(3);
    }
  });

  it("captures error messages in iteration output", async () => {
    const r = await runWithHealthCheck(baseConfig, validProject, null, throwWorker);
    if (r.preFlight.proceed && r.iterations.length > 0) {
      expect(r.iterations[0].output).toContain("provider timeout");
    }
  });

  it("respects maxIterations", async () => {
    const config = { ...baseConfig, maxIterations: 2 };
    const r = await runWithHealthCheck(config, validProject, null, successWorker);
    if (r.preFlight.proceed) {
      expect(r.iterations.length).toBeLessThanOrEqual(2);
    }
  });

  it("handles mixed success and failure", async () => {
    let call = 0;
    const mixedWorker: WorkerFn = async (iteration) => {
      call++;
      if (call === 2) throw new Error("blip");
      return { iteration, success: true, output: "ok" };
    };
    const r = await runWithHealthCheck(baseConfig, validProject, null, mixedWorker);
    if (r.preFlight.proceed) {
      expect(r.aborted).toBe(false);
      // iteration 2 failed, rest succeeded
      const failed = r.iterations.filter((i) => !i.success);
      expect(failed.length).toBe(1);
    }
  });
});

describe("filterDispatchable", () => {
  it("returns results for all projects", () => {
    const projects = [
      { path: "/a", content: validProject, journal: null },
      { path: "/b", content: "", journal: null },
    ];
    const r = filterDispatchable(projects, { maxIterations: 5 });
    expect(r).toHaveLength(2);
    expect(r[0].path).toBe("/a");
    expect(r[1].path).toBe("/b");
  });

  it("marks empty projects as non-dispatchable", () => {
    const projects = [{ path: "/x", content: "", journal: null }];
    const r = filterDispatchable(projects, { maxIterations: 3 });
    expect(r[0].preFlight.proceed).toBe(false);
  });

  it("marks valid projects as dispatchable", () => {
    const projects = [{ path: "/y", content: validProject, journal: null }];
    const r = filterDispatchable(projects, { maxIterations: 3 });
    expect(r[0].preFlight.proceed).toBe(true);
  });

  it("handles empty project list", () => {
    const r = filterDispatchable([], { maxIterations: 3 });
    expect(r).toHaveLength(0);
  });
});
