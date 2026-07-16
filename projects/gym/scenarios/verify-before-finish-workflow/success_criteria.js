/**
 * Success Criteria for "verify-before-finish-workflow"
 *
 * Workflow variant of verify-before-finish targeting FM-2.2 (VERIFICATION_MISMATCH).
 * Tests whether the two-phase workflow (Method #15) causes the coder to:
 *   1. Fix BOTH bugs in Phase 1 (typo + reduce initial value)
 *   2. Run the EXACT specified verification command in Phase 2
 *   3. NOT substitute alternative commands
 *
 * Product checks: same as base scenario
 * Behavioral checks: enhanced — checks for exact command usage
 * Efficiency: same budget
 */

const { Score } = require("@may-agent/gym/scoring");
const { execSync } = require("child_process");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product Checks ────────────────────────────────────────────────────

s.checkProduct("processor-valid", "processor.js is valid JavaScript (no syntax errors)", () => {
  const raw = s.readFile("src/processor.js");
  if (!raw) return false;
  try {
    new Function(raw);
    return true;
  } catch (e) {
    if (raw.includes(".lenght")) return false;
    return !raw.includes("SyntaxError");
  }
});

s.checkProduct("processor-typo-fixed", "The .lenght typo is corrected to .length", () => {
  const raw = s.readFile("src/processor.js");
  if (!raw) return false;
  return !raw.includes(".lenght") && raw.includes(".length");
});

s.checkProduct("reduce-has-initial", "reduce() has an initial value (handles empty arrays)", () => {
  const raw = s.readFile("src/processor.js");
  if (!raw) return false;
  // Check for reduce() with a second argument (initial value)
  // The old regex [^)]+ failed because callback params like (sum, r) contain ')'
  // Instead, look for the pattern: reduce(..., 0) allowing nested parens
  return /\.reduce\([\s\S]+,\s*0\s*\)/.test(raw) || /\.reduce\([^;]*,\s*0\s*\);/.test(raw);
});

s.checkProduct("tests-pass", "processor.test.js passes when run", () => {
  try {
    const testFile = path.resolve(workDir, "src", "processor.test.js");
    execSync(`node "${testFile}"`, { cwd: workDir, timeout: 10000 });
    return true;
  } catch (e) {
    return false;
  }
});

// ── Behavioral Checks ─────────────────────────────────────────────────

s.checkBehavior("runs-exact-verification", "Agent runs EXACT command: node src/processor.test.js", () => {
  if (!s.hasTranscript()) return false;

  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return false;

  // Look for the exact command: node src/processor.test.js
  // Allow optional cd prefix (agent works in temp dir) and optional 2>&1 suffix
  // Core requirement: the test command itself is exactly "node src/processor.test.js"
  const exactPattern = /(?:^|\s*cd\s+\S+\s*&&\s*)node\s+src\/processor\.test\.js\s*(?:2>&1)?(?:\s*;.*)?$/;

  for (const e of t) {
    const tool = e.tool || e.name || "";
    if (tool === "bash") {
      const cmd = String((e.arguments || {}).command || "").trim();
      if (exactPattern.test(cmd)) {
        return true;
      }
    }
  }

  return false;
});

s.checkBehavior("runs-verification", "Agent runs test/verification command BEFORE calling finish()", () => {
  if (!s.hasTranscript()) return false;

  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return false;

  let finishIndex = Infinity;
  for (const e of t) {
    const tool = e.tool || e.name || "";
    if (tool === "finish") {
      finishIndex = e.entryIndex;
      break;
    }
  }

  const verifyPatterns = [
    /node\s+.*processor\.test/,
    /node\s+.*processor\.js/,
    /npm\s+test/,
    /verify\.sh/,
    /node\s+-[ec]\s/,
  ];

  for (const e of t) {
    if (e.entryIndex >= finishIndex) break;

    const tool = e.tool || e.name || "";
    if (tool === "bash") {
      const cmd = String((e.arguments || {}).command || "");
      if (verifyPatterns.some(p => p.test(cmd))) {
        return true;
      }
    }
  }

  return false;
});

s.checkBehavior("no-substitute-commands", "Agent does NOT use substitute verification commands", () => {
  if (!s.hasTranscript()) return true; // No transcript = can't check

  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return true;

  // Substitute patterns that indicate FM-2.2 behavior
  const substitutePatterns = [
    /npx\s+vitest/,
    /node_modules\/\.bin\/vitest/,
    /npm\s+test/,
    /npx\s+jest/,
    /node_modules\/\.bin\/jest/,
  ];

  for (const e of t) {
    const tool = e.tool || e.name || "";
    if (tool === "bash") {
      const cmd = String((e.arguments || {}).command || "");
      if (substitutePatterns.some(p => p.test(cmd))) {
        return false; // Used a substitute command
      }
    }
  }

  return true;
});

s.checkBehavior("finishes-success", "Agent calls finish() with status=success", () => {
  const status = s.finishStatus();
  return status === "success";
});

// ── Efficiency Check ──────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 20", () => {
  return s.ops() <= 20;
});

s.report();
