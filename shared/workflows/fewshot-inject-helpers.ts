/**
 * Few-Shot Example Injection — Keyword-Based Static Router
 *
 * Prepends domain-matched worked examples to coder task messages before
 * they're sent to the LLM. Evidence base: EXP-084 through EXP-097
 * (100+ gym runs, 18/18 matched = 100%).
 *
 * Usage:
 *   import { injectFewShot } from "./fewshot-inject-helpers.js";
 *   const enrichedTask = injectFewShot(originalTask);
 *
 * Rules (from KE-065):
 * - Only inject when task matches domain class (Level 2 minimum)
 * - Examples go in the USER MESSAGE, NOT system prompt (0% via system prompt)
 * - Max 2 examples per task, under ~3000 tokens total
 * - Bypass with GYM_NO_FEWSHOT=1 env var (for clean gym baselines)
 *
 * See: shared/knowledge/fewshot-examples/INDEX.md
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ── Constants ──────────────────────────────────────────────────────────

/** Max examples to inject per task (keeps total under ~3000 tokens). */
const MAX_EXAMPLES = 2;

/** Max total characters for injected examples (~3000 tokens ≈ ~12000 chars). */
const MAX_TOTAL_CHARS = 12000;

/** Directory containing few-shot example .md files. */
const EXAMPLES_DIR = resolve("shared/knowledge/fewshot-examples");

// ── Static Router (from INDEX.md) ──────────────────────────────────────

interface ExamplePattern {
  match: RegExp;
  file: string;
}

const EXAMPLE_PATTERNS: ExamplePattern[] = [
  { match: /binary|\.bin(?![/\\])|compiled|executable|hexdump/i, file: "binary-file-escalation" },
  { match: /bug|error|failing|test.*fail|crash|500|exception/i, file: "reproduce-first-debugging" },
  { match: /upgrade|dependency|multiple.*(file|module)|impact|import.*shared/i, file: "escalation-judgment" },
  { match: /blocked|impossible|can'?t.*find|missing.*key|missing.*credential|no.*permission|binary.*file|all.*fail/i, file: "know-when-blocked" },
  { match: /fix.*bug|broken|failing|do(?:es)?(?:\s?n(?:o|')t).*work|incorrect.*output|wrong.*result|comment.*says|not.*work/i, file: "evidence-over-narrative" },
  { match: /contradictory|conflict.*requirement|impossible.*both|mutually.*exclusive|trade.?off|can'?t.*satisfy.*both|infeasible|requirements.*tension|constraint.*violation/i, file: "requirements-conflict-analysis" },
  { match: /implement|create.*endpoint|add.*feature|build.*service|set up|add.*support|new.*module|add.*page|add.*route|write.*test|add.*handling/i, file: "incremental-implementation" },
  { match: /refactor|restructure|extract.*into|split.*into|move.*to|reorganize|clean\s|consolidate|deduplicate|DRY|remov.*unused|unused.*import/i, file: "safe-refactoring" },
];

// ── Example Selection ──────────────────────────────────────────────────

/**
 * Select which example files match the task content.
 * Returns file basenames (without .md extension), max 2.
 */
export function selectExamples(taskContent: string): string[] {
  // Strip verification command blocks before matching to avoid false positives
  // (e.g., ./node_modules/.bin/tsc matching "binary" patterns)
  const stripped = taskContent.replace(/## Verification[\s\S]*?```[\s\S]*?```/g, "");
  return EXAMPLE_PATTERNS
    .filter((p) => p.match.test(stripped))
    .map((p) => p.file)
    .slice(0, MAX_EXAMPLES);
}

// ── Example Loading ────────────────────────────────────────────────────

/**
 * Load example content from a .md file.
 * Extracts the "Worked Example" section (between ## Worked Example and the next ##).
 * Falls back to full file content (minus YAML frontmatter) if section not found.
 *
 * Returns null if the file doesn't exist or can't be read.
 */
export function loadExample(filename: string, examplesDir: string = EXAMPLES_DIR): string | null {
  const filepath = join(examplesDir, `${filename}.md`);
  try {
    const content = readFileSync(filepath, "utf-8");

    // Extract the "Worked Example" section — this is what should be injected
    const workedMatch = content.match(
      /## Worked Example\s*\n([\s\S]*?)(?=\n## (?!Worked)|$)/
    );
    if (workedMatch?.[1]?.trim()) {
      return workedMatch[1].trim();
    }

    // Fallback: strip metadata sections (header, trigger patterns, evidence, source)
    // and return the main content
    const stripped = content
      .replace(/^# Few-Shot Example:.*\n/m, "")
      .replace(/\*\*Domain class\*\*:.*\n/g, "")
      .replace(/\*\*Skill\*\*:.*\n/g, "")
      .replace(/\*\*Token estimate\*\*:.*\n/g, "")
      .replace(/## Trigger Patterns[\s\S]*?(?=\n## )/m, "")
      .replace(/## Evidence[\s\S]*$/m, "")
      .replace(/## Source[\s\S]*$/m, "")
      .trim();

    return stripped || null;
  } catch {
    return null;
  }
}

// ── Main Injection ─────────────────────────────────────────────────────

/**
 * Inject few-shot examples into a coder task message.
 *
 * Returns the enriched task with examples prepended, or the original
 * task unchanged if:
 * - No patterns match
 * - GYM_NO_FEWSHOT=1 is set
 * - Example files can't be loaded
 *
 * @param task The original task text
 * @returns The task with examples prepended (or unchanged)
 */
export function injectFewShot(task: string, examplesDir: string = EXAMPLES_DIR): string {
  // Bypass for gym baselines
  if (process.env.GYM_NO_FEWSHOT === "1") {
    return task;
  }

  // Select matching examples
  const selected = selectExamples(task);
  if (selected.length === 0) {
    return task;
  }

  // Load examples, respecting token budget
  const examples: string[] = [];
  let totalChars = 0;

  for (const filename of selected) {
    const content = loadExample(filename, examplesDir);
    if (!content) continue;

    if (totalChars + content.length > MAX_TOTAL_CHARS) {
      break; // Would exceed budget
    }

    examples.push(content);
    totalChars += content.length;
  }

  if (examples.length === 0) {
    return task;
  }

  // Frame with the template from INDEX.md
  const exampleBlock = examples.join("\n\n---\n\n");

  return (
    `## Reference: How a similar task was handled\n\n` +
    `${exampleBlock}\n\n` +
    `---\n\n` +
    `## Your Task\n\n` +
    `${task}`
  );
}
