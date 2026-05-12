/**
 * Integration test: exercises workflow-runner end-to-end without mocks.
 * Validates that the pipeline stages (validate → health-check → summarize) coordinate correctly.
 */
import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import {
  mergeWorkflowConfig,
  shouldProceedAfterHealthCheck,
  buildStageResult,
  summarizeWorkflow,
  isConfigValid,
  extractProjectPath,
} from "../workflows/workflow-runner.js";
import { ProjectCache } from "../workflows/project-cache.js";
import { validateDispatch } from "../workflows/dispatch-validator.js";
import { checkHealth } from "../workflows/health-check.js";

describe("Workflow Integration (end-to-end, no mocks)", () => {
  it("runs a full validate → health-check → summarize pipeline", async () => {
    // 1. Build config
    const config = mergeWorkflowConfig({
      projectRoot: "/app/agents/shared",
      task: "project: projects/test-reliability — run integration check",
      maxIterations: 3,
      healthCheckEnabled: true,
      healthCheckThreshold: 0.3,
      satelliteDirs: ["projects"],
    });

    // 2. Validate config
    const validity = isConfigValid(config);
    expect(validity.valid).toBe(true);
    expect(validity.errors).toHaveLength(0);

    // 3. Validate dispatch
    const validation = validateDispatch(config.task, config.projectRoot);
    expect(validation).toBeDefined();

    // 4. Run health check with structured input
    const healthReport = checkHealth([
      { name: "test-project", projectContent: "status: active\nmetric: 80% coverage", journalContent: null },
      { name: "healthy-project", projectContent: "status: complete\nmetric: done", journalContent: "## Entry\nAll good" },
    ]);
    expect(healthReport).toBeDefined();
    expect(healthReport.summary).toBeDefined();
    expect(typeof healthReport.summary.total).toBe("number");
    expect(healthReport.summary.total).toBe(2);

    // 5. Decide whether to proceed
    const decision = shouldProceedAfterHealthCheck(healthReport, config.healthCheckThreshold);
    expect(decision).toHaveProperty("proceed");
    expect(decision).toHaveProperty("reason");

    // 6. Build stage results
    const stages = [
      buildStageResult("validate", true, Date.now() - 10, { validation }),
      buildStageResult("health-check", decision.proceed, Date.now() - 5, {
        healthyRatio: healthReport.summary.total > 0
          ? healthReport.summary.healthy / healthReport.summary.total
          : 1,
      }),
    ];

    // 7. Summarize
    const result = summarizeWorkflow(stages, null);
    expect(result.stages).toHaveLength(2);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.success).toBe("boolean");
  });

  it("exercises ProjectCache with read cycle", () => {
    const cache = new ProjectCache(50, 0);
    
    // Read a real file
    const pkgPath = resolve(__dirname, "../../shared/package.json");
    const content = cache.read(pkgPath);
    expect(content).toContain("vitest");

    const stats = cache.getStats();
    expect(stats.totalMisses).toBe(1);
    expect(stats.totalHits).toBe(0);

    // Second read should hit cache
    const content2 = cache.read(pkgPath);
    expect(content2).toBe(content);
    expect(cache.getStats().totalHits).toBe(1);
  });

  it("extractProjectPath parses task strings with project: prefix", () => {
    const path = extractProjectPath(
      mergeWorkflowConfig({ task: "project: projects/foo — do something" })
    );
    expect(path).toBe("projects/foo");
  });

  it("handles invalid config gracefully", () => {
    const result = isConfigValid(
      mergeWorkflowConfig({ task: "", maxIterations: 0, healthCheckThreshold: 2 })
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
