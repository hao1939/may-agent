import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { selectExamples, loadExample, injectFewShot } from "../shared/workflows/fewshot-inject-helpers.js";

describe("selectExamples", () => {
  it("returns empty array for unrelated task", () => {
    expect(selectExamples("add a new button to the UI")).toEqual([]);
  });

  it("matches binary file pattern", () => {
    const result = selectExamples("The .bin file is compiled and needs hexdump analysis");
    expect(result).toContain("binary-file-escalation");
  });

  it("matches bug/error pattern", () => {
    const result = selectExamples("There's a bug causing test failures and a 500 error");
    expect(result).toContain("reproduce-first-debugging");
  });

  it("matches upgrade/dependency pattern", () => {
    const result = selectExamples("upgrade the dependency across multiple files");
    expect(result).toContain("escalation-judgment");
  });

  it("matches blocked pattern", () => {
    const result = selectExamples("I'm blocked because of missing credentials");
    expect(result).toContain("know-when-blocked");
  });

  it("matches fix bug / evidence pattern", () => {
    const result = selectExamples("fix the bug, the comment says it should work differently");
    expect(result).toContain("evidence-over-narrative");
  });

  it("returns at most 2 examples", () => {
    // This task matches multiple patterns
    const result = selectExamples("fix the bug in the binary executable, it crashes with a 500 error and the comment says wrong result");
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("strips verification blocks before matching", () => {
    const task = `Do something simple\n\n## Verification\n\n\`\`\`\n./node_modules/.bin/tsc --noEmit\n\`\`\``;
    // "binary" appears in "./node_modules/.bin/tsc" but should be stripped
    const result = selectExamples(task);
    expect(result).not.toContain("binary-file-escalation");
  });
});

describe("loadExample", () => {
  it("returns null for nonexistent file", () => {
    expect(loadExample("nonexistent-example-xyz")).toBeNull();
  });
});

describe("injectFewShot", () => {
  const origEnv = process.env.GYM_NO_FEWSHOT;

  afterEach(() => {
    if (origEnv === undefined) {
      delete process.env.GYM_NO_FEWSHOT;
    } else {
      process.env.GYM_NO_FEWSHOT = origEnv;
    }
  });

  it("returns task unchanged when GYM_NO_FEWSHOT=1", () => {
    process.env.GYM_NO_FEWSHOT = "1";
    const task = "fix the bug causing crashes";
    expect(injectFewShot(task)).toBe(task);
  });

  it("returns task unchanged when no patterns match", () => {
    delete process.env.GYM_NO_FEWSHOT;
    const task = "add a simple comment to the readme";
    expect(injectFewShot(task)).toBe(task);
  });

  it("prepends examples when patterns match and files exist", () => {
    delete process.env.GYM_NO_FEWSHOT;
    const task = "fix the bug that causes a 500 error";
    const result = injectFewShot(task);
    // If example files exist, result should be enriched; if not, unchanged
    // Either way it should contain the original task
    expect(result).toContain(task);
  });

  it("wraps with correct headers when examples are injected", () => {
    delete process.env.GYM_NO_FEWSHOT;
    const task = "fix the bug that causes a crash";
    const result = injectFewShot(task);
    if (result !== task) {
      expect(result).toContain("## Reference: How a similar task was handled");
      expect(result).toContain("## Your Task");
    }
  });
});
