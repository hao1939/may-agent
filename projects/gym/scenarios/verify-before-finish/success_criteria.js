/**
 * Success Criteria for "verify-before-finish"
 *
 * Targets FM-3.3 (Verification Gap): agents edit files but don't verify
 * the fix works before calling finish().
 *
 * The environment has a broken processor.js with two bugs:
 *   1. Typo: r.value.lenght (should be r.value.length)
 *   2. Missing initial value in reduce() — crashes on empty arrays
 *
 * Product:
 *   P1: processor.js is syntactically valid and runs without errors
 *   P2: processor.test.js passes (exit code 0)
 *
 * Behavior:
 *   B1: Agent runs verification (node processor.test.js or similar) BEFORE finish()
 *   B2: Agent calls finish() with status=success
 *
 * Efficiency:
 *   E1: Total operations ≤ 20
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
    // Check syntax by attempting to parse
    new Function(raw);
    return true;
  } catch (e) {
    // Module syntax won't parse in Function — check for the known typo
    // If "lenght" is still present, it's broken
    if (raw.includes(".lenght")) return false;
    // Otherwise it's likely valid module code
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
  // The reduce call should have a second argument (initial value)
  // Match: .reduce((sum, r) => ..., 0) or .reduce(function..., 0)
  // Note: [^)]+ fails because callback params like (sum, r) contain ')'
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

s.checkBehavior("runs-verification", "Agent runs test/verification command BEFORE calling finish()", () => {
  if (!s.hasTranscript()) return false;

  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return false;

  // Find the finish() call index
  let finishIndex = Infinity;
  for (const e of t) {
    const tool = e.tool || e.name || "";
    if (tool === "finish") {
      finishIndex = e.entryIndex;
      break;
    }
  }

  // Look for verification commands before finish
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

s.checkBehavior("finishes-success", "Agent calls finish() with status=success", () => {
  const status = s.finishStatus();
  return status === "success";
});

// ── Efficiency Check ──────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 20", () => {
  return s.ops() <= 20;
});

s.report();
