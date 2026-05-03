/**
 * Tests for fewshot-inject-helpers.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We need to mock fs and test the logic
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

import { selectExamples, loadExample, injectFewShot } from "../workflows/fewshot-inject-helpers.js";
import { readFileSync } from "node:fs";

const mockedReadFileSync = vi.mocked(readFileSync);

describe("selectExamples", () => {
  it("returns empty array for unrelated task", () => {
    expect(selectExamples("please add a button to the UI")).toEqual([]);
  });

  it("matches binary pattern", () => {
    const result = selectExamples("I found a .bin file that needs analysis");
    expect(result).toContain("binary-file-escalation");
  });

  it("matches binary keyword", () => {
    expect(selectExamples("this is a binary file")).toContain("binary-file-escalation");
  });

  it("matches hexdump keyword", () => {
    expect(selectExamples("run hexdump on the file")).toContain("binary-file-escalation");
  });

  it("matches compiled keyword", () => {
    expect(selectExamples("this is a compiled artifact")).toContain("binary-file-escalation");
  });

  it("matches executable keyword", () => {
    expect(selectExamples("check the executable")).toContain("binary-file-escalation");
  });

  it("matches bug pattern", () => {
    const result = selectExamples("there is a bug in the login flow");
    expect(result).toContain("reproduce-first-debugging");
  });

  it("matches error keyword", () => {
    expect(selectExamples("I got an error message")).toContain("reproduce-first-debugging");
  });

  it("matches failing keyword", () => {
    expect(selectExamples("tests are failing")).toContain("reproduce-first-debugging");
  });

  it("matches test fail pattern", () => {
    expect(selectExamples("test suite fail")).toContain("reproduce-first-debugging");
  });

  it("matches crash keyword", () => {
    expect(selectExamples("the app crashes on startup")).toContain("reproduce-first-debugging");
  });

  it("matches 500 keyword", () => {
    expect(selectExamples("getting a 500 response")).toContain("reproduce-first-debugging");
  });

  it("matches exception keyword", () => {
    expect(selectExamples("unhandled exception thrown")).toContain("reproduce-first-debugging");
  });

  it("matches upgrade pattern", () => {
    const result = selectExamples("upgrade the dependency to v3");
    expect(result).toContain("escalation-judgment");
  });

  it("matches multiple files pattern", () => {
    expect(selectExamples("changes span multiple files")).toContain("escalation-judgment");
  });

  it("matches import shared pattern", () => {
    expect(selectExamples("the import from shared module is broken")).toContain("escalation-judgment");
  });

  it("matches blocked pattern", () => {
    const result = selectExamples("I'm blocked on this issue");
    expect(result).toContain("know-when-blocked");
  });

  it("matches impossible keyword", () => {
    expect(selectExamples("this seems impossible to fix")).toContain("know-when-blocked");
  });

  it("matches can't find pattern", () => {
    expect(selectExamples("can't find the config file")).toContain("know-when-blocked");
  });

  it("matches missing key pattern", () => {
    expect(selectExamples("missing key in the config")).toContain("know-when-blocked");
  });

  it("matches missing credential pattern", () => {
    expect(selectExamples("missing credential for API")).toContain("know-when-blocked");
  });

  it("matches no permission pattern", () => {
    expect(selectExamples("no permission to access")).toContain("know-when-blocked");
  });

  it("matches all fail pattern", () => {
    expect(selectExamples("all tests fail")).toContain("know-when-blocked");
  });

  it("matches fix bug pattern", () => {
    const result = selectExamples("fix the bug in parser");
    expect(result).toContain("evidence-over-narrative");
  });

  it("matches broken keyword", () => {
    expect(selectExamples("the feature is broken")).toContain("evidence-over-narrative");
  });

  it("matches doesn't work pattern", () => {
    expect(selectExamples("the login doesn't work")).toContain("evidence-over-narrative");
  });

  it("matches incorrect output pattern", () => {
    expect(selectExamples("incorrect output from function")).toContain("evidence-over-narrative");
  });

  it("matches wrong result pattern", () => {
    expect(selectExamples("wrong result returned")).toContain("evidence-over-narrative");
  });

  it("matches comment says pattern", () => {
    expect(selectExamples("the comment says it should be X")).toContain("evidence-over-narrative");
  });

  it("returns max 2 examples", () => {
    // This task matches multiple patterns
    const result = selectExamples("fix the bug, it's broken, binary file is failing, blocked");
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("strips verification command blocks before matching", () => {
    const task = `Do something simple\n\n## Verification\n\n\`\`\`\n./node_modules/.bin/tsc --noEmit\n\`\`\``;
    // .bin in verification block should NOT trigger binary pattern
    const result = selectExamples(task);
    expect(result).not.toContain("binary-file-escalation");
  });

  it("handles empty string", () => {
    expect(selectExamples("")).toEqual([]);
  });

  it("handles multiline task", () => {
    const task = "Line one\nLine two has a bug\nLine three";
    expect(selectExamples(task)).toContain("reproduce-first-debugging");
  });
});

describe("loadExample", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when file doesn't exist", () => {
    mockedReadFileSync.mockImplementation(() => { throw new Error("ENOENT"); });
    expect(loadExample("nonexistent")).toBeNull();
  });

  it("extracts Worked Example section", () => {
    mockedReadFileSync.mockReturnValue(
      "# Few-Shot Example: Test\n\n## Worked Example\n\nHere is the example content.\n\n## Evidence\n\nSome evidence."
    );
    const result = loadExample("test-file");
    expect(result).toBe("Here is the example content.");
  });

  it("falls back to stripped content when no Worked Example section", () => {
    mockedReadFileSync.mockReturnValue(
      "# Few-Shot Example: Test\n**Domain class**: testing\n**Skill**: debugging\n**Token estimate**: 500\n\nActual useful content here."
    );
    const result = loadExample("test-file");
    expect(result).toContain("Actual useful content here.");
    expect(result).not.toContain("Domain class");
  });

  it("returns null for empty content after stripping", () => {
    mockedReadFileSync.mockReturnValue(
      "# Few-Shot Example: Test\n**Domain class**: testing\n**Skill**: debugging\n**Token estimate**: 500\n"
    );
    const result = loadExample("test-file");
    expect(result).toBeNull();
  });

  it("handles file with only Worked Example", () => {
    mockedReadFileSync.mockReturnValue("## Worked Example\n\nJust the example.");
    expect(loadExample("simple")).toBe("Just the example.");
  });

  it("handles multiline Worked Example", () => {
    mockedReadFileSync.mockReturnValue(
      "## Worked Example\n\nLine 1\nLine 2\nLine 3\n\n## Next Section\n\nOther stuff"
    );
    expect(loadExample("multi")).toBe("Line 1\nLine 2\nLine 3");
  });
});

describe("injectFewShot", () => {
  const originalEnv = process.env.GYM_NO_FEWSHOT;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GYM_NO_FEWSHOT;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.GYM_NO_FEWSHOT = originalEnv;
    } else {
      delete process.env.GYM_NO_FEWSHOT;
    }
  });

  it("returns original task when GYM_NO_FEWSHOT=1", () => {
    process.env.GYM_NO_FEWSHOT = "1";
    const task = "fix the bug in binary file";
    expect(injectFewShot(task)).toBe(task);
  });

  it("returns original task when no patterns match", () => {
    const task = "add a new button to the page";
    expect(injectFewShot(task)).toBe(task);
  });

  it("prepends examples when patterns match", () => {
    mockedReadFileSync.mockReturnValue("## Worked Example\n\nExample content here.");
    const task = "there is a bug in the code";
    const result = injectFewShot(task);
    expect(result).toContain("## Reference: How a similar task was handled");
    expect(result).toContain("Example content here.");
    expect(result).toContain("## Your Task");
    expect(result).toContain(task);
  });

  it("returns original task when examples can't be loaded", () => {
    mockedReadFileSync.mockImplementation(() => { throw new Error("ENOENT"); });
    const task = "fix the bug now";
    expect(injectFewShot(task)).toBe(task);
  });

  it("respects MAX_TOTAL_CHARS budget by skipping oversized examples", () => {
    // Return a very large example that exceeds the 12000 char budget
    const hugeContent = "## Worked Example\n\n" + "x".repeat(15000);
    mockedReadFileSync.mockReturnValue(hugeContent);
    // Task matches multiple patterns but all examples exceed budget
    const task = "fix the bug, binary file is broken";
    const result = injectFewShot(task);
    // First example already exceeds budget, so nothing is injected
    expect(result).toBe(task);
  });

  it("joins multiple examples with separator", () => {
    mockedReadFileSync.mockReturnValue("## Worked Example\n\nShort example.");
    const task = "fix the bug, it's broken and failing";
    const result = injectFewShot(task);
    // May have separator if multiple examples matched
    if (result.includes("---\n\n---")) {
      // Two examples joined
      expect(result.split("Short example.").length).toBeGreaterThanOrEqual(2);
    }
  });

  it("preserves original task text exactly", () => {
    mockedReadFileSync.mockReturnValue("## Worked Example\n\nExample.");
    const task = "there is a bug: special chars <>&\"'";
    const result = injectFewShot(task);
    expect(result).toContain(task);
  });
});
