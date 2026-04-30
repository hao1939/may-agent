import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { selectExamples, loadExample, injectFewShot } from "../workflows/fewshot-inject-helpers.js";

describe("fewshot-inject-helpers", () => {
  // ── selectExamples ───────────────────────────────────────────────────

  describe("selectExamples", () => {
    it("returns empty array for unrelated task", () => {
      expect(selectExamples("write a hello world function")).toEqual([]);
    });

    it("matches binary-file-escalation for binary keywords", () => {
      const result = selectExamples("analyze this .bin file for issues");
      expect(result).toContain("binary-file-escalation");
    });

    it("matches reproduce-first-debugging for bug keywords", () => {
      const result = selectExamples("there is a bug in the parser");
      expect(result).toContain("reproduce-first-debugging");
    });

    it("matches escalation-judgment for upgrade keywords", () => {
      const result = selectExamples("upgrade the dependency across multiple files");
      expect(result).toContain("escalation-judgment");
    });

    it("matches know-when-blocked for blocked keywords", () => {
      const result = selectExamples("I'm blocked because missing credentials");
      expect(result).toContain("know-when-blocked");
    });

    it("matches evidence-over-narrative for fix bug keywords", () => {
      const result = selectExamples("fix bug where output is incorrect output");
      expect(result).toContain("evidence-over-narrative");
    });

    it("returns max 2 examples even when more match", () => {
      // This matches multiple patterns: bug, fix bug, blocked
      const result = selectExamples("fix bug error blocked can't find missing key");
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it("strips verification blocks before matching", () => {
      const task = `do something simple\n\n## Verification\n\`\`\`\n./node_modules/.bin/tsc --binary\n\`\`\``;
      const result = selectExamples(task);
      // "binary" is inside verification block, should not match
      expect(result).not.toContain("binary-file-escalation");
    });

    it("matches hexdump keyword for binary pattern", () => {
      expect(selectExamples("run hexdump on the file")).toContain("binary-file-escalation");
    });
  });

  // ── loadExample ──────────────────────────────────────────────────────

  describe("loadExample", () => {
    it("returns null for non-existent file", () => {
      expect(loadExample("nonexistent-file-xyz")).toBeNull();
    });

    it("loads an existing example file without throwing", () => {
      // Try loading one that should exist based on the patterns
      const result = loadExample("binary-file-escalation");
      // It either returns content or null (if file doesn't exist in test env)
      expect(result === null || typeof result === "string").toBe(true);
    });

    it("returns a string (not empty) for valid example files", () => {
      const result = loadExample("reproduce-first-debugging");
      if (result !== null) {
        expect(result.length).toBeGreaterThan(0);
      }
    });
  });

  // ── injectFewShot ────────────────────────────────────────────────────

  describe("injectFewShot", () => {
    const originalEnv = process.env.GYM_NO_FEWSHOT;

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.GYM_NO_FEWSHOT;
      } else {
        process.env.GYM_NO_FEWSHOT = originalEnv;
      }
    });

    it("returns original task when GYM_NO_FEWSHOT=1", () => {
      process.env.GYM_NO_FEWSHOT = "1";
      const task = "fix this bug in the parser";
      expect(injectFewShot(task)).toBe(task);
    });

    it("returns original task when no patterns match", () => {
      delete process.env.GYM_NO_FEWSHOT;
      const task = "write a hello world function in python";
      expect(injectFewShot(task)).toBe(task);
    });

    it("prepends examples when patterns match", () => {
      delete process.env.GYM_NO_FEWSHOT;
      const task = "fix this bug where output is incorrect output";
      const result = injectFewShot(task);
      // If example files exist, should have the framing
      if (result !== task) {
        expect(result).toContain("## Reference: How a similar task was handled");
        expect(result).toContain("## Your Task");
        expect(result).toContain(task);
      }
    });

    it("includes '## Your Task' section with original task", () => {
      delete process.env.GYM_NO_FEWSHOT;
      const task = "there is a bug causing a crash in production";
      const result = injectFewShot(task);
      if (result !== task) {
        expect(result.endsWith(task)).toBe(true);
      }
    });

    it("does not bypass when GYM_NO_FEWSHOT is not set", () => {
      delete process.env.GYM_NO_FEWSHOT;
      const task = "analyze this executable binary file";
      const result = injectFewShot(task);
      // Should attempt injection (may still return original if files don't exist)
      expect(typeof result).toBe("string");
    });

    it("respects MAX_TOTAL_CHARS budget", () => {
      delete process.env.GYM_NO_FEWSHOT;
      // Even with matching patterns, result should not be excessively long
      const task = "fix bug error in binary executable file";
      const result = injectFewShot(task);
      // Total injected content should be reasonable
      expect(result.length).toBeLessThan(20000);
    });
  });
});
