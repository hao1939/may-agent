import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateTask,
  checkFileExistence,
  checkOutputDirectory,
  checkToolAvailability,
  estimateComplexity,
  estimateFileOperations,
  extractReferencedFiles,
  isDuplicateTask,
} from "../workflows/task-validator.ts";

describe("task-validator uncovered branches", () => {
  describe("validateTask - all referenced files missing", () => {
    it("fails when all referenced read-files are missing", () => {
      const task = "read and review `/nonexistent/foo.ts` and `/nonexistent/bar.ts` files";
      const result = validateTask(task, {
        workingDir: "/tmp",
        recentTasks: [],
        availableTools: ["node", "npx", "git"],
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("None of the referenced files exist");
    });

    it("warns but passes when some referenced files missing in read task", () => {
      const task = "read and check `/tmp/existing.ts` and `/nonexistent/missing.ts` please";
      // Create the existing file
      const { writeFileSync, unlinkSync } = require("fs");
      const existingPath = "/tmp/existing-tv-test-" + Date.now() + ".ts";
      writeFileSync(existingPath, "test");
      try {
        const result = validateTask(`read and check \`${existingPath}\` and \`/nonexistent/missing.ts\` please`, {
          workingDir: "/tmp",
          recentTasks: [],
          availableTools: ["node", "npx", "git"],
        });
        expect(result.valid).toBe(true);
        expect(result.warnings).toBeDefined();
      } finally {
        unlinkSync(existingPath);
      }
    });
  });

  describe("validateTask - missing tools warning", () => {
    it("warns when task mentions vitest but vitest not in available tools", () => {
      const result = validateTask("run vitest to check tests", {
        workingDir: "/tmp",
        availableTools: ["node", "git"],
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes("vitest"))).toBe(true);
    });

    it("warns about tsc when unavailable", () => {
      const result = validateTask("run tsc to compile the project", {
        workingDir: "/tmp",
        availableTools: ["node"],
      });
      expect(result.valid).toBe(true);
      expect(result.warnings?.some(w => w.includes("tsc"))).toBe(true);
    });
  });

  describe("validateTask - output directory check", () => {
    it("warns when output directory doesn't exist for write task", () => {
      const result = validateTask("create `/nonexistent-dir-abc123/output.ts` with the code", {
        workingDir: "/tmp",
        availableTools: ["node", "npx", "git"],
      });
      expect(result.valid).toBe(true);
      expect(result.warnings?.some(w => w.includes("Output directory"))).toBe(true);
    });
  });

  describe("validateTask - high complexity warning", () => {
    it("warns when task has high complexity", () => {
      const task = "1) read and write the main file, 2) create and generate the test, 3) edit and modify the config, 4) check and verify the output, 5) review and update the docs then also add finally change something else after that next step";
      const result = validateTask(task, {
        workingDir: "/tmp",
        availableTools: ["node", "npx", "git"],
        maxFileOps: 50,
      });
      expect(result.estimatedComplexity).toBe("high");
      expect(result.warnings?.some(w => w.includes("high estimated complexity"))).toBe(true);
    });
  });

  describe("checkToolAvailability - various tools", () => {
    it("detects missing prettier", () => {
      const missing = checkToolAvailability("format with prettier", []);
      expect(missing).toContain("prettier");
    });

    it("detects missing eslint", () => {
      const missing = checkToolAvailability("run eslint check", []);
      expect(missing).toContain("eslint");
    });

    it("detects missing jq", () => {
      const missing = checkToolAvailability("parse with jq", []);
      expect(missing).toContain("jq");
    });

    it("returns empty when all tools available", () => {
      const missing = checkToolAvailability("run vitest", ["vitest"]);
      expect(missing).toEqual([]);
    });
  });

  describe("estimateComplexity edge cases", () => {
    it("returns low for simple tasks", () => {
      expect(estimateComplexity("fix bug")).toBe("low");
    });

    it("returns medium for moderate tasks", () => {
      const task = "read the file then write the test and also create the mock after checking the output. 1) first step 2) second step";
      expect(estimateComplexity(task)).toBe("medium");
    });

    it("returns high for complex tasks", () => {
      const longTask = "A ".repeat(150) + "then after next finally also 1) step 2) step 3) step 4) step. write create generate read check verify edit modify";
      expect(estimateComplexity(longTask)).toBe("high");
    });
  });
});
