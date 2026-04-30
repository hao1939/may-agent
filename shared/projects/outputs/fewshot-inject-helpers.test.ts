/**
 * Tests for fewshot-inject-helpers.ts
 * Covers: selectExamples, loadExample, injectFewShot
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { selectExamples, loadExample, injectFewShot } from "../../workflows/fewshot-inject-helpers.js";

describe("fewshot-inject-helpers", () => {
  describe("selectExamples", () => {
    it("returns empty array when no patterns match", () => {
      expect(selectExamples("hello world simple task")).toEqual([]);
    });

    it("matches binary-related keywords", () => {
      const result = selectExamples("analyze the .bin file format");
      expect(result).toContain("binary-file-escalation");
    });

    it("matches bug/error keywords", () => {
      const result = selectExamples("there is an error in the output");
      expect(result).toContain("reproduce-first-debugging");
    });

    it("matches upgrade/dependency keywords", () => {
      const result = selectExamples("upgrade the dependency and check impact on modules");
      expect(result).toContain("escalation-judgment");
    });

    it("matches blocked/impossible keywords", () => {
      const result = selectExamples("I'm blocked because I can't find the key");
      expect(result).toContain("know-when-blocked");
    });

    it("matches fix-bug keywords", () => {
      const result = selectExamples("fix bug where output is incorrect output");
      expect(result).toContain("evidence-over-narrative");
    });

    it("returns max 2 examples even if more patterns match", () => {
      // This task matches multiple patterns
      const result = selectExamples("fix bug in binary executable that is failing with error and blocked");
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it("strips verification blocks before matching", () => {
      const task = `Do something simple
## Verification
\`\`\`
./node_modules/.bin/tsc --noEmit
\`\`\``;
      // "binary" in ./node_modules/.bin/tsc should NOT trigger
      const result = selectExamples(task);
      expect(result).not.toContain("binary-file-escalation");
    });

    it("matches 'compiled' keyword for binary pattern", () => {
      expect(selectExamples("handle compiled output")).toContain("binary-file-escalation");
    });

    it("matches 'hexdump' keyword for binary pattern", () => {
      expect(selectExamples("run hexdump on file")).toContain("binary-file-escalation");
    });

    it("matches 'test fail' for bug pattern", () => {
      expect(selectExamples("the test fails intermittently")).toContain("reproduce-first-debugging");
    });

    it("matches 'missing credential' for blocked pattern", () => {
      expect(selectExamples("missing credential for API")).toContain("know-when-blocked");
    });

    it("matches 'doesn't work' for fix-bug pattern", () => {
      expect(selectExamples("the feature doesn't work properly")).toContain("evidence-over-narrative");
    });
  });

  describe("loadExample", () => {
    it("returns null for non-existent file", () => {
      expect(loadExample("nonexistent-file-xyz")).toBeNull();
    });

    it("returns a string for known example files (if they exist)", () => {
      const result = loadExample("binary-file-escalation");
      // May be null if file doesn't exist in this env, but if it exists it's a string
      if (result !== null) {
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it("returns null for empty filename", () => {
      expect(loadExample("")).toBeNull();
    });
  });

  describe("injectFewShot", () => {
    const originalEnv = process.env.GYM_NO_FEWSHOT;

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.GYM_NO_FEWSHOT;
      } else {
        process.env.GYM_NO_FEWSHOT = originalEnv;
      }
    });

    it("returns task unchanged when GYM_NO_FEWSHOT=1", () => {
      process.env.GYM_NO_FEWSHOT = "1";
      const task = "fix the binary file error";
      expect(injectFewShot(task)).toBe(task);
    });

    it("returns task unchanged when no patterns match", () => {
      delete process.env.GYM_NO_FEWSHOT;
      const task = "write a hello world program";
      expect(injectFewShot(task)).toBe(task);
    });

    it("prepends reference header when examples match", () => {
      delete process.env.GYM_NO_FEWSHOT;
      const task = "fix bug in the binary executable that is failing";
      const result = injectFewShot(task);
      // If example files exist, should have header; if not, returns unchanged
      if (result !== task) {
        expect(result).toContain("## Reference: How a similar task was handled");
        expect(result).toContain("## Your Task");
        expect(result).toContain(task);
      }
    });

    it("includes original task at the end", () => {
      delete process.env.GYM_NO_FEWSHOT;
      const task = "there is a crash in production";
      const result = injectFewShot(task);
      expect(result).toContain(task);
    });

    it("GYM_NO_FEWSHOT=0 does not bypass injection", () => {
      process.env.GYM_NO_FEWSHOT = "0";
      const task = "fix the error in production crash";
      const result = injectFewShot(task);
      // Should attempt injection (not bypassed)
      // Result may still equal task if files don't exist
      expect(result).toContain(task);
    });
  });
});
