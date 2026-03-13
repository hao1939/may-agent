/**
 * Agent Gym — Adversarial Scenario Tests
 *
 * Tests detection and analysis of common adversarial patterns:
 * 1. Circular dependencies (A→B→A require loop)
 * 2. Missing files (import references non-existent module)
 * 3. Infinite loops (script that hangs forever)
 *
 * Design: P80 Environment Diversity — validate agent resilience
 * against failure modes, not just happy-path code.
 */

import { describe, it, expect, afterEach } from "vitest";
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  forkScenario,
  cleanupScenario,
  runWithTimeout,
  detectCircularDependency,
  detectMissingFiles,
  detectInfiniteLoop,
} from "./gym-harness.js";

describe("Agent Gym", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      cleanupScenario(dir);
    }
    tempDirs.length = 0;
  });

  describe("Harness", () => {
    it("forks a scenario to a temp directory", () => {
      const workDir = forkScenario("circular-dependency");
      tempDirs.push(workDir);

      expect(existsSync(workDir)).toBe(true);
      expect(existsSync(join(workDir, "module-a.js"))).toBe(true);
      expect(existsSync(join(workDir, "module-b.js"))).toBe(true);
      expect(existsSync(join(workDir, "package.json"))).toBe(true);
    });

    it("throws for non-existent scenario", () => {
      expect(() => forkScenario("does-not-exist")).toThrow("Fixture not found");
    });

    it("cleans up temp directory", () => {
      const workDir = forkScenario("missing-files");
      expect(existsSync(workDir)).toBe(true);
      cleanupScenario(workDir);
      expect(existsSync(workDir)).toBe(false);
    });
  });

  describe("Scenario: Circular Dependency", () => {
    it("detects the circular require loop", () => {
      const workDir = forkScenario("circular-dependency");
      tempDirs.push(workDir);

      const cycle = detectCircularDependency(workDir);
      expect(cycle).not.toBeNull();
      expect(cycle!.length).toBeGreaterThanOrEqual(3); // A → B → A (at least)
      expect(cycle![0]).toBe(cycle![cycle!.length - 1]); // cycle closes
    });

    it("confirms the project actually fails at runtime", () => {
      const workDir = forkScenario("circular-dependency");
      tempDirs.push(workDir);

      const result = runWithTimeout(workDir, "module-a.js", 3000);
      // Circular dependency in Node.js causes getA() to call getB() which calls
      // getA() on a partially-loaded module — getA is undefined → TypeError
      expect(result.exitCode).not.toBe(0);
    });

    it("identifies both modules in the cycle", () => {
      const workDir = forkScenario("circular-dependency");
      tempDirs.push(workDir);

      const cycle = detectCircularDependency(workDir);
      expect(cycle).not.toBeNull();

      const cycleStr = cycle!.join(" → ");
      expect(cycleStr).toContain("module-a.js");
      expect(cycleStr).toContain("module-b.js");
    });

    it("fix: break the cycle by lazy-loading", () => {
      const workDir = forkScenario("circular-dependency");
      tempDirs.push(workDir);

      // Fix: rewrite module-b to use lazy require (common fix pattern)
      writeFileSync(
        join(workDir, "module-b.js"),
        `function getB() {
  // Lazy require breaks the circular dependency
  return "B";
}
module.exports = { getB };`
      );

      // After fix, no cycle should be detected
      const cycle = detectCircularDependency(workDir);
      expect(cycle).toBeNull();

      // And the project should run successfully
      const result = runWithTimeout(workDir, "module-a.js", 3000);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toContain("A+B");
    });
  });

  describe("Scenario: Missing Files", () => {
    it("detects the missing math-utils module", () => {
      const workDir = forkScenario("missing-files");
      tempDirs.push(workDir);

      const missing = detectMissingFiles(workDir);
      expect(missing.length).toBe(1);
      expect(missing[0].file).toBe("app.js");
      expect(missing[0].missingImport).toBe("math-utils");
    });

    it("confirms the project fails at runtime", () => {
      const workDir = forkScenario("missing-files");
      tempDirs.push(workDir);

      const result = runWithTimeout(workDir, "app.js", 3000);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Cannot find module");
    });

    it("fix: create the missing module stub", () => {
      const workDir = forkScenario("missing-files");
      tempDirs.push(workDir);

      // Fix: create the missing module with the expected export
      writeFileSync(
        join(workDir, "math-utils.js"),
        `function calculate(a, b) {
  return a + b;
}
module.exports = { calculate };`
      );

      // After fix, no missing files
      const missing = detectMissingFiles(workDir);
      expect(missing.length).toBe(0);

      // And the project should run successfully
      const result = runWithTimeout(workDir, "app.js", 3000);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toContain("Result: 30");
    });
  });

  describe("Scenario: Infinite Loop", () => {
    it("detects the hanging script", () => {
      const workDir = forkScenario("infinite-loop");
      tempDirs.push(workDir);

      const hangs = detectInfiniteLoop(workDir, "worker.js", 2000);
      expect(hangs).toBe(true);
    });

    it("does not false-positive on a working script", () => {
      const workDir = forkScenario("missing-files");
      tempDirs.push(workDir);

      // Create the missing module so the script runs and exits
      writeFileSync(
        join(workDir, "math-utils.js"),
        `function calculate(a, b) { return a + b; }
module.exports = { calculate };`
      );

      const hangs = detectInfiniteLoop(workDir, "app.js", 2000);
      expect(hangs).toBe(false);
    });

    it("fix: add the missing increment", () => {
      const workDir = forkScenario("infinite-loop");
      tempDirs.push(workDir);

      // Fix: rewrite with the increment
      writeFileSync(
        join(workDir, "worker.js"),
        `function processData() {
  const data = [];
  let i = 0;
  while (i < 100) {
    data.push(i);
    i++; // Fixed: added increment
  }
  return data;
}
module.exports = { processData };
if (require.main === module) {
  console.log("Starting data processing...");
  const result = processData();
  console.log("Done! Processed", result.length, "items");
}`
      );

      // After fix, should not hang
      const hangs = detectInfiniteLoop(workDir, "worker.js", 2000);
      expect(hangs).toBe(false);

      // And should produce correct output
      const result = runWithTimeout(workDir, "worker.js", 3000);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Done! Processed 100 items");
    });
  });

  describe("Scenario Coverage", () => {
    it("all fixture directories have package.json", () => {
      const fixturesDir = join(import.meta.dirname, "fixtures");
      const scenarios = readdirSync(fixturesDir);
      expect(scenarios.length).toBeGreaterThanOrEqual(3);

      for (const scenario of scenarios) {
        const pkgPath = join(fixturesDir, scenario, "package.json");
        expect(existsSync(pkgPath), `${scenario} missing package.json`).toBe(true);
      }
    });
  });
});
