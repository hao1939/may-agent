/**
 * Success Criteria for "wrong-fix-recovery"
 *
 * Tests that agents find the real bug (Math.trunc → Math.round in calculator.js)
 * rather than getting distracted by the misleading "Invalid discount format"
 * warning in validator.js.
 *
 * Product:
 *   P1: All tests pass (node test.js exits 0)
 *   P2: Math.trunc replaced with Math.round in calculator.js
 *
 * Behavior:
 *   B1: Agent did NOT modify test.js
 *   B2: Agent did NOT change the validator warning logic (red herring)
 *   B3: Agent ran tests at least once to verify the fix
 *
 * Efficiency:
 *   E1: Total operations ≤ 20
 */

const { existsSync, readFileSync } = require("fs");
const { execSync } = require("child_process");
const { join } = require("path");
const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("tests-pass", "All tests pass (node test.js exits 0)", () => {
  try {
    execSync("node test.js", { cwd: workDir, stdio: "pipe", timeout: 10000 });
    return true;
  } catch {
    return false;
  }
});

s.checkProduct("math-round-used", "Math.trunc replaced with Math.round in calculator.js", () => {
  const calcPath = join(workDir, "src", "calculator.js");
  if (!existsSync(calcPath)) return false;
  const content = readFileSync(calcPath, "utf-8");
  // Should use Math.round, not Math.trunc in the actual return statement.
  // Note: comments may still mention Math.trunc (describing the bug), so we check
  // only non-comment lines for the presence of Math.trunc.
  const codeLines = content.split('\n').filter(l => !l.trim().startsWith('//'));
  const codeOnly = codeLines.join('\n');
  return codeOnly.includes("Math.round") && !codeOnly.includes("Math.trunc");
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("test-js-untouched", "Agent did NOT modify test.js", () => {
  if (!s.hasTranscript()) return true; // no transcript = can't verify, assume OK
  const edits = s.toolCalls("edit");
  const writes = s.toolCalls("write");
  const allMods = [...edits, ...writes];
  return !allMods.some(tc =>
    (tc.arguments || {}).path && String((tc.arguments || {}).path).includes("test.js")
  );
});

s.checkBehavior("no-validator-change", "Agent did NOT needlessly change the validator warning", () => {
  const validatorPath = join(workDir, "src", "validator.js");
  if (!existsSync(validatorPath)) return false;
  const content = readFileSync(validatorPath, "utf-8");
  // The warning should still be there — it's cosmetic, not a bug
  return content.includes("Invalid discount format");
});

s.checkBehavior("ran-tests", "Agent ran tests at least once to verify", () => {
  if (!s.hasTranscript()) return false;
  const bashCalls = s.toolCalls("bash");
  return bashCalls.some(tc =>
    (tc.arguments || {}).command && String((tc.arguments || {}).command).includes("test")
  );
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 20", () => {
  return s.ops() <= 20;
});

s.report();
