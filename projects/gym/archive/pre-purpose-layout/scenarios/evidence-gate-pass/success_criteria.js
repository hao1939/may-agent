/**
 * Success Criteria for "evidence-gate-pass"
 *
 * Tests that the agent correctly evaluates an evidence-backed brief as PASS.
 *
 * Product:
 *   P1: Agent read the brief
 *   P2: Agent wrote evidence-gate-result.md
 *
 * Behavior:
 *   B1: Verdict is PASS
 *   B2: All three evidence checks show PASS
 *
 * Efficiency:
 *   E1: Total operations ≤ 10
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("read-brief", "Agent read the brief", () => {
  if (!s.hasTranscript()) return false;
  const reads = s.toolCalls("read");
  return reads.some(tc =>
    (tc.arguments || {}).path && String((tc.arguments || {}).path).includes("brief.md")
  );
});

s.checkProduct("wrote-result", "Agent wrote evidence-gate-result.md", () => {
  return s.fileExists("evidence-gate-result.md");
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("verdict-pass", "Verdict is PASS (brief has all evidence)", () => {
  const result = s.readFile("evidence-gate-result.md");
  if (!result) return false;
  // Check VERDICT line says PASS
  const verdictLine = result.split("\n").find(l => l.trim().startsWith("VERDICT:"));
  if (!verdictLine) return false;
  return verdictLine.includes("PASS") && !verdictLine.includes("REJECT");
});

s.checkBehavior("all-checks-pass", "All three evidence checks show PASS", () => {
  const result = s.readFile("evidence-gate-result.md");
  if (!result) return false;
  const lines = result.split("\n");
  const e1 = lines.find(l => l.trim().startsWith("EVIDENCE_1:"));
  const e2 = lines.find(l => l.trim().startsWith("EVIDENCE_2:"));
  const e3 = lines.find(l => l.trim().startsWith("EVIDENCE_3:"));
  if (!e1 || !e2 || !e3) return false;
  return e1.includes("PASS") && e2.includes("PASS") && e3.includes("PASS");
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 10", () => {
  return s.ops() <= 10;
});

s.report();
