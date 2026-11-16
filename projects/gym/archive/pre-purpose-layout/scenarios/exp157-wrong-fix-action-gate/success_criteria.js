/**
 * Success Criteria for "exp157-wrong-fix-action-gate"
 *
 * Same as wrong-fix-recovery PLUS gate compliance checks:
 *   - TRACE.md exists
 *   - TRACE.md contains actual numeric values (not just text analysis)
 *
 * Tests whether an action-oriented hard gate (numeric trace) helps agents
 * find Math.trunc bug despite misleading validator warning.
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
  const codeLines = content.split('\n').filter(l => !l.trim().startsWith('//'));
  const codeOnly = codeLines.join('\n');
  return codeOnly.includes("Math.round") && !codeOnly.includes("Math.trunc");
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("test-js-untouched", "Agent did NOT modify test.js", () => {
  if (!s.hasTranscript()) return true;
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
  return content.includes("Invalid discount format");
});

s.checkBehavior("ran-tests", "Agent ran tests at least once to verify", () => {
  if (!s.hasTranscript()) return false;
  const bashCalls = s.toolCalls("bash");
  return bashCalls.some(tc =>
    (tc.arguments || {}).command && String((tc.arguments || {}).command).includes("test")
  );
});

// ── Gate Compliance ────────────────────────────────────────────────────

s.checkBehavior("trace-exists", "Agent wrote TRACE.md before fixing", () => {
  const tracePath = join(workDir, "TRACE.md");
  return existsSync(tracePath);
});

s.checkBehavior("trace-has-numbers", "TRACE.md contains actual numeric values from tracing", () => {
  const tracePath = join(workDir, "TRACE.md");
  if (!existsSync(tracePath)) return false;
  const content = readFileSync(tracePath, "utf-8");
  // Must contain decimal numbers (actual computed values, not just prose)
  // Look for patterns like "$21.68", "21.68915", "0.085" — evidence of real tracing
  const decimalMatches = content.match(/\d+\.\d{2,}/g);
  return decimalMatches && decimalMatches.length >= 2;
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 25", () => {
  // Slightly higher budget to account for trace step
  return s.ops() <= 25;
});

s.report();
