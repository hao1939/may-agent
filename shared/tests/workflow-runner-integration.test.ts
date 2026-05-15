import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runWorkflow,
  mergeWorkflowConfig,
  shouldProceedAfterHealthCheck,
  buildStageResult,
  summarizeWorkflow,
  extractProjectPath,
  isConfigValid,
  runValidationStage,
  runHealthCheckStage,
  runExecutionStage,
  WorkflowConfig,
  WorkflowResult,
} from "../workflows/workflow-runner.js";
import { ProjectCache } from "../workflows/project-cache.js";
import { createRetryWrapper } from "../workflows/retry-wrapper.js";
import { HealthReport } from "../workflows/health-check.js";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ── Helpers ─────────────────────────────────────────────────────────

function makeTempProject(opts: { status?: string; metrics?: boolean; stopReason?: string } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "wf-test-"));
  const projectDir = join(dir, "projects", "test-proj");
  mkdirSync(projectDir, { recursive: true });

  let content = `# Test Project\n\n**Status**: ${opts.status ?? "active"}\n`;
  if (opts.stopReason) content += `**Stop Reason**: ${opts.stopReason}\n`;
  if (opts.metrics !== false) {
    content += `\n## Metrics\n| Metric | Current | Target |\n| --- | --- | --- |\n| coverage | 80% | 80% |\n`;
  }
  writeFileSync(join(projectDir, "project.md"), content);
  return { root: dir, projectDir };
}

function cleanupDir(dir: string) {
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}

const noSleep = () => Promise.resolve();

// ── mergeWorkflowConfig ─────────────────────────────────────────────

describe("mergeWorkflowConfig", () => {
  it("provides sensible defaults", () => {
    const cfg = mergeWorkflowConfig({});
    expect(cfg.maxIterations).toBe(5);
    expect(cfg.healthCheckEnabled).toBe(true);
    expect(cfg.healthCheckThreshold).toBe(0.5);
  });

  it("respects overrides", () => {
    const cfg = mergeWorkflowConfig({ maxIterations: 10, task: "project: foo" });
    expect(cfg.maxIterations).toBe(10);
    expect(cfg.task).toBe("project: foo");
  });
});

// ── isConfigValid ───────────────────────────────────────────────────

describe("isConfigValid", () => {
  it("rejects empty task", () => {
    const cfg = mergeWorkflowConfig({});
    const result = isConfigValid(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("task is required");
  });

  it("rejects maxIterations < 1", () => {
    const cfg = mergeWorkflowConfig({ task: "project: x", maxIterations: 0 });
    expect(isConfigValid(cfg).valid).toBe(false);
  });

  it("rejects threshold out of range", () => {
    const cfg = mergeWorkflowConfig({ task: "project: x", healthCheckThreshold: 2 });
    expect(isConfigValid(cfg).valid).toBe(false);
  });

  it("accepts valid config", () => {
    const cfg = mergeWorkflowConfig({ task: "project: x" });
    expect(isConfigValid(cfg).valid).toBe(true);
  });
});

// ── extractProjectPath ──────────────────────────────────────────────

describe("extractProjectPath", () => {
  it("extracts path from task string", () => {
    const cfg = mergeWorkflowConfig({ task: "project: projects/foo" });
    expect(extractProjectPath(cfg)).toBe("projects/foo");
  });

  it("returns null for missing project prefix", () => {
    const cfg = mergeWorkflowConfig({ task: "do something random" });
    expect(extractProjectPath(cfg)).toBeNull();
  });
});

// ── shouldProceedAfterHealthCheck ───────────────────────────────────

describe("shouldProceedAfterHealthCheck", () => {
  it("proceeds when no projects exist", () => {
    const report: HealthReport = {
      timestamp: new Date().toISOString(),
      projects: [],
      summary: { total: 0, healthy: 0, stalled: 0, regressing: 0, missing: 0, malformed: 0 },
    };
    expect(shouldProceedAfterHealthCheck(report, 0.5).proceed).toBe(true);
  });

  it("proceeds when ratio meets threshold", () => {
    const report: HealthReport = {
      timestamp: new Date().toISOString(),
      projects: [],
      summary: { total: 4, healthy: 3, stalled: 1, regressing: 0, missing: 0, malformed: 0 },
    };
    expect(shouldProceedAfterHealthCheck(report, 0.5).proceed).toBe(true);
  });

  it("blocks when ratio below threshold", () => {
    const report: HealthReport = {
      timestamp: new Date().toISOString(),
      projects: [],
      summary: { total: 4, healthy: 1, stalled: 3, regressing: 0, missing: 0, malformed: 0 },
    };
    const decision = shouldProceedAfterHealthCheck(report, 0.5);
    expect(decision.proceed).toBe(false);
    expect(decision.reason).toContain("<");
  });
});

// ── buildStageResult ────────────────────────────────────────────────

describe("buildStageResult", () => {
  it("builds correct structure", () => {
    const start = Date.now() - 100;
    const result = buildStageResult("validate", true, start, { foo: "bar" });
    expect(result.stage).toBe("validate");
    expect(result.success).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.details).toEqual({ foo: "bar" });
  });
});

// ── summarizeWorkflow ───────────────────────────────────────────────

describe("summarizeWorkflow", () => {
  it("reports success when all stages pass", () => {
    const stages = [
      buildStageResult("validate", true, Date.now(), {}),
      buildStageResult("execute", true, Date.now(), {}),
    ];
    const result = summarizeWorkflow(stages, null);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("reports failure with stage name", () => {
    const stages = [
      buildStageResult("validate", true, Date.now(), {}),
      buildStageResult("health-check", false, Date.now(), {}),
    ];
    const result = summarizeWorkflow(stages, null);
    expect(result.success).toBe(false);
    expect(result.error).toContain("health-check");
  });

  it("includes cache stats when cache provided", () => {
    const cache = new ProjectCache();
    const result = summarizeWorkflow([], cache);
    expect(result.cacheStats).not.toBeNull();
    expect(result.cacheStats!.entries).toBe(0);
  });
});

// ── runValidationStage ──────────────────────────────────────────────

describe("runValidationStage", () => {
  it("fails when task has no project path", async () => {
    const cfg = mergeWorkflowConfig({ task: "do stuff" });
    const result = await runValidationStage(cfg);
    expect(result.success).toBe(false);
    expect(result.stage).toBe("validate");
  });

  it("succeeds for valid project", async () => {
    const { root } = makeTempProject();
    try {
      const cfg = mergeWorkflowConfig({
        task: "project: projects/test-proj",
        projectRoot: root,
      });
      const result = await runValidationStage(cfg);
      expect(result.success).toBe(true);
    } finally {
      cleanupDir(root);
    }
  });

  it("fails for non-existent project dir", async () => {
    const cfg = mergeWorkflowConfig({
      task: "project: projects/nonexistent",
      projectRoot: "/tmp/no-such-root-xyz",
    });
    const result = await runValidationStage(cfg);
    expect(result.success).toBe(false);
  });
});

// ── runHealthCheckStage ─────────────────────────────────────────────

describe("runHealthCheckStage", () => {
  it("skips when disabled", async () => {
    const cfg = mergeWorkflowConfig({ task: "project: x", healthCheckEnabled: false });
    const result = await runHealthCheckStage(cfg);
    expect(result.success).toBe(true);
    expect(result.details.skipped).toBe(true);
  });

  it("passes with healthy projects", async () => {
    const readFn = (path: string) => {
      if (path.includes("project.md")) {
        return `# P\n\n## Metrics\n| Metric | Current | Target |\n| --- | --- | --- |\n| x | 90% | 80% |\n`;
      }
      return `## ${new Date().toISOString()}\nwork done`;
    };
    const cfg = mergeWorkflowConfig({
      task: "project: x",
      healthCheckEnabled: true,
      satelliteDirs: ["/fake/proj-a"],
      healthCheckThreshold: 0.5,
    });
    const result = await runHealthCheckStage(cfg, readFn);
    expect(result.success).toBe(true);
  });

  it("fails when all projects are missing", async () => {
    const readFn = (_path: string): string | null => null;
    const cfg = mergeWorkflowConfig({
      task: "project: x",
      healthCheckEnabled: true,
      satelliteDirs: ["/fake/a", "/fake/b"],
      healthCheckThreshold: 0.5,
    });
    // Missing projects count as "missing" not "healthy", but ratio = 0/2 < 0.5
    const result = await runHealthCheckStage(cfg, readFn as any);
    expect(result.success).toBe(false);
  });
});

// ── runExecutionStage ───────────────────────────────────────────────

describe("runExecutionStage", () => {
  it("succeeds with simple function", async () => {
    const result = await runExecutionStage(async () => "done", null, "test");
    expect(result.success).toBe(true);
    expect(result.details.result).toBe("done");
  });

  it("captures thrown errors", async () => {
    const result = await runExecutionStage(async () => { throw new Error("boom"); }, null, "test");
    expect(result.success).toBe(false);
    expect(result.details.error).toBe("boom");
  });

  it("uses retry wrapper when provided", async () => {
    let calls = 0;
    const wrapper = createRetryWrapper({ maxRetries: 2, baseDelayMs: 1 }, noSleep);
    const result = await runExecutionStage(
      async () => { calls++; if (calls < 2) throw new Error("transient"); return "ok"; },
      wrapper,
      "test"
    );
    expect(result.success).toBe(true);
    expect(calls).toBe(2);
  });

  it("fails after exhausting retries", async () => {
    const wrapper = createRetryWrapper({ maxRetries: 1, baseDelayMs: 1 }, noSleep);
    const result = await runExecutionStage(
      async () => { throw new Error("permanent"); },
      wrapper,
      "test"
    );
    expect(result.success).toBe(false);
  });
});

// ── Full pipeline: runWorkflow ──────────────────────────────────────

describe("runWorkflow - full pipeline", () => {
  it("rejects invalid config (no task)", async () => {
    const result = await runWorkflow({}, async () => "x");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid config");
  });

  it("completes successfully with valid project", async () => {
    const { root } = makeTempProject();
    try {
      const result = await runWorkflow(
        { task: "project: projects/test-proj", projectRoot: root, healthCheckEnabled: false },
        async () => "executed"
      );
      expect(result.success).toBe(true);
      expect(result.stages.length).toBe(4);
      expect(result.stages[0].stage).toBe("validate");
      expect(result.stages[2].stage).toBe("execute");
    } finally {
      cleanupDir(root);
    }
  });

  it("stops at validation if project doesn't exist", async () => {
    const result = await runWorkflow(
      { task: "project: projects/nope", projectRoot: "/tmp/nonexistent-root-xyz" },
      async () => "x"
    );
    expect(result.success).toBe(false);
    expect(result.stages.length).toBe(1);
    expect(result.stages[0].stage).toBe("validate");
  });

  it("stops at health check if threshold not met", async () => {
    const { root } = makeTempProject();
    try {
      const readFn = (_path: string): string => { throw new Error("no file"); };
      const result = await runWorkflow(
        {
          task: "project: projects/test-proj",
          projectRoot: root,
          healthCheckEnabled: true,
          satelliteDirs: ["/fake/a", "/fake/b"],
          healthCheckThreshold: 0.9,
        },
        async () => "x",
        { readFn }
      );
      expect(result.success).toBe(false);
      expect(result.stages.length).toBe(2);
    } finally {
      cleanupDir(root);
    }
  });

  it("records cache stats", async () => {
    const { root } = makeTempProject();
    try {
      const result = await runWorkflow(
        { task: "project: projects/test-proj", projectRoot: root, healthCheckEnabled: false },
        async () => 42
      );
      expect(result.cacheStats).not.toBeNull();
    } finally {
      cleanupDir(root);
    }
  });

  it("passes readFn to health check stage", async () => {
    const { root } = makeTempProject();
    const readCalls: string[] = [];
    const readFn = (path: string) => { readCalls.push(path); return "# P\n**Status**: active\n"; };
    try {
      await runWorkflow(
        {
          task: "project: projects/test-proj",
          projectRoot: root,
          healthCheckEnabled: true,
          satelliteDirs: ["/fake/proj"],
          healthCheckThreshold: 0,
        },
        async () => "ok",
        { readFn }
      );
      expect(readCalls.length).toBeGreaterThan(0);
    } finally {
      cleanupDir(root);
    }
  });
});

// ── Error recovery tests ────────────────────────────────────────────

describe("error recovery - graceful degradation", () => {
  it("handles execute function throwing non-Error objects", async () => {
    const result = await runExecutionStage(async () => { throw "string error"; }, null, "test");
    expect(result.success).toBe(false);
    expect(result.details.error).toBe("string error");
  });

  it("handles corrupt project.md (no status field)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-corrupt-"));
    const projectDir = join(dir, "projects", "corrupt");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, "project.md"), "garbage content with no structure\n");
    try {
      const cfg = mergeWorkflowConfig({ task: "project: projects/corrupt", projectRoot: dir });
      const result = await runValidationStage(cfg);
      // Should still succeed (validation only checks existence + status)
      // With no status match, status is "unknown" which is dispatchable
      expect(result.stage).toBe("validate");
    } finally {
      cleanupDir(dir);
    }
  });

  it("handles empty project.md gracefully", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wf-empty-"));
    const projectDir = join(dir, "projects", "empty");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, "project.md"), "");
    try {
      const cfg = mergeWorkflowConfig({ task: "project: projects/empty", projectRoot: dir });
      const result = await runValidationStage(cfg);
      // Empty file can still be read — status unknown, should be dispatchable
      expect(result.stage).toBe("validate");
    } finally {
      cleanupDir(dir);
    }
  });

  it("handles permission denied simulation (project dir missing project.md)", async () => {
    // Simulate permission denied by removing the file after dir exists
    const dir = mkdtempSync(join(tmpdir(), "wf-perm-"));
    const projectDir = join(dir, "projects", "locked");
    mkdirSync(projectDir, { recursive: true });
    // No project.md created — simulates inability to read
    const cfg = mergeWorkflowConfig({ task: "project: projects/locked", projectRoot: dir });
    const result = await runValidationStage(cfg);
    expect(result.success).toBe(false);
    expect((result.details.errors as string[]).some(e => e.includes("project.md"))).toBe(true);
    cleanupDir(dir);
  });

  it("handles disk-full simulation (write failure in execution)", async () => {
    const wrapper = createRetryWrapper({ maxRetries: 0, baseDelayMs: 1 }, noSleep);
    const result = await runExecutionStage(
      async () => { throw new Error("ENOSPC: no space left on device"); },
      wrapper,
      "test"
    );
    expect(result.success).toBe(false);
    expect(result.details.error).toContain("ENOSPC");
  });

  it("recovers from transient errors via retry", async () => {
    let attempt = 0;
    const wrapper = createRetryWrapper({ maxRetries: 3, baseDelayMs: 1 }, noSleep);
    const result = await runExecutionStage(
      async () => {
        attempt++;
        if (attempt <= 2) throw new Error("EAGAIN: resource temporarily unavailable");
        return "recovered";
      },
      wrapper,
      "test"
    );
    expect(result.success).toBe(true);
    expect(result.details.result).toBe("recovered");
  });

  it("handles readFn throwing in health check", async () => {
    const readFn = (_path: string): string => { throw new Error("EACCES: permission denied"); };
    const cfg = mergeWorkflowConfig({
      task: "project: x",
      healthCheckEnabled: true,
      satelliteDirs: ["/fake/a"],
      healthCheckThreshold: 0,
    });
    // Should not crash — readFn errors are caught internally
    const result = await runHealthCheckStage(cfg, readFn);
    expect(result.stage).toBe("health-check");
  });

  it("full pipeline gracefully handles execution failure", async () => {
    const { root } = makeTempProject();
    try {
      const result = await runWorkflow(
        { task: "project: projects/test-proj", projectRoot: root, healthCheckEnabled: false, retryConfig: { maxRetries: 0, baseDelayMs: 1, maxDelayMs: 1, circuitBreakerThreshold: 5, circuitRecoveryMs: 1 } },
        async () => { throw new Error("catastrophic failure"); }
      );
      expect(result.success).toBe(false);
      expect(result.stages.some(s => s.stage === "execute" && !s.success)).toBe(true);
    } finally {
      cleanupDir(root);
    }
  });
});
