import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  routeFewShotExamples,
  loadFewShotExamples,
  matchFewShotExamples,
  formatFewShotInjection,
  clearFewShotCache,
} from "../src/lib/fewshot-router.js";

// ── Test fixtures ───────────────────────────────────────────────

const TEST_ROOT = join(process.cwd(), ".test-fewshot-" + process.pid);
const EXAMPLES_DIR = join(TEST_ROOT, "agents", "shared", "knowledge", "fewshot-examples");

const EXAMPLE_BINARY = `# Few-Shot Example: Binary File Escalation

**Domain class**: Binary/compiled file tasks
**Token estimate**: ~460 tokens

## Trigger Patterns

\`\`\`regex
/binary|\\.bin|compiled|executable|hexdump/i
\`\`\`

## Worked Example

> An engineer was asked to fix a compiled binary file.
> The engineer recognized it was binary and reported blocked.

## Evidence

EXP-094: 3/3 pass
`;

const EXAMPLE_DEBUGGING = `# Few-Shot Example: Reproduce-First Debugging

**Domain class**: Bug/error debugging tasks
**Token estimate**: ~520 tokens

## Trigger Patterns

\`\`\`regex
/bug|error|failing|test.*fail|crash|500|exception/i
\`\`\`

## Worked Example

> An engineer was asked to fix a crashing endpoint.
> The engineer reproduced first, then found the root cause.

## Evidence

EXP-091: 3/3 pass
`;

const EXAMPLE_ESCALATION = `# Few-Shot Example: Escalation Judgment

**Domain class**: Dependency/multi-module impact
**Token estimate**: ~260 tokens

## Trigger Patterns

\`\`\`regex
/upgrade|dependency|multiple.*(file|module)|impact|consumer|import.*shared/i
\`\`\`

## Worked Example

> An engineer was asked to upgrade a shared module.
> The engineer traced all consumers before making changes.

## Evidence

EXP-085: 3/3 pass
`;

// A fourth example for testing the max-2 limit
const EXAMPLE_BLOCKED = `# Few-Shot Example: Know When Blocked

**Domain class**: Unresolvable blockers
**Token estimate**: ~480 tokens

## Trigger Patterns

\`\`\`regex
/blocked|impossible|can'?t.*find|missing.*key|binary.*file/i
\`\`\`

## Worked Example

> An engineer recognized an impossible task and reported blocked immediately.

## Evidence

EXP-090: 3/3 pass
`;

// ── Setup / teardown ────────────────────────────────────────────

function setupExamples(files: Record<string, string>): void {
  mkdirSync(EXAMPLES_DIR, { recursive: true });
  // Write INDEX.md (always excluded from loading)
  writeFileSync(join(EXAMPLES_DIR, "INDEX.md"), "# Index\n");
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(EXAMPLES_DIR, name), content);
  }
}

describe("fewshot-router", () => {
  beforeEach(() => {
    clearFewShotCache();
  });

  afterEach(() => {
    clearFewShotCache();
    try {
      rmSync(TEST_ROOT, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  // ── Agent eligibility ───────────────────────────────────────

  describe("agent scope restriction", () => {
    it("returns null for non-target agents (tech-lead)", () => {
      setupExamples({ "binary-file-escalation.md": EXAMPLE_BINARY });
      const result = routeFewShotExamples("Fix the binary file", "tech-lead", TEST_ROOT);
      expect(result.content).toBeNull();
      expect(result.matchedFiles).toEqual([]);
    });

    it("returns null for non-target agents (may)", () => {
      setupExamples({ "binary-file-escalation.md": EXAMPLE_BINARY });
      const result = routeFewShotExamples("Fix the binary file", "may", TEST_ROOT);
      expect(result.content).toBeNull();
    });

    it("returns null for non-target agents (bob)", () => {
      setupExamples({ "binary-file-escalation.md": EXAMPLE_BINARY });
      const result = routeFewShotExamples("Fix the binary file", "bob", TEST_ROOT);
      expect(result.content).toBeNull();
    });

    it("returns null for non-target agents (coach)", () => {
      setupExamples({ "binary-file-escalation.md": EXAMPLE_BINARY });
      const result = routeFewShotExamples("Fix the binary file", "coach", TEST_ROOT);
      expect(result.content).toBeNull();
    });

    it("returns null for non-target agents (evaluator)", () => {
      setupExamples({ "binary-file-escalation.md": EXAMPLE_BINARY });
      const result = routeFewShotExamples("Fix the binary file", "evaluator", TEST_ROOT);
      expect(result.content).toBeNull();
    });

    it("returns content for coder agent", () => {
      setupExamples({ "binary-file-escalation.md": EXAMPLE_BINARY });
      const result = routeFewShotExamples("Fix the binary file", "coder", TEST_ROOT);
      expect(result.content).not.toBeNull();
      expect(result.matchedFiles).toContain("binary-file-escalation");
    });

    it("returns content for optimizer agent", () => {
      setupExamples({ "binary-file-escalation.md": EXAMPLE_BINARY });
      const result = routeFewShotExamples("Fix the binary file", "optimizer", TEST_ROOT);
      expect(result.content).not.toBeNull();
      expect(result.matchedFiles).toContain("binary-file-escalation");
    });
  });

  // ── Pattern matching ────────────────────────────────────────

  describe("trigger pattern matching", () => {
    it("matches binary file task → binary-file-escalation example", () => {
      setupExamples({
        "binary-file-escalation.md": EXAMPLE_BINARY,
        "reproduce-first-debugging.md": EXAMPLE_DEBUGGING,
      });
      const result = routeFewShotExamples(
        "The data-processor.bin file seems corrupted",
        "coder",
        TEST_ROOT,
      );
      expect(result.matchedFiles).toContain("binary-file-escalation");
    });

    it("matches debugging task → reproduce-first-debugging example", () => {
      setupExamples({
        "binary-file-escalation.md": EXAMPLE_BINARY,
        "reproduce-first-debugging.md": EXAMPLE_DEBUGGING,
      });
      const result = routeFewShotExamples(
        "The API endpoint is crashing with a 500 error",
        "coder",
        TEST_ROOT,
      );
      expect(result.matchedFiles).toContain("reproduce-first-debugging");
    });

    it("matches escalation task → escalation-judgment example", () => {
      setupExamples({
        "escalation-judgment.md": EXAMPLE_ESCALATION,
        "reproduce-first-debugging.md": EXAMPLE_DEBUGGING,
      });
      const result = routeFewShotExamples(
        "Upgrade the shared dependency and check all consumers",
        "coder",
        TEST_ROOT,
      );
      expect(result.matchedFiles).toContain("escalation-judgment");
    });

    it("returns null when no pattern matches", () => {
      setupExamples({
        "binary-file-escalation.md": EXAMPLE_BINARY,
        "reproduce-first-debugging.md": EXAMPLE_DEBUGGING,
      });
      const result = routeFewShotExamples(
        "Write a new feature for user profile display",
        "coder",
        TEST_ROOT,
      );
      expect(result.content).toBeNull();
      expect(result.matchedFiles).toEqual([]);
    });

    it("matches case-insensitively", () => {
      setupExamples({ "binary-file-escalation.md": EXAMPLE_BINARY });
      const result = routeFewShotExamples(
        "Fix the BINARY FILE issue",
        "coder",
        TEST_ROOT,
      );
      expect(result.matchedFiles).toContain("binary-file-escalation");
    });
  });

  // ── Multiple matches and limits ──────────────────────────────

  describe("max examples limit", () => {
    it("returns max 2 examples when multiple patterns match", () => {
      setupExamples({
        "binary-file-escalation.md": EXAMPLE_BINARY,
        "reproduce-first-debugging.md": EXAMPLE_DEBUGGING,
        "know-when-blocked.md": EXAMPLE_BLOCKED,
      });
      // "binary file" matches binary-file-escalation AND know-when-blocked
      // "error" matches reproduce-first-debugging
      const result = routeFewShotExamples(
        "The binary file has an error and we are blocked",
        "coder",
        TEST_ROOT,
      );
      expect(result.matchedFiles.length).toBeLessThanOrEqual(2);
      expect(result.content).not.toBeNull();
    });

    it("returns multiple matched files", () => {
      setupExamples({
        "binary-file-escalation.md": EXAMPLE_BINARY,
        "reproduce-first-debugging.md": EXAMPLE_DEBUGGING,
      });
      // "binary" matches binary example, "error" matches debugging example
      const result = routeFewShotExamples(
        "The binary file has an error",
        "coder",
        TEST_ROOT,
      );
      expect(result.matchedFiles.length).toBe(2);
    });
  });

  // ── Formatting ──────────────────────────────────────────────

  describe("output formatting", () => {
    it("wraps content with reference heading", () => {
      setupExamples({ "binary-file-escalation.md": EXAMPLE_BINARY });
      const result = routeFewShotExamples("Fix the binary file", "coder", TEST_ROOT);
      expect(result.content).toContain("## Reference: How a similar task was handled");
      expect(result.content).toContain("engineer");
    });

    it("includes separator between multiple examples", () => {
      setupExamples({
        "binary-file-escalation.md": EXAMPLE_BINARY,
        "reproduce-first-debugging.md": EXAMPLE_DEBUGGING,
      });
      const result = routeFewShotExamples(
        "The binary file has an error",
        "coder",
        TEST_ROOT,
      );
      // Two examples separated by ---
      expect(result.content).toContain("---");
    });

    it("includes token estimate in result", () => {
      setupExamples({ "binary-file-escalation.md": EXAMPLE_BINARY });
      const result = routeFewShotExamples("Fix the binary file", "coder", TEST_ROOT);
      expect(result.tokenEstimate).toBe(460);
    });
  });

  // ── Example loading ──────────────────────────────────────────

  describe("loadFewShotExamples", () => {
    it("loads all example files except INDEX.md", () => {
      setupExamples({
        "binary-file-escalation.md": EXAMPLE_BINARY,
        "reproduce-first-debugging.md": EXAMPLE_DEBUGGING,
        "escalation-judgment.md": EXAMPLE_ESCALATION,
      });
      const examples = loadFewShotExamples(TEST_ROOT);
      expect(examples.length).toBe(3);
      const ids = examples.map((e) => e.id).sort();
      expect(ids).toEqual([
        "binary-file-escalation",
        "escalation-judgment",
        "reproduce-first-debugging",
      ]);
    });

    it("returns empty array for non-existent directory", () => {
      const examples = loadFewShotExamples("/nonexistent/path");
      expect(examples).toEqual([]);
    });

    it("skips files without trigger patterns", () => {
      setupExamples({
        "binary-file-escalation.md": EXAMPLE_BINARY,
        "no-pattern.md": "# No Pattern\n\n## Worked Example\n\nSome content here.\n",
      });
      const examples = loadFewShotExamples(TEST_ROOT);
      expect(examples.length).toBe(1);
      expect(examples[0].id).toBe("binary-file-escalation");
    });

    it("caches results across calls", () => {
      setupExamples({ "binary-file-escalation.md": EXAMPLE_BINARY });
      const first = loadFewShotExamples(TEST_ROOT);
      const second = loadFewShotExamples(TEST_ROOT);
      expect(first).toBe(second); // same reference = cached
    });
  });

  // ── matchFewShotExamples (unit) ──────────────────────────────

  describe("matchFewShotExamples", () => {
    it("returns empty array for empty task text", () => {
      const examples = loadFewShotExamples(TEST_ROOT); // empty or nonexistent
      expect(matchFewShotExamples("", examples)).toEqual([]);
    });

    it("returns empty array for no examples", () => {
      expect(matchFewShotExamples("some task", [])).toEqual([]);
    });
  });

  // ── formatFewShotInjection (unit) ────────────────────────────

  describe("formatFewShotInjection", () => {
    it("returns empty string for no examples", () => {
      expect(formatFewShotInjection([])).toBe("");
    });

    it("formats single example with heading", () => {
      const result = formatFewShotInjection([
        {
          id: "test",
          triggerPattern: /test/i,
          content: "Example content here",
          tokenEstimate: 100,
        },
      ]);
      expect(result).toBe(
        "## Reference: How a similar task was handled\n\nExample content here\n\n---",
      );
    });

    it("separates multiple examples with ---", () => {
      const result = formatFewShotInjection([
        {
          id: "test1",
          triggerPattern: /test/i,
          content: "First example",
          tokenEstimate: 100,
        },
        {
          id: "test2",
          triggerPattern: /test/i,
          content: "Second example",
          tokenEstimate: 100,
        },
      ]);
      expect(result).toContain("First example\n\n---\n\nSecond example");
    });
  });
});
