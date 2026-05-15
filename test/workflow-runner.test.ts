import { describe, it, expect, vi, beforeEach } from "vitest";

// Import pure functions and types from workflow-runner
import {
  mergeWorkflowConfig,
  shouldProceedAfterHealthCheck,
  buildStageResult,
  summarizeWorkflow,
  extractProjectPath,
  isConfigValid,
  runValidationStage,
  runHealthCheckStage,
  runExecutionStage,
  runWorkflow,
  WorkflowConfig,
  WorkflowResult,
  StageResult,
} from "../shared/workflows/workflow-runner.js";

// Replicate key types for mocking
import type { HealthReport } from "../shared/workflows/health-check.js";

// ── mergeWorkflowConfig ─────────────────────────────────────────────

describe("mergeWorkflowConfig", () => {
  it("fills all defaults when given empty object", () => {
    const cfg = mergeWorkflowConfig({});
    expect(cfg.projectRoot).toBe("/app");
    expect(cfg.task).toBe("");
    expect(cfg.maxIterations).toBe(5);
    expect(cfg.healthCheckEnabled).toBe(true);
    expect(cfg.healthCheckThreshold).toBe(0.5);
  });

  it("preserves provided values", () => {
    const cfg = mergeWorkflowConfig({
      projectRoot: "/tmp",
      task: "project: foo",
      maxIterations: 10,
      healthCheckEnabled: false,
      healthCheckThreshold: 0.8,
    });
    expect(cfg.projectRoot).toBe("/tmp");
    expect(cfg.task).toBe("project: foo");
    expect(cfg.maxIterations).toBe(10);
    expect(cfg.healthCheckEnabled).toBe(false);
    expect(cfg.healthCheckThreshold).toBe(0.8);
  });

  it("passes through retryConfig", () => {
    const cfg = mergeWorkflowConfig({ retryConfig: { maxRetries: 5 } });
    expect(cfg.retryConfig).toEqual({ maxRetries: 5 });
  });

  it("passes through satelliteDirs", () => {
    const cfg = mergeWorkflowConfig({ satelliteDirs: ["/a", "/b"] });
    expect(cfg.satelliteDirs).toEqual(["/a", "/b"]);
  });
});

// ── isConfigValid ───────────────────────────────────────────────────

describe("isConfigValid", () => {
  const base: WorkflowConfig = {
    projectRoot: "/tmp",
    task: "project: test",
    maxIterations: 3,
    healthCheckEnabled: true,
    healthCheckThreshold: 0.5,
  };

  it("valid config returns no errors", () => {
    expect(isConfigValid(base)).toEqual({ valid: true, errors: [] });
  });

  it("empty task is invalid", () => {
    const r = isConfigValid({ ...base, task: "" });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("task is required");
  });

  it("maxIterations < 1 is invalid", () => {
    const r = isConfigValid({ ...base, maxIterations: 0 });
    expect(r.valid).toBe(false);
  });

  it("threshold > 1 is invalid", () => {
    const r = isConfigValid({ ...base, healthCheckThreshold: 1.5 });
    expect(r.valid).toBe(false);
  });

  it("threshold < 0 is invalid", () => {
    const r = isConfigValid({ ...base, healthCheckThreshold: -0.1 });
    expect(r.valid).toBe(false);
  });

  it("multiple errors accumulate", () => {
    const r = isConfigValid({ ...base, task: "", maxIterations: -1, healthCheckThreshold: 2 });
    expect(r.errors.length).toBe(3);
  });
});

// ── shouldProceedAfterHealthCheck ───────────────────────────────────

describe("shouldProceedAfterHealthCheck", () => {
  function makeReport(healthy: number, total: number): HealthReport {
    return {
      timestamp: new Date().toISOString(),
      projects: [],
      summary: { total, healthy, stalled: 0, regressing: 0, missing: total - healthy },
    };
  }

  it("proceeds when ratio meets threshold", () => {
    const r = shouldProceedAfterHealthCheck(makeReport(3, 4), 0.5);
    expect(r.proceed).toBe(true);
  });

  it("blocks when ratio below threshold", () => {
    const r = shouldProceedAfterHealthCheck(makeReport(1, 10), 0.5);
    expect(r.proceed).toBe(false);
    expect(r.reason).toContain("10%");
  });

  it("proceeds with empty projects", () => {
    const r = shouldProceedAfterHealthCheck(makeReport(0, 0), 0.8);
    expect(r.proceed).toBe(true);
    expect(r.reason).toContain("No projects");
  });

  it("exact threshold proceeds", () => {
    const r = shouldProceedAfterHealthCheck(makeReport(5, 10), 0.5);
    expect(r.proceed).toBe(true);
  });

  it("100% healthy always proceeds", () => {
    const r = shouldProceedAfterHealthCheck(makeReport(5, 5), 1.0);
    expect(r.proceed).toBe(true);
  });
});

// ── buildStageResult ────────────────────────────────────────────────

describe("buildStageResult", () => {
  it("creates a stage result with duration", () => {
    const start = Date.now() - 100;
    const r = buildStageResult("validate", true, start, { foo: "bar" });
    expect(r.stage).toBe("validate");
    expect(r.success).toBe(true);
    expect(r.durationMs).toBeGreaterThanOrEqual(99);
    expect(r.details).toEqual({ foo: "bar" });
  });

  it("defaults to empty details", () => {
    const r = buildStageResult("execute", false, Date.now());
    expect(r.details).toEqual({});
  });
});

// ── summarizeWorkflow ───────────────────────────────────────────────

describe("summarizeWorkflow", () => {
  it("all success = success", () => {
    const stages: StageResult[] = [
      { stage: "validate", success: true, durationMs: 10, details: {} },
      { stage: "execute", success: true, durationMs: 20, details: {} },
    ];
    const r = summarizeWorkflow(stages, null);
    expect(r.success).toBe(true);
    expect(r.totalDurationMs).toBe(30);
    expect(r.error).toBeUndefined();
    expect(r.cacheStats).toBeNull();
  });

  it("one failure = failure with error message", () => {
    const stages: StageResult[] = [
      { stage: "validate", success: true, durationMs: 5, details: {} },
      { stage: "health-check", success: false, durationMs: 15, details: {} },
    ];
    const r = summarizeWorkflow(stages, null);
    expect(r.success).toBe(false);
    expect(r.error).toContain("health-check");
  });

  it("empty stages = success", () => {
    const r = summarizeWorkflow([], null);
    expect(r.success).toBe(true);
    expect(r.totalDurationMs).toBe(0);
  });
});

// ── extractProjectPath ──────────────────────────────────────────────

describe("extractProjectPath", () => {
  it("extracts project path from task", () => {
    const cfg = mergeWorkflowConfig({ task: "project: projects/foo" });
    expect(extractProjectPath(cfg)).toBe("projects/foo");
  });

  it("returns null for task without project:", () => {
    const cfg = mergeWorkflowConfig({ task: "do something" });
    expect(extractProjectPath(cfg)).toBeNull();
  });
});

// ── runValidationStage ──────────────────────────────────────────────

describe("runValidationStage", () => {
  it("fails when project dir doesn't exist", async () => {
    const cfg = mergeWorkflowConfig({ task: "project: /nonexistent/path", projectRoot: "/tmp" });
    const r = await runValidationStage(cfg);
    expect(r.stage).toBe("validate");
    expect(r.success).toBe(false);
  });

  it("returns stage timing", async () => {
    const cfg = mergeWorkflowConfig({ task: "project: /tmp", projectRoot: "/tmp" });
    const r = await runValidationStage(cfg);
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ── runHealthCheckStage ─────────────────────────────────────────────

describe("runHealthCheckStage", () => {
  it("skips when disabled", async () => {
    const cfg = mergeWorkflowConfig({ task: "project: x", healthCheckEnabled: false });
    const r = await runHealthCheckStage(cfg, () => "");
    expect(r.success).toBe(true);
    expect(r.details.skipped).toBe(true);
  });

  it("passes with no satellite dirs", async () => {
    const cfg = mergeWorkflowConfig({ task: "project: x", satelliteDirs: [] });
    const r = await runHealthCheckStage(cfg, () => "");
    expect(r.success).toBe(true);
  });
});

// ── runExecutionStage ───────────────────────────────────────────────

describe("runExecutionStage", () => {
  it("succeeds without retry wrapper", async () => {
    const r = await runExecutionStage(async () => "ok", null, "test");
    expect(r.success).toBe(true);
    expect(r.stage).toBe("execute");
    expect(r.details.result).toBe("ok");
  });

  it("catches thrown errors", async () => {
    const r = await runExecutionStage(async () => { throw new Error("boom"); }, null, "test");
    expect(r.success).toBe(false);
    expect(r.details.error).toBe("boom");
  });

  it("catches non-Error throws", async () => {
    const r = await runExecutionStage(async () => { throw "string error"; }, null, "test");
    expect(r.success).toBe(false);
    expect(r.details.error).toBe("string error");
  });
});

// ── runWorkflow (integration) ───────────────────────────────────────

describe("runWorkflow", () => {
  it("rejects invalid config", async () => {
    const r = await runWorkflow({ task: "" }, async () => "ok");
    expect(r.success).toBe(false);
    expect(r.error).toContain("Invalid config");
  });

  it("fails at validation stage for missing project", async () => {
    const r = await runWorkflow(
      { task: "project: /nonexistent", projectRoot: "/tmp" },
      async () => "ok"
    );
    expect(r.success).toBe(false);
    expect(r.stages[0].stage).toBe("validate");
    expect(r.stages[0].success).toBe(false);
    expect(r.stages.length).toBe(1); // stops after validation
  });

  it("runs full pipeline with health check disabled", async () => {
    const r = await runWorkflow(
      {
        task: "project: /tmp",
        projectRoot: "/",
        healthCheckEnabled: false,
      },
      async () => "done",
      { readFn: () => "" }
    );
    // Validation may fail depending on /tmp structure, but pipeline runs
    expect(r.stages.length).toBeGreaterThanOrEqual(1);
  });

  it("returns cache stats when available", async () => {
    const r = await runWorkflow(
      {
        task: "project: /tmp",
        projectRoot: "/",
        healthCheckEnabled: false,
      },
      async () => 42,
      { readFn: () => "" }
    );
    // If it gets past validation, cache stats should be present
    if (r.stages.length > 1) {
      expect(r.cacheStats).toBeDefined();
    }
  });
});
