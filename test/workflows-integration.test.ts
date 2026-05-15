/**
 * Integration test — exercises the workflow-runner pipeline end-to-end
 * with real filesystem reads (no mocks). Validates that the system
 * coordinates validation, health-check, and execution stages correctly.
 */
import { describe, it, expect } from "vitest";
import {
  mergeWorkflowConfig,
  shouldProceedAfterHealthCheck,
  buildStageResult,
  summarizeWorkflow,
  isConfigValid,
  runValidationStage,
  runHealthCheckStage,
  WorkflowConfig,
} from "../shared/workflows/workflow-runner.js";
import { validateDispatch } from "../shared/workflows/dispatch-validator.js";
import { checkHealth } from "../shared/workflows/health-check.js";
import { ProjectCache } from "../shared/workflows/project-cache.js";

describe("Workflow Integration (no mocks)", () => {
  const projectRoot = "/app";

  describe("Full pipeline: config → validate → health-check → summary", () => {
    it("runs a valid task through all stages and produces a coherent result", async () => {
      // 1. Build config
      const config = mergeWorkflowConfig({
        projectRoot,
        task: "project: projects/closed-loop-reliability",
        maxIterations: 3,
        healthCheckEnabled: true,
        healthCheckThreshold: 0.0, // low threshold so it always proceeds
        satelliteDirs: [`${projectRoot}/projects/closed-loop-reliability`],
      });

      // 2. Validate config
      const validity = isConfigValid(config);
      expect(validity.valid).toBe(true);
      expect(validity.errors).toHaveLength(0);

      // 3. Run validation stage (real filesystem)
      const valResult = await runValidationStage(config);
      expect(valResult.stage).toBe("validate");
      expect(typeof valResult.durationMs).toBe("number");
      expect(valResult.durationMs).toBeGreaterThanOrEqual(0);

      // 4. Run health-check stage (real filesystem)
      const healthResult = await runHealthCheckStage(config);
      expect(healthResult.stage).toBe("health-check");
      expect(healthResult.success).toBe(true);

      // 5. Summarize
      const summary = summarizeWorkflow([valResult, healthResult], null);
      expect(summary.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(summary.stages).toHaveLength(2);
      expect(summary.cacheStats).toBeNull();
    });

    it("rejects invalid config", () => {
      const config = mergeWorkflowConfig({
        task: "",
        maxIterations: 0,
        healthCheckThreshold: 2.0,
      });
      const validity = isConfigValid(config);
      expect(validity.valid).toBe(false);
      expect(validity.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Health-check with real project data", () => {
    it("produces a health report from project objects", () => {
      const projects = [
        { name: "test-proj", projectContent: "# Status: active\n## Metrics\n- coverage: 80% (target: 70%)", journalContent: null },
      ];
      const report = checkHealth(projects);
      expect(report).toHaveProperty("summary");
      expect(report.summary).toHaveProperty("total");
      expect(report.summary.total).toBe(1);
    });

    it("shouldProceedAfterHealthCheck respects threshold", () => {
      const projects = [
        { name: "healthy", projectContent: "# Status: active\n## Metrics\n- score: 90% (target: 80%)", journalContent: null },
      ];
      const report = checkHealth(projects);
      // With threshold 0, should always proceed
      const low = shouldProceedAfterHealthCheck(report, 0);
      expect(low.proceed).toBe(true);
      // With threshold 1.01 (impossible), should fail
      const high = shouldProceedAfterHealthCheck(report, 1.01);
      expect(high.proceed).toBe(false);
    });
  });

  describe("Dispatch validator with real filesystem", () => {
    it("validates a real task string against actual project root", () => {
      const result = validateDispatch("project: projects/closed-loop-reliability", projectRoot);
      expect(result).toHaveProperty("valid");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("warnings");
    });
  });

  describe("ProjectCache integration", () => {
    it("caches and retrieves filesystem reads", () => {
      const cache = new ProjectCache();
      // Write a temp file, then read it via cache
      const tmpPath = "/tmp/test-cache-integration.txt";
      cache.write(tmpPath, "hello world");
      const result = cache.read(tmpPath);
      expect(result).toBe("hello world");

      const stats = cache.getStats();
      expect(stats.totalWrites).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Stage composition", () => {
    it("buildStageResult captures timing", () => {
      const start = Date.now() - 50;
      const result = buildStageResult("execute", true, start, { iterations: 3 });
      expect(result.stage).toBe("execute");
      expect(result.success).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(49);
      expect(result.details).toEqual({ iterations: 3 });
    });

    it("summarizeWorkflow aggregates stages correctly", () => {
      const stages = [
        buildStageResult("validate", true, Date.now(), {}),
        buildStageResult("health-check", true, Date.now(), {}),
        buildStageResult("execute", false, Date.now(), { error: "timeout" }),
      ];
      const result = summarizeWorkflow(stages, null);
      expect(result.success).toBe(false);
      expect(result.error).toContain("execute");
      expect(result.stages).toHaveLength(3);
    });
  });
});
