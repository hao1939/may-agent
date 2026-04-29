import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { collectMetrics, formatMetrics } from "../workflows/metrics-dashboard";

const TEST_DIR = join(__dirname, "__fixtures_dashboard__");

function setup() {
  // Create test structure
  mkdirSync(join(TEST_DIR, "tests"), { recursive: true });
  mkdirSync(join(TEST_DIR, "outputs"), { recursive: true });
  mkdirSync(join(TEST_DIR, "workflows"), { recursive: true });
}

function cleanup() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

describe("metrics-dashboard", () => {
  beforeEach(() => {
    cleanup();
    setup();
  });

  afterEach(() => {
    cleanup();
  });

  describe("collectMetrics", () => {
    it("returns zeros for empty directories", () => {
      const metrics = collectMetrics({
        testsDir: join(TEST_DIR, "tests"),
        outputsDir: join(TEST_DIR, "outputs"),
        workflowsDir: join(TEST_DIR, "workflows"),
      });
      expect(metrics.testCount).toBe(0);
      expect(metrics.testFileCount).toBe(0);
      expect(metrics.outputCount).toBe(0);
      expect(metrics.workflowModuleCount).toBe(0);
      expect(metrics.integrationTestCount).toBe(0);
    });

    it("counts test files correctly", () => {
      writeFileSync(join(TEST_DIR, "tests", "foo.test.ts"), 'it("works", () => {});');
      writeFileSync(join(TEST_DIR, "tests", "bar.test.ts"), 'it("a", () => {});\nit("b", () => {});');
      const metrics = collectMetrics({
        testsDir: join(TEST_DIR, "tests"),
        outputsDir: join(TEST_DIR, "outputs"),
        workflowsDir: join(TEST_DIR, "workflows"),
      });
      expect(metrics.testFileCount).toBe(2);
    });

    it("counts individual test cases", () => {
      writeFileSync(join(TEST_DIR, "tests", "foo.test.ts"), 'it("a", () => {});\nit("b", () => {});\ntest("c", () => {});');
      const metrics = collectMetrics({
        testsDir: join(TEST_DIR, "tests"),
        outputsDir: join(TEST_DIR, "outputs"),
        workflowsDir: join(TEST_DIR, "workflows"),
      });
      expect(metrics.testCount).toBe(3);
    });

    it("counts output artifacts", () => {
      writeFileSync(join(TEST_DIR, "outputs", "report.md"), "# Report");
      writeFileSync(join(TEST_DIR, "outputs", "data.json"), "{}");
      const metrics = collectMetrics({
        testsDir: join(TEST_DIR, "tests"),
        outputsDir: join(TEST_DIR, "outputs"),
        workflowsDir: join(TEST_DIR, "workflows"),
      });
      expect(metrics.outputCount).toBe(2);
    });

    it("excludes hidden files from output count", () => {
      writeFileSync(join(TEST_DIR, "outputs", ".gitkeep"), "");
      writeFileSync(join(TEST_DIR, "outputs", "report.md"), "# Report");
      const metrics = collectMetrics({
        testsDir: join(TEST_DIR, "tests"),
        outputsDir: join(TEST_DIR, "outputs"),
        workflowsDir: join(TEST_DIR, "workflows"),
      });
      expect(metrics.outputCount).toBe(1);
    });

    it("counts workflow modules", () => {
      writeFileSync(join(TEST_DIR, "workflows", "module-a.ts"), "export {}");
      writeFileSync(join(TEST_DIR, "workflows", "module-b.ts"), "export {}");
      writeFileSync(join(TEST_DIR, "workflows", "module-c.ts"), "export {}");
      const metrics = collectMetrics({
        testsDir: join(TEST_DIR, "tests"),
        outputsDir: join(TEST_DIR, "outputs"),
        workflowsDir: join(TEST_DIR, "workflows"),
      });
      expect(metrics.workflowModuleCount).toBe(3);
    });

    it("excludes test files from workflow module count", () => {
      writeFileSync(join(TEST_DIR, "workflows", "module.ts"), "export {}");
      writeFileSync(join(TEST_DIR, "workflows", "module.test.ts"), 'it("x", () => {});');
      const metrics = collectMetrics({
        testsDir: join(TEST_DIR, "tests"),
        outputsDir: join(TEST_DIR, "outputs"),
        workflowsDir: join(TEST_DIR, "workflows"),
      });
      expect(metrics.workflowModuleCount).toBe(1);
    });

    it("counts integration test files", () => {
      writeFileSync(join(TEST_DIR, "tests", "unit.test.ts"), 'it("x", () => {});');
      writeFileSync(join(TEST_DIR, "tests", "foo-integration.test.ts"), 'it("x", () => {});');
      writeFileSync(join(TEST_DIR, "tests", "bar-integration.test.ts"), 'it("x", () => {});');
      const metrics = collectMetrics({
        testsDir: join(TEST_DIR, "tests"),
        outputsDir: join(TEST_DIR, "outputs"),
        workflowsDir: join(TEST_DIR, "workflows"),
      });
      expect(metrics.integrationTestCount).toBe(2);
    });

    it("handles non-existent directories gracefully", () => {
      const metrics = collectMetrics({
        testsDir: "/nonexistent/tests",
        outputsDir: "/nonexistent/outputs",
        workflowsDir: "/nonexistent/workflows",
      });
      expect(metrics.testCount).toBe(0);
      expect(metrics.testFileCount).toBe(0);
      expect(metrics.outputCount).toBe(0);
      expect(metrics.workflowModuleCount).toBe(0);
      expect(metrics.integrationTestCount).toBe(0);
    });

    it("finds test files in subdirectories", () => {
      mkdirSync(join(TEST_DIR, "tests", "sub"), { recursive: true });
      writeFileSync(join(TEST_DIR, "tests", "sub", "deep.test.ts"), 'it("deep", () => {});');
      const metrics = collectMetrics({
        testsDir: join(TEST_DIR, "tests"),
        outputsDir: join(TEST_DIR, "outputs"),
        workflowsDir: join(TEST_DIR, "workflows"),
      });
      expect(metrics.testFileCount).toBe(1);
      expect(metrics.testCount).toBe(1);
    });

    it("recognizes .spec.ts files as tests", () => {
      writeFileSync(join(TEST_DIR, "tests", "foo.spec.ts"), 'it("spec", () => {});');
      const metrics = collectMetrics({
        testsDir: join(TEST_DIR, "tests"),
        outputsDir: join(TEST_DIR, "outputs"),
        workflowsDir: join(TEST_DIR, "workflows"),
      });
      expect(metrics.testFileCount).toBe(1);
    });

    it("recognizes .test.js files as tests", () => {
      writeFileSync(join(TEST_DIR, "tests", "foo.test.js"), 'it("js", () => {});');
      const metrics = collectMetrics({
        testsDir: join(TEST_DIR, "tests"),
        outputsDir: join(TEST_DIR, "outputs"),
        workflowsDir: join(TEST_DIR, "workflows"),
      });
      expect(metrics.testFileCount).toBe(1);
    });

    it("does not count non-test files", () => {
      writeFileSync(join(TEST_DIR, "tests", "helper.ts"), "export const x = 1;");
      writeFileSync(join(TEST_DIR, "tests", "foo.test.ts"), 'it("x", () => {});');
      const metrics = collectMetrics({
        testsDir: join(TEST_DIR, "tests"),
        outputsDir: join(TEST_DIR, "outputs"),
        workflowsDir: join(TEST_DIR, "workflows"),
      });
      expect(metrics.testFileCount).toBe(1);
    });

    it("handles large number of files", () => {
      for (let i = 0; i < 50; i++) {
        writeFileSync(join(TEST_DIR, "tests", `test-${i}.test.ts`), `it("case ${i}", () => {});`);
      }
      const metrics = collectMetrics({
        testsDir: join(TEST_DIR, "tests"),
        outputsDir: join(TEST_DIR, "outputs"),
        workflowsDir: join(TEST_DIR, "workflows"),
      });
      expect(metrics.testFileCount).toBe(50);
      expect(metrics.testCount).toBe(50);
    });

    it("counts test() and it() separately", () => {
      writeFileSync(join(TEST_DIR, "tests", "mixed.test.ts"), 'it("a", () => {});\ntest("b", () => {});\nit("c", () => {});');
      const metrics = collectMetrics({
        testsDir: join(TEST_DIR, "tests"),
        outputsDir: join(TEST_DIR, "outputs"),
        workflowsDir: join(TEST_DIR, "workflows"),
      });
      expect(metrics.testCount).toBe(3);
    });

    it("returns correct structure shape", () => {
      const metrics = collectMetrics({
        testsDir: join(TEST_DIR, "tests"),
        outputsDir: join(TEST_DIR, "outputs"),
        workflowsDir: join(TEST_DIR, "workflows"),
      });
      expect(metrics).toHaveProperty("testCount");
      expect(metrics).toHaveProperty("testFileCount");
      expect(metrics).toHaveProperty("outputCount");
      expect(metrics).toHaveProperty("workflowModuleCount");
      expect(metrics).toHaveProperty("integrationTestCount");
    });
  });

  describe("formatMetrics", () => {
    it("returns a formatted string", () => {
      const result = formatMetrics({
        testCount: 100,
        testFileCount: 10,
        outputCount: 5,
        workflowModuleCount: 7,
        integrationTestCount: 3,
      });
      expect(result).toContain("100");
      expect(result).toContain("10");
      expect(result).toContain("5");
      expect(result).toContain("7");
      expect(result).toContain("3");
    });

    it("contains dashboard header", () => {
      const result = formatMetrics({
        testCount: 0,
        testFileCount: 0,
        outputCount: 0,
        workflowModuleCount: 0,
        integrationTestCount: 0,
      });
      expect(result).toContain("Dashboard");
    });

    it("handles large numbers", () => {
      const result = formatMetrics({
        testCount: 99999,
        testFileCount: 1000,
        outputCount: 500,
        workflowModuleCount: 50,
        integrationTestCount: 25,
      });
      expect(result).toContain("99999");
    });
  });
});
