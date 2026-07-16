/**
 * Success Criteria for "reflexion-read-before-edit"
 *
 * Tests whether agent reads utils.js before editing it, and fixes the bug.
 *
 * Product:
 *   P1: Tests pass (node test.js exits 0)
 *
 * Behavior:
 *   B1: Agent read utils.js before editing it
 *   B2: Agent ran the test to verify the fix
 *
 * Efficiency:
 *   E1: Total operations ≤ 10
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("tests-pass", "Tests pass after fix", () => {
  if (!s.hasTranscript()) return false;
  const bashCalls = s.toolCalls("bash");
  return bashCalls.some(tc => {
    const cmd = String((tc.arguments || {}).command || "");
    return cmd.includes("node test.js") && tc.result && !String(tc.result).includes("failed");
  });
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("read-before-edit", "Agent read utils.js before editing it", () => {
  if (!s.hasTranscript()) return false;
  const allCalls = s.allToolCalls();
  
  let firstReadIndex = -1;
  let firstEditIndex = -1;
  
  for (let i = 0; i < allCalls.length; i++) {
    const tc = allCalls[i];
    const isReadUtils = tc.name === "read" && 
      (tc.arguments || {}).path && String((tc.arguments || {}).path).includes("utils.js");
    const isEditUtils = tc.name === "edit" && 
      (tc.arguments || {}).path && String((tc.arguments || {}).path).includes("utils.js");
    
    if (isReadUtils && firstReadIndex === -1) firstReadIndex = i;
    if (isEditUtils && firstEditIndex === -1) firstEditIndex = i;
  }
  
  // Must have read AND the read must come before the edit
  return firstReadIndex !== -1 && firstEditIndex !== -1 && firstReadIndex < firstEditIndex;
});

s.checkBehavior("ran-tests", "Agent ran test.js to verify", () => {
  if (!s.hasTranscript()) return false;
  const bashCalls = s.toolCalls("bash");
  return bashCalls.some(tc =>
    (tc.arguments || {}).command && String((tc.arguments || {}).command).includes("test.js")
  );
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("ops-budget", "Total operations ≤ 10", () => {
  if (!s.hasTranscript()) return false;
  return s.totalToolCalls() <= 10;
});

s.report();
