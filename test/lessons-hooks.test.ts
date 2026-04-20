/**
 * Tests for lessons-hooks.ts integration layer
 */
import { onSessionFinish, getLessonsContext, runLessonDecay } from "../src/lib/lessons-hooks.ts";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tmpDir: string;
let passed = 0;
let failed = 0;

function setup() {
  tmpDir = mkdtempSync(join(tmpdir(), "lessons-hooks-"));
  process.env.AGENTS_ROOT = tmpDir;
}

function teardown() {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.AGENTS_ROOT;
}

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.error(`  ❌ ${msg}`); }
}

// Test 1: onSessionFinish extracts lessons from finish output
setup();
onSessionFinish({
  agent: "coder",
  task: "fix the build",
  finishOutput: {
    status: "success",
    summary: "Fixed it",
    lessons: [{ category: "fix", content: "Always run npm install first" }],
  },
});
const lessonsFile = join(tmpDir, "coder", "lessons.jsonl");
assert(existsSync(lessonsFile), "onSessionFinish creates lessons.jsonl");
const content = readFileSync(lessonsFile, "utf-8").trim();
const lesson = JSON.parse(content);
assert(lesson.text === "Always run npm install first", "lesson text persisted correctly");
assert(lesson.category === "fix", "lesson category persisted");
teardown();

// Test 2: onSessionFinish extracts from failure blockers
setup();
onSessionFinish({
  agent: "coder",
  task: "deploy service",
  finishOutput: {
    status: "failure",
    summary: "Failed",
    blockers: [{ reason: "Missing env var", context: "DATABASE_URL not set" }],
  },
});
const f2 = join(tmpDir, "coder", "lessons.jsonl");
assert(existsSync(f2), "failure blockers create lessons");
const l2 = JSON.parse(readFileSync(f2, "utf-8").trim());
assert(l2.text.includes("Missing env var"), "blocker reason captured");
teardown();

// Test 3: onSessionFinish is no-op when nothing to learn
setup();
onSessionFinish({
  agent: "coder",
  task: "simple task",
  finishOutput: { status: "success", summary: "Done" },
});
assert(!existsSync(join(tmpDir, "coder", "lessons.jsonl")), "no-op when no lessons");
teardown();

// Test 4: getLessonsContext returns empty when no lessons
setup();
const ctx = getLessonsContext("coder", "some task");
assert(ctx === "", "returns empty string when no lessons");
teardown();

// Test 5: getLessonsContext returns formatted lessons
setup();
onSessionFinish({
  agent: "coder",
  task: "build stuff",
  finishOutput: {
    status: "success",
    summary: "ok",
    lessons: [{ category: "pattern", content: "Use bun instead of npm" }],
  },
});
const ctx2 = getLessonsContext("coder", "build stuff");
assert(ctx2.includes("## Lessons from Experience"), "formatted header present");
assert(ctx2.includes("Use bun instead of npm"), "lesson text in context");
teardown();

// Test 6: runLessonDecay doesn't throw on empty
setup();
const decayed = runLessonDecay("coder");
assert(decayed === 0, "decay returns 0 for non-existent agent");
teardown();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
