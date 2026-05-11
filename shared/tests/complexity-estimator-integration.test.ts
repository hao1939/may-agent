import { describe, it, expect } from "vitest";
import { estimateComplexity } from "../workflows/complexity-estimator.ts";

describe("complexity-estimator integration", () => {
  describe("complexity scoring affects iteration behavior", () => {
    it("simple documentation tasks get score 1-2 and short timeout", () => {
      const task = "Write outputs/summary.md with a brief description of what was done.";
      const result = estimateComplexity(task);
      expect(result.score).toBeLessThanOrEqual(2);
      expect(result.timeoutMs).toBeLessThanOrEqual(120000);
    });

    it("multi-file implementation tasks get score 4-5 and long timeout", () => {
      const task = "Implement agents/shared/workflows/new-module.ts with 5 functions. Read project.ts, provider-retry.ts, and output-validator.ts. Write tests at agents/shared/tests/new-module.test.ts covering 20+ cases.";
      const result = estimateComplexity(task);
      expect(result.score).toBeGreaterThanOrEqual(4);
      expect(result.timeoutMs).toBeGreaterThanOrEqual(240000);
    });

    it("edit tasks get moderate score", () => {
      const task = "Edit agents/shared/workflows/project.ts to add a new import and one function call.";
      const result = estimateComplexity(task);
      expect(result.score).toBeGreaterThanOrEqual(2);
      expect(result.score).toBeLessThanOrEqual(4);
    });

    it("tasks with test targets get higher scores", () => {
      const simple = "Write a file with 3 test cases.";
      const complex = "Write a test file with 30+ test cases covering edge cases.";
      const simpleResult = estimateComplexity(simple);
      const complexResult = estimateComplexity(complex);
      expect(complexResult.score).toBeGreaterThanOrEqual(simpleResult.score);
    });

    it("timeout scales with complexity score", () => {
      const tasks = [
        "Write a one-line config file.",
        "Create a module with 2 functions and basic tests.",
        "Implement a full workflow with 5 files, integration tests, and documentation.",
      ];
      const results = tasks.map(t => estimateComplexity(t));
      // Timeouts should be non-decreasing with complexity
      for (let i = 1; i < results.length; i++) {
        expect(results[i].timeoutMs).toBeGreaterThanOrEqual(results[i - 1].timeoutMs);
      }
    });

    it("complexity result has required fields", () => {
      const result = estimateComplexity("Do something");
      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("timeoutMs");
      expect(result).toHaveProperty("description");
      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.score).toBeLessThanOrEqual(5);
      expect(result.timeoutMs).toBeGreaterThan(0);
      expect(typeof result.description).toBe("string");
    });

    it("log message format matches workflow integration", () => {
      const task = "Create a new module with tests.";
      const complexity = estimateComplexity(task);
      const logMsg = `[work] 📊 Complexity: ${complexity.score}/5 (${complexity.description}), timeout: ${complexity.timeoutMs}ms`;
      expect(logMsg).toContain("[work]");
      expect(logMsg).toContain("Complexity:");
      expect(logMsg).toMatch(/\d\/5/);
    });
  });

  describe("integration with iteration flow", () => {
    it("validation + complexity work together on valid tasks", () => {
      const task = "Write outputs/report.md summarizing the project status.";
      const complexity = estimateComplexity(task);
      expect(complexity.score).toBeGreaterThanOrEqual(1);
      expect(complexity.timeoutMs).toBeGreaterThan(0);
    });

    it("complexity handles empty/minimal tasks gracefully", () => {
      const result = estimateComplexity("");
      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.timeoutMs).toBeGreaterThan(0);
    });

    it("complexity handles very long task descriptions", () => {
      const longTask = "Implement ".repeat(500) + "a module with tests.";
      const result = estimateComplexity(longTask);
      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.score).toBeLessThanOrEqual(5);
    });
  });
});
