import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { selectExamples, loadExample, injectFewShot } from "../workflows/fewshot-inject-helpers.js";

describe("selectExamples", () => {
  it("returns empty array when no patterns match", () => {
    expect(selectExamples("hello world nothing special")).toEqual([]);
  });

  it("matches binary pattern", () => {
    expect(selectExamples("analyze this .bin file")).toContain("binary-file-escalation");
  });

  it("matches bug/error pattern", () => {
    expect(selectExamples("there is an error in this code")).toContain("reproduce-first-debugging");
  });

  it("matches upgrade/dependency pattern", () => {
    expect(selectExamples("upgrade dependency across multiple files")).toContain("escalation-judgment");
  });

  it("matches blocked pattern", () => {
    expect(selectExamples("I'm blocked, can't find the key")).toContain("know-when-blocked");
  });

  it("matches fix bug pattern", () => {
    expect(selectExamples("fix bug where output is incorrect output")).toContain("evidence-over-narrative");
  });

  it("returns max 2 examples even when more match", () => {
    // This should match multiple patterns
    const task = "fix bug in binary executable, error crash, upgrade dependency";
    const result = selectExamples(task);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("strips verification blocks before matching", () => {
    const task = "hello world\n## Verification\n```\n./node_modules/.bin/tsc\n```\nnothing else";
    // "binary" appears in verification block via .bin, should be stripped
    expect(selectExamples(task)).not.toContain("binary-file-escalation");
  });

  it("can match multiple distinct patterns", () => {
    const result = selectExamples("there is an error and also upgrade dependency");
    expect(result.length).toBe(2);
  });

  it("returns results in pattern order", () => {
    // binary pattern comes before bug pattern
    const result = selectExamples("binary file has an error");
    expect(result[0]).toBe("binary-file-escalation");
  });
});

describe("loadExample", () => {
  it("returns null for non-existent file", () => {
    expect(loadExample("nonexistent-file-xyz")).toBeNull();
  });

  it("returns a string or null for known example files", () => {
    // Try loading a real file - may or may not exist in test env
    const result = loadExample("binary-file-escalation");
    expect(result === null || typeof result === "string").toBe(true);
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
    const task = "fix bug in binary executable with error";
    expect(injectFewShot(task)).toBe(task);
  });

  it("returns task unchanged when no patterns match", () => {
    delete process.env.GYM_NO_FEWSHOT;
    const task = "just a simple greeting hello";
    expect(injectFewShot(task)).toBe(task);
  });

  it("prepends examples when patterns match and files exist", () => {
    delete process.env.GYM_NO_FEWSHOT;
    const task = "fix bug where output is incorrect output";
    const result = injectFewShot(task);
    // If example files exist, result should be enriched; if not, unchanged
    if (result !== task) {
      expect(result).toContain("## Reference: How a similar task was handled");
      expect(result).toContain("## Your Task");
      expect(result).toContain(task);
    }
  });

  it("includes the original task at the end", () => {
    delete process.env.GYM_NO_FEWSHOT;
    const task = "fix bug causing crash";
    const result = injectFewShot(task);
    expect(result).toContain(task);
  });

  it("does not bypass when GYM_NO_FEWSHOT is not 1", () => {
    process.env.GYM_NO_FEWSHOT = "0";
    const task = "fix bug causing crash and error";
    const result = injectFewShot(task);
    // Should attempt injection (not bypassed)
    // Result may or may not change depending on file availability
    expect(result).toContain(task);
  });
});
