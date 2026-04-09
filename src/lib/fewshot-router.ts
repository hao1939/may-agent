/**
 * Few-Shot Router — static keyword-based example injection for agent tasks.
 *
 * Matches task descriptions against regex trigger patterns defined in the
 * few-shot example files under agents/shared/knowledge/fewshot-examples/.
 * Returns formatted example content for prompt injection.
 *
 * Design rationale (from review-fewshot-proposal.md):
 * - Domain-matched worked examples improve task pass rates from 0% to 100%
 *   in tested scenarios (EXP-084 through EXP-097).
 * - Examples MUST be delivered in the task message (not system prompt).
 * - Max 2 examples per task to stay under ~3000 token budget.
 * - Phase 1 scope: coder and optimizer agents only.
 *
 * Follows the routeKnowledge() pattern from knowledge-router.ts.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** A registered few-shot example with its trigger pattern */
export interface FewShotExample {
  /** Filename without extension */
  id: string;
  /** Regex pattern to match against task text */
  triggerPattern: RegExp;
  /** The "Worked Example" section content to inject */
  content: string;
  /** Approximate token count */
  tokenEstimate: number;
}

/** Phase 1 target agents — only these get few-shot injection */
const TARGET_AGENTS = new Set(["coder", "optimizer"]);

/** Maximum examples to inject per task */
const MAX_EXAMPLES = 2;

/** Maximum total token budget for injected examples */
const MAX_TOKEN_BUDGET = 3000;

// ── Example loading ─────────────────────────────────────────────

let _cachedExamples: FewShotExample[] | null = null;
let _cachedDir: string | null = null;

/**
 * Parse a trigger pattern regex from markdown content.
 * Looks for a fenced code block with language "regex" containing a JS regex literal.
 */
function parseTriggerPattern(content: string): RegExp | null {
  const match = content.match(/```regex\s*\n\s*\/(.*?)\/([gimsuy]*)\s*\n\s*```/);
  if (!match) return null;
  try {
    return new RegExp(match[1], match[2] || "i");
  } catch {
    return null;
  }
}

/**
 * Extract the "Worked Example" section from the markdown content.
 * Returns the content between "## Worked Example" and the next "##" heading (or end of file).
 */
function extractWorkedExample(content: string): string {
  const startMatch = content.match(/^## Worked Example\s*$/m);
  if (!startMatch || startMatch.index === undefined) return "";

  const startIdx = startMatch.index + startMatch[0].length;
  const rest = content.slice(startIdx);

  // Find the next ## heading
  const endMatch = rest.match(/^## /m);
  const section = endMatch && endMatch.index !== undefined
    ? rest.slice(0, endMatch.index)
    : rest;

  return section.trim();
}

/**
 * Parse token estimate from the markdown frontmatter.
 * Looks for "**Token estimate**: ~NNN tokens"
 */
function parseTokenEstimate(content: string): number {
  const match = content.match(/\*\*Token estimate\*\*:\s*~?(\d+)/);
  return match ? parseInt(match[1], 10) : 500; // default estimate
}

/**
 * Load few-shot examples from the example directory.
 * Caches after first load. Each .md file (except INDEX.md) is parsed for:
 * - trigger pattern (from regex code block)
 * - worked example content
 * - token estimate
 */
export function loadFewShotExamples(projectRoot: string): FewShotExample[] {
  const examplesDir = join(projectRoot, "agents", "shared", "knowledge", "fewshot-examples");

  // Return cached if same directory
  if (_cachedExamples && _cachedDir === examplesDir) return _cachedExamples;

  if (!existsSync(examplesDir)) {
    _cachedExamples = [];
    _cachedDir = examplesDir;
    return _cachedExamples;
  }

  const examples: FewShotExample[] = [];

  try {
    const files = readdirSync(examplesDir).filter(
      (f) => f.endsWith(".md") && f !== "INDEX.md",
    );

    for (const file of files) {
      try {
        const content = readFileSync(join(examplesDir, file), "utf-8");
        const triggerPattern = parseTriggerPattern(content);
        const workedExample = extractWorkedExample(content);

        if (!triggerPattern || !workedExample) continue;

        examples.push({
          id: file.replace(/\.md$/, ""),
          triggerPattern,
          content: workedExample,
          tokenEstimate: parseTokenEstimate(content),
        });
      } catch {
        // Skip malformed files
      }
    }
  } catch {
    // Directory read failed — return empty
  }

  _cachedExamples = examples;
  _cachedDir = examplesDir;
  return _cachedExamples;
}

/** Clear the cached examples (for testing) */
export function clearFewShotCache(): void {
  _cachedExamples = null;
  _cachedDir = null;
}

// ── Matching ────────────────────────────────────────────────────

/**
 * Match task text against loaded examples.
 * Returns matched examples sorted by token estimate (smaller first),
 * limited to MAX_EXAMPLES and MAX_TOKEN_BUDGET.
 */
export function matchFewShotExamples(
  taskText: string,
  examples: FewShotExample[],
): FewShotExample[] {
  if (!taskText || examples.length === 0) return [];

  const matched = examples.filter((ex) => ex.triggerPattern.test(taskText));

  // Sort by token estimate ascending (prefer shorter examples to fit more)
  matched.sort((a, b) => a.tokenEstimate - b.tokenEstimate);

  // Apply limits: max count and max token budget
  const selected: FewShotExample[] = [];
  let tokenSum = 0;

  for (const ex of matched) {
    if (selected.length >= MAX_EXAMPLES) break;
    if (tokenSum + ex.tokenEstimate > MAX_TOKEN_BUDGET) continue;
    selected.push(ex);
    tokenSum += ex.tokenEstimate;
  }

  return selected;
}

// ── Formatting ──────────────────────────────────────────────────

/**
 * Format matched examples into a prompt injection block.
 * Uses the framing specified in INDEX.md.
 */
export function formatFewShotInjection(examples: FewShotExample[]): string {
  if (examples.length === 0) return "";

  const parts = examples.map((ex) => ex.content);
  return `## Reference: How a similar task was handled\n\n${parts.join("\n\n---\n\n")}\n\n---`;
}

// ── Main entry point ────────────────────────────────────────────

export interface FewShotResult {
  /** Formatted content to inject into the prompt, or null if no match */
  content: string | null;
  /** Names of matched example files (for logging) */
  matchedFiles: string[];
  /** Approximate total token count of injected content */
  tokenEstimate: number;
}

/**
 * Route few-shot examples for a task.
 *
 * 1. Check agent eligibility (Phase 1: coder, optimizer only)
 * 2. Load examples from disk (cached)
 * 3. Match task text against trigger patterns
 * 4. Format and return injection block
 *
 * @param taskText - The task description
 * @param agentName - The agent this session is for
 * @param projectRoot - Project root directory
 * @returns Formatted injection string, or null if no match / not eligible
 */
export function routeFewShotExamples(
  taskText: string,
  agentName: string,
  projectRoot: string,
): FewShotResult {
  // Skip heartbeat sessions — they match trigger patterns like "error" but
  // don't benefit from few-shot examples (~500-800 wasted tokens × 48/day)
  if (/^\[heartbeat\]/i.test(taskText)) {
    return { content: null, matchedFiles: [], tokenEstimate: 0 };
  }

  // Phase 1 scope restriction: only inject for target agents
  if (!TARGET_AGENTS.has(agentName)) {
    return { content: null, matchedFiles: [], tokenEstimate: 0 };
  }

  const examples = loadFewShotExamples(projectRoot);
  const matched = matchFewShotExamples(taskText, examples);

  if (matched.length === 0) {
    return { content: null, matchedFiles: [], tokenEstimate: 0 };
  }

  const content = formatFewShotInjection(matched);
  return {
    content,
    matchedFiles: matched.map((ex) => ex.id),
    tokenEstimate: matched.reduce((sum, ex) => sum + ex.tokenEstimate, 0),
  };
}
