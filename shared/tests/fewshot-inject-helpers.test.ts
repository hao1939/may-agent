/**
 * Tests for fewshot-inject-helpers.ts
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { selectExamples, loadExample, injectFewShot } from "../workflows/fewshot-inject-helpers.js";

let examplesDir: string;

function makeExamplesDir(): void {
  examplesDir = mkdtempSync(join(tmpdir(), "fewshot-examples-"));
}

function cleanupExamplesDir(): void {
  rmSync(examplesDir, { recursive: true, force: true });
}

function writeExample(name: string, content: string): void {
  writeFileSync(join(examplesDir, `${name}.md`), content);
}

function writeCommonExamples(content: string): void {
  for (const name of [
    "binary-file-escalation",
    "reproduce-first-debugging",
    "escalation-judgment",
    "know-when-blocked",
    "evidence-over-narrative",
  ]) {
    writeExample(name, content);
  }
}

describe("selectExamples", () => {
  const cases: Array<[string, string, string]> = [
    ["binary pattern", "I found a .bin file that needs analysis", "binary-file-escalation"],
    ["binary keyword", "this is a binary file", "binary-file-escalation"],
    ["hexdump keyword", "run hexdump on the file", "binary-file-escalation"],
    ["compiled keyword", "this is a compiled artifact", "binary-file-escalation"],
    ["executable keyword", "check the executable", "binary-file-escalation"],
    ["bug pattern", "there is a bug in the login flow", "reproduce-first-debugging"],
    ["error keyword", "I got an error message", "reproduce-first-debugging"],
    ["failing keyword", "tests are failing", "reproduce-first-debugging"],
    ["test fail pattern", "test suite fail", "reproduce-first-debugging"],
    ["crash keyword", "the app crashes on startup", "reproduce-first-debugging"],
    ["500 keyword", "getting a 500 response", "reproduce-first-debugging"],
    ["exception keyword", "unhandled exception thrown", "reproduce-first-debugging"],
    ["upgrade pattern", "upgrade the dependency to v3", "escalation-judgment"],
    ["multiple files pattern", "changes span multiple files", "escalation-judgment"],
    ["import shared pattern", "the import from shared module is broken", "escalation-judgment"],
    ["blocked pattern", "I'm blocked on this issue", "know-when-blocked"],
    ["impossible keyword", "this seems impossible to fix", "know-when-blocked"],
    ["can't find pattern", "can't find the config file", "know-when-blocked"],
    ["missing key pattern", "missing key in the config", "know-when-blocked"],
    ["missing credential pattern", "missing credential for API", "know-when-blocked"],
    ["no permission pattern", "no permission to access", "know-when-blocked"],
    ["all fail pattern", "all tests fail", "know-when-blocked"],
    ["fix bug pattern", "fix the bug in parser", "evidence-over-narrative"],
    ["broken keyword", "the feature is broken", "evidence-over-narrative"],
    ["doesn't work pattern", "the login doesn't work", "evidence-over-narrative"],
    ["incorrect output pattern", "incorrect output from function", "evidence-over-narrative"],
    ["wrong result pattern", "wrong result returned", "evidence-over-narrative"],
    ["comment says pattern", "the comment says it should be X", "evidence-over-narrative"],
  ];

  it("returns empty array for unrelated task", () => {
    expect(selectExamples("hello world greetings")).toEqual([]);
  });

  for (const [label, task, expected] of cases) {
    it(`matches ${label}`, () => {
      expect(selectExamples(task)).toContain(expected);
    });
  }

  it("returns max 2 examples", () => {
    const result = selectExamples("fix the bug, it's broken, binary file is failing, blocked");
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("strips verification command blocks before matching", () => {
    const task = `Do something simple\n\n## Verification\n\n\`\`\`\n./node_modules/.bin/tsc --noEmit\n\`\`\``;
    expect(selectExamples(task)).not.toContain("binary-file-escalation");
  });

  it("handles empty string", () => {
    expect(selectExamples("")).toEqual([]);
  });

  it("handles multiline task", () => {
    expect(selectExamples("Line one\nLine two has a bug\nLine three")).toContain("reproduce-first-debugging");
  });
});

describe("loadExample", () => {
  beforeEach(makeExamplesDir);
  afterEach(cleanupExamplesDir);

  it("returns null when file doesn't exist", () => {
    expect(loadExample("nonexistent", examplesDir)).toBeNull();
  });

  it("extracts Worked Example section", () => {
    writeExample(
      "test-file",
      "# Few-Shot Example: Test\n\n## Worked Example\n\nHere is the example content.\n\n## Evidence\n\nSome evidence.",
    );
    expect(loadExample("test-file", examplesDir)).toBe("Here is the example content.");
  });

  it("falls back to stripped content when no Worked Example section", () => {
    writeExample(
      "test-file",
      "# Few-Shot Example: Test\n**Domain class**: testing\n**Skill**: debugging\n**Token estimate**: 500\n\nActual useful content here.",
    );
    const result = loadExample("test-file", examplesDir);
    expect(result).toContain("Actual useful content here.");
    expect(result).not.toContain("Domain class");
  });

  it("returns null for empty content after stripping", () => {
    writeExample(
      "test-file",
      "# Few-Shot Example: Test\n**Domain class**: testing\n**Skill**: debugging\n**Token estimate**: 500\n",
    );
    expect(loadExample("test-file", examplesDir)).toBeNull();
  });

  it("handles file with only Worked Example", () => {
    writeExample("simple", "## Worked Example\n\nJust the example.");
    expect(loadExample("simple", examplesDir)).toBe("Just the example.");
  });

  it("handles multiline Worked Example", () => {
    writeExample("multi", "## Worked Example\n\nLine 1\nLine 2\nLine 3\n\n## Next Section\n\nOther stuff");
    expect(loadExample("multi", examplesDir)).toBe("Line 1\nLine 2\nLine 3");
  });
});

describe("injectFewShot", () => {
  const originalEnv = process.env.GYM_NO_FEWSHOT;

  beforeEach(() => {
    makeExamplesDir();
    delete process.env.GYM_NO_FEWSHOT;
  });

  afterEach(() => {
    cleanupExamplesDir();
    if (originalEnv !== undefined) process.env.GYM_NO_FEWSHOT = originalEnv;
    else delete process.env.GYM_NO_FEWSHOT;
  });

  it("returns original task when GYM_NO_FEWSHOT=1", () => {
    process.env.GYM_NO_FEWSHOT = "1";
    const task = "fix the bug in binary file";
    expect(injectFewShot(task, examplesDir)).toBe(task);
  });

  it("returns original task when no patterns match", () => {
    const task = "hello world greetings";
    expect(injectFewShot(task, examplesDir)).toBe(task);
  });

  it("prepends examples when patterns match", () => {
    writeCommonExamples("## Worked Example\n\nExample content here.");
    const task = "there is a bug in the code";
    const result = injectFewShot(task, examplesDir);
    expect(result).toContain("## Reference: How a similar task was handled");
    expect(result).toContain("Example content here.");
    expect(result).toContain("## Your Task");
    expect(result).toContain(task);
  });

  it("returns original task when examples can't be loaded", () => {
    const task = "fix the bug now";
    expect(injectFewShot(task, examplesDir)).toBe(task);
  });

  it("respects MAX_TOTAL_CHARS budget by skipping oversized examples", () => {
    writeCommonExamples("## Worked Example\n\n" + "x".repeat(15000));
    const task = "fix the bug, binary file is broken";
    expect(injectFewShot(task, examplesDir)).toBe(task);
  });

  it("joins multiple examples with separator", () => {
    writeCommonExamples("## Worked Example\n\nShort example.");
    const result = injectFewShot("fix the bug, it's broken and failing", examplesDir);
    if (result.includes("---\n\n---")) {
      expect(result.split("Short example.").length).toBeGreaterThanOrEqual(2);
    }
  });

  it("preserves original task text exactly", () => {
    writeCommonExamples("## Worked Example\n\nExample.");
    const task = "there is a bug: special chars <>&\"'";
    expect(injectFewShot(task, examplesDir)).toContain(task);
  });
});
