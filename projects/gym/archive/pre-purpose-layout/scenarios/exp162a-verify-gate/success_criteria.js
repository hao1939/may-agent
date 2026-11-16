/**
 * Success Criteria for "exp162a-verify-gate"
 *
 * EXP-162a Cell B treatment: Structural gate (2-phase workflow) on additive
 * verification behavior. Same product checks as verify-before-finish, but
 * behavioral check adapted for workflow (verification happens in Phase 2
 * by design — the structural gate ensures it).
 *
 * Product:
 *   P1: processor.js is syntactically valid (no .lenght typo)
 *   P2: reduce() has initial value (handles empty arrays)
 *   P3: processor.test.js passes
 *
 * Behavior:
 *   B1: Agent runs verification (tests) at any point across both phases
 *   B2: Agent calls finish() with status=success (in Phase 2)
 *
 * Efficiency:
 *   E1: Total operations ≤ 25 (slightly more generous for 2-phase workflow)
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

s.checkBehavior("runs-verification", "Agent runs test/verification command at any point", () => {
  if (!s.hasTranscript()) return false;

  const t = s.transcript ? s.transcript.toolCalls : null;
  if (!t) return false;

  // Look for verification commands anywhere in the transcript (either phase)
  const verifyPatterns = [
    /node\s+.*processor\.test/,
    /node\s+.*processor\.js/,
    /npm\s+test/,
    /verify\.sh/,
    /node\s+-[ec]\s/,
  ];

  for (const e of t) {
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

s.checkEfficiency("reasonable-ops", "Total operations ≤ 25", () => {
  return s.ops() <= 25;
});

s.report();
