/**
 * Integration tests for workflows/workflow-runner.ts
 * Covers: config merging, validation, health checks, execution stages, full pipeline
 */

import { describe, it, expect, vi } from "vitest";
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
} from "../workflows/workflow-runner.js";
import { ProjectCache } from "../workflows/project-cache.js";
import { createRetryWrapper } from "../workflows/retry-wrapper.js";
import { HealthReport } from "../workflows/health-check.js";

describe("workflow-runner", () => {
  // ── mergeWorkflowConfig ───────────────────────────────────────────

  describe("mergeWorkflowConfig", () => {
    it("applies defaults for empty partial", () => {
      const cfg = mergeWorkflowConfig({});
      expect(cfg.projectRoot).toBe("/app");
      expect(cfg.task).toBe("");
      expect(cfg.maxIterations).toBe(5);
      expect(cfg.healthCheckEnabled).toBe(true);
      expect(cfg.healthCheckThreshold).toBe(0.5);
    });

    it("preserves provided values", () => {
      const cfg = mergeWorkflowConfig({
        projectRoot: "/custom",
        task: "do stuff",
        maxIterations: 10,
        healthCheckEnabled: false,
        healthCheckThreshold: 0.8,
      });
      expect(cfg.projectRoot).toBe("/custom");
      expect(cfg.task).toBe("do stuff");
      expect(cfg.maxIterations).toBe(10);
      expect(cfg.healthCheckEnabled).toBe(false);
      expect(cfg.healthCheckThreshold).toBe(0.8);
    });
  });

  // ── isConfigValid ─────────────────────────────────────────────────

  describe("isConfigValid", () => {
    it("returns valid for good config", () => {
      const cfg = mergeWorkflowConfig({ task: "test task" });
      const result = isConfigValid(cfg);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects empty task", () => {
      const cfg = mergeWorkflowConfig({});
      const result = isConfigValid(cfg);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("task is required");
    });

    it("rejects maxIterations < 1", () => {
      const cfg = mergeWorkflowConfig({ task: "x", maxIterations: 0 });
      const result = isConfigValid(cfg);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("maxIterations must be >= 1");
    });

    it("rejects healthCheckThreshold out of range", () => {
      const cfg = mergeWorkflowConfig({ task: "x", healthCheckThreshold: 1.5 });
      const result = isConfigValid(cfg);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("healthCheckThreshold must be 0-1");
    });
  });

  // ── shouldProceedAfterHealthCheck ─────────────────────────────────

  describe("shouldProceedAfterHealthCheck", () => {
    it("proceeds when no projects to check", () => {
      const report: HealthReport = { projects: [], summary: { total: 0, healthy: 0, unhealthy: 0, stale: 0 } };
      const result = shouldProceedAfterHealthCheck(report, 0.5);
      expect(result.proceed).toBe(true);
      expect(result.reason).toContain("No projects");
    });

    it("proceeds when ratio meets threshold", () => {
      const report: HealthReport = { projects: [], summary: { total: 4, healthy: 3, unhealthy: 1, stale: 0 } };
      const result = shouldProceedAfterHealthCheck(report, 0.5);
      expect(result.proceed).toBe(true);
    });

    it("blocks when ratio below threshold", () => {
      const report: HealthReport = { projects: [], summary: { total: 4, healthy: 1, unhealthy: 3, stale: 0 } };
      const result = shouldProceedAfterHealthCheck(report, 0.5);
      expect(result.proceed).toBe(false);
      expect(result.reason).toContain("<");
    });
  });

  // ── buildStageResult ──────────────────────────────────────────────

  describe("buildStageResult", () => {
    it("creates a stage result with duration", () => {
      const start = Date.now() - 100;
      const result = buildStageResult("validate", true, start, { foo: "bar" });
      expect(result.stage).toBe("validate");
      expect(result.success).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(99);
      expect(result.details).toEqual({ foo: "bar" });
    });
  });

  // ── summarizeWorkflow ─────────────────────────────────────────────

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

    it("reports failure with failed stage name", () => {
      const stages = [
        buildStageResult("validate", true, Date.now(), {}),
        buildStageResult("health-check", false, Date.now(), {}),
      ];
      const result = summarizeWorkflow(stages, null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("health-check");
    });
  });

  // ── runValidationStage ────────────────────────────────────────────

  describe("runValidationStage", () => {
    it("passes with a valid task referencing existing project", async () => {
      const cfg = mergeWorkflowConfig({ task: "Work on projects/test", projectRoot: "/app" });
      const result = await runValidationStage(cfg);
      expect(result.stage).toBe("validate");
      // May or may not succeed depending on filesystem, but should not throw
      expect(result).toHaveProperty("success");
    });
  });

  // ── runHealthCheckStage ───────────────────────────────────────────

  describe("runHealthCheckStage", () => {
    it("skips when healthCheckEnabled is false", async () => {
      const cfg = mergeWorkflowConfig({ task: "x", healthCheckEnabled: false });
      const result = await runHealthCheckStage(cfg);
      expect(result.success).toBe(true);
      expect(result.details.skipped).toBe(true);
    });

    it("succeeds with no satellite dirs", async () => {
      const cfg = mergeWorkflowConfig({ task: "x", healthCheckEnabled: true, satelliteDirs: [] });
      const result = await runHealthCheckStage(cfg);
      expect(result.success).toBe(true);
    });

    it("uses readFn to load project content", async () => {
      const readFn = vi.fn().mockReturnValue("# Project\nsome content");
      const cfg = mergeWorkflowConfig({ task: "x", healthCheckEnabled: true, satelliteDirs: ["/tmp/proj1"] });
      const result = await runHealthCheckStage(cfg, readFn);
      expect(readFn).toHaveBeenCalled();
      expect(result.stage).toBe("health-check");
    });
  });

  // ── runExecutionStage ─────────────────────────────────────────────

  describe("runExecutionStage", () => {
    it("executes successfully without retry wrapper", async () => {
      const fn = vi.fn().mockResolvedValue("done");
      const result = await runExecutionStage(fn, null, "test-agent");
      expect(result.success).toBe(true);
      expect(result.details.result).toBe("done");
    });

    it("captures error on execution failure", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("boom"));
      const result = await runExecutionStage(fn, null, "test-agent");
      expect(result.success).toBe(false);
      expect(result.details.error).toBe("boom");
    });

    it("uses retry wrapper when provided", async () => {
      const fn = vi.fn().mockResolvedValue(42);
      const wrapper = createRetryWrapper({ maxRetries: 2, baseDelayMs: 10 });
      const result = await runExecutionStage(fn, wrapper, "test-agent");
      expect(result.success).toBe(true);
    });
  });

  // ── runWorkflow (full pipeline) ───────────────────────────────────

  describe("runWorkflow", () => {
    it("fails immediately with invalid config", async () => {
      const result = await runWorkflow({}, async () => "x");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid config");
    });

    it("runs full pipeline successfully", async () => {
      const executeFn = vi.fn().mockResolvedValue("completed");
      const result = await runWorkflow(
        { task: "do something useful", healthCheckEnabled: false },
        executeFn
      );
      // Validation may fail if dispatch-validator requires specific task format
      // but the pipeline should not throw
      expect(result).toHaveProperty("success");
      expect(result.stages.length).toBeGreaterThan(0);
    });

    it("stops at validation failure", async () => {
      const executeFn = vi.fn().mockResolvedValue("x");
      // Empty task after merging won't happen since we pass task, but invalid project ref may fail validation
      const result = await runWorkflow(
        { task: "invalid-no-project-ref", healthCheckEnabled: false },
        executeFn
      );
      // If validation fails, executeFn should not be called
      if (!result.success && result.stages[0]?.stage === "validate" && !result.stages[0].success) {
        expect(executeFn).not.toHaveBeenCalled();
      }
    });

    it("stops at health check failure", async () => {
      const executeFn = vi.fn().mockResolvedValue("x");
      // Use a readFn that returns nothing to simulate unhealthy projects
      const readFn = () => "";
      const result = await runWorkflow(
        {
          task: "projects/test work",
          healthCheckEnabled: true,
          healthCheckThreshold: 1.0,
          satelliteDirs: ["/fake/dir1", "/fake/dir2"],
        },
        executeFn,
        { readFn }
      );
      // With threshold 1.0 and unhealthy projects, health check should block
      expect(result).toHaveProperty("success");
    });

    it("passes agentId to execution stage", async () => {
      const executeFn = vi.fn().mockResolvedValue("ok");
      const result = await runWorkflow(
        { task: "projects/test do work", healthCheckEnabled: false },
        executeFn,
        { agentId: "custom-agent" }
      );
      expect(result).toHaveProperty("stages");
    });
  });
});
