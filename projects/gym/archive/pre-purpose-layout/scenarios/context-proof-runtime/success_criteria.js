/**
 * Success Criteria for "context-proof-runtime"
 *
 * Tests whether context learning actually improves agent behavior.
 *
 * Phase 1: Agent runs tests, discovers:
 *   a) Tests use bun:test → must use 'bun test' not 'node'
 *   b) subtract test has swapped args → fix it
 *   Context learner should extract: "use bun test" and possibly the fix pattern
 *
 * Phase 2: Agent adds a divide test and runs the suite.
 *   WITH context: should use 'bun test' on first try
 *   WITHOUT context: may try node first, waste ops discovering bun requirement
 *
 * Key metric: phase 2 error count. Zero runtime-discovery errors = context helped.
 *
 * Product:
 *   P1: phase1-report.md exists (phase 1 completed)
 *   P2: phase2-report.md exists (phase 2 completed)
 *   P3: test/math.test.js contains divide tests
 *   P4: subtract bug is fixed (5-3=2, not 3-5=2)
 *   P5: full test suite passes with bun test
 *
 * Behavior:
 *   B1: Phase 2 has zero failed node/npm attempts
 *   B2: Phase 2 uses bun test (not node/npm) to run tests
 *
 * Efficiency:
 *   E1: Phase 2 total ops ≤ 15
 */

const { Score } = require("@may-agent/gym/scoring");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("phase1-report", "phase1-report.md exists", () => {
  return s.fileExists("phase1-report.md");
});

s.checkProduct("phase2-report", "phase2-report.md exists", () => {
  return s.fileExists("phase2-report.md");
});

s.checkProduct("has-divide-tests", "test/math.test.js contains divide test cases", () => {
  const content = s.readFile("test/math.test.js");
  if (!content) return false;
  return content.includes("divide") && content.includes("10") && content.includes("0");
});

s.checkProduct("subtract-fixed", "subtract test uses correct argument order", () => {
  const content = s.readFile("test/math.test.js");
  if (!content) return false;
  // The fix should swap subtract(3, 5) to subtract(5, 3)
  return content.includes("subtract(5, 3)") || content.includes("subtract(5,3)");
});

s.checkProduct("tests-pass", "Full test suite passes with bun test", () => {
  try {
    execSync("bun test", { cwd: workDir, timeout: 15000, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("no-runtime-errors", "Phase 2 has zero failed node/npm/wrong-runner attempts", () => {
  if (!s.hasTranscript()) return true;

  // Check every bash call in phase 2 transcript
  for (const tc of s.toolCalls("bash")) {
    const cmd = String((tc.arguments || {}).command || "").toLowerCase();

    // Failed node attempt
    if (cmd.includes("node ") && cmd.includes("test")) {
      const errAfter = s.transcript.toolResults.find(r =>
        r.index > tc.entryIndex && r.isError &&
        (r.content.includes("bun:test") || r.content.includes("Cannot find module"))
      );
      if (errAfter) return false;
    }

    // Failed npm attempt
    if (cmd.includes("npm test") || cmd.includes("npm run test")) {
      const errAfter = s.transcript.toolResults.find(r =>
        r.index > tc.entryIndex && r.isError
      );
      if (errAfter) return false;
    }
  }
  return true;
});

s.checkBehavior("uses-bun", "Phase 2 runs tests with bun", () => {
  if (!s.hasTranscript()) return false;
  return s.toolCalls("bash").some(tc => {
    const cmd = String((tc.arguments || {}).command || "");
    return cmd.includes("bun test");
  });
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("phase2-efficient", "Phase 2 total ops ≤ 15", () => {
  return s.ops() <= 15;
});

s.report();
