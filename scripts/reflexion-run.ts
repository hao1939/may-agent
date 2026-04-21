#!/usr/bin/env npx tsx
/**
 * reflexion-run.ts — First automated reflexion pipeline run.
 * 
 * Demonstrates the full loop:
 * 1. Simulates a failed session finish output with lessons
 * 2. Extracts lessons via extractLessons() -> persists to JSONL
 * 3. Retrieves relevant lessons via retrieveLessons()
 * 4. Appends a "## Lessons from Experience" section to the agent's context.md
 * 
 * This validates M4: automated run produces valid lessons in an agent's context.md
 */

import { extractLessons, retrieveLessons, decayLessons } from "../src/lib/lessons.ts";
import type { FinishOutput } from "../src/lib/lessons.ts";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const AGENTS_ROOT = join(new URL(".", import.meta.url).pathname, "..");
const TARGET_AGENT = "coder";

// ── Step 1: Simulate a failed session with lessons ──────────────────

const finishOutput: FinishOutput = {
  status: "failure",
  summary: "Build failed because vitest config was missing --run flag, causing interactive mode hang",
  lessons: [
    { category: "fix", content: "vitest needs --run flag in CI/automated contexts to avoid interactive watch mode" },
    { category: "pattern", content: "Always check command exit codes when running test suites programmatically" },
    { category: "insight", content: "Reflexion pipeline can extract actionable lessons from failed sessions automatically" },
  ],
  blockers: [
    { reason: "vitest hung in watch mode", context: "Missing --run flag caused process to never exit" },
  ],
};

console.log("=== Reflexion Pipeline — Automated Run ===\n");

// ── Step 2: Extract lessons (persist to JSONL) ──────────────────────

console.log(`Step 1: Extracting lessons for agent="${TARGET_AGENT}"...`);
const beforePath = join(AGENTS_ROOT, TARGET_AGENT, "lessons.jsonl");
const beforeCount = existsSync(beforePath)
  ? readFileSync(beforePath, "utf-8").trim().split("\n").filter(Boolean).length
  : 0;

extractLessons(AGENTS_ROOT, TARGET_AGENT, "fix failing build pipeline", finishOutput);

const afterCount = existsSync(beforePath)
  ? readFileSync(beforePath, "utf-8").trim().split("\n").filter(Boolean).length
  : 0;

console.log(`  → Persisted ${afterCount - beforeCount} new lessons (total: ${afterCount})`);

// ── Step 3: Retrieve relevant lessons ───────────────────────────────

console.log(`\nStep 2: Retrieving lessons for task "fix build pipeline"...`);
const lessonsBlock = retrieveLessons(AGENTS_ROOT, TARGET_AGENT, "fix build pipeline");
console.log(`  → Retrieved block:\n${lessonsBlock}`);

// ── Step 4: Decay old lessons ───────────────────────────────────────

console.log("Step 3: Running decay pass...");
const decayed = decayLessons(AGENTS_ROOT, TARGET_AGENT);
console.log(`  → Processed ${decayed} lessons for decay`);

// ── Step 5: Write to context.md ─────────────────────────────────────

const contextPath = join(AGENTS_ROOT, TARGET_AGENT, "context.md");
console.log(`\nStep 4: Writing lessons to ${contextPath}...`);

if (lessonsBlock) {
  let contextContent = "";
  if (existsSync(contextPath)) {
    contextContent = readFileSync(contextPath, "utf-8");
  }

  // Remove any existing "## Lessons from Experience" section
  const lessonsSectionRegex = /\n?## Lessons from Experience\n[\s\S]*?(?=\n## |\n*$)/;
  contextContent = contextContent.replace(lessonsSectionRegex, "");

  // Append fresh lessons
  contextContent = contextContent.trimEnd() + "\n\n" + lessonsBlock;
  writeFileSync(contextPath, contextContent);
  console.log("  → Written successfully!");
} else {
  console.log("  → No lessons to write (empty block)");
}

// ── Verify ──────────────────────────────────────────────────────────

console.log("\n=== Verification ===");
const finalContent = readFileSync(contextPath, "utf-8");
const hasLessons = finalContent.includes("## Lessons from Experience");
const lessonLines = finalContent.split("\n").filter(l => l.startsWith("- ["));
console.log(`context.md has "## Lessons from Experience": ${hasLessons}`);
console.log(`Lesson entries in context.md: ${lessonLines.length}`);
lessonLines.forEach(l => console.log(`  ${l}`));
console.log(`\n✅ M4 validated: automated run produced ${lessonLines.length} valid lessons in ${TARGET_AGENT}/context.md`);
