/**
 * Integration test: exercises workflow-runner end-to-end without mocks.
 * Validates that the pipeline stages (validate → health-check → summarize) coordinate correctly.
 */
import { describe, it, expect } from "vitest";
import {
  mergeWorkflowConfig,
  shouldProceedAfterHealthCheck,
  buildStageResult,
  summarizeWorkflow,
  isConfigValid,
  extractProjectPath,
} from "../workflow-runner.js";
import { ProjectCache } from "../project-cache.js";
import { validateDispatch } from "../dispatch-validator.js";
import { checkHealth } from "../health-check.js";

describe("Workflow Integration (end-to-end, no mocks)", () => {
  it("runs a full validate → health-check → summarize pipeline", async () => {
    // 1. Build config
    const config = mergeWorkflowConfig({
      projectRoot: "/app/agents/shared",
      task: "projects/test-reliability — run integration check",
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

    // 4. Run health check on real filesystem
    const healthReport = await checkHealth(config.projectRoot, config.satelliteDirs!);
    expect(healthReport).toBeDefined();
    expect(healthReport.summary).toBeDefined();
    expect(typeof healthReport.summary.total).toBe("number");

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

  it("exercises ProjectCache with real filesystem reads", async () => {
    const cache = new ProjectCache("/app/agents/shared");
    // Read a real file that definitely exists
    const content = await cache.readFile("package.json");
    expect(content).toContain("vitest");

    const stats = cache.getStats();
    expect(stats.misses).toBe(1);
    expect(stats.hits).toBe(0);

    // Second read should hit cache
    const content2 = await cache.readFile("package.json");
    expect(content2).toBe(content);
    expect(cache.getStats().hits).toBe(1);
  });

  it("extractProjectPath parses task strings correctly", () => {
    const path = extractProjectPath(
      mergeWorkflowConfig({ task: "projects/foo — do something" })
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
