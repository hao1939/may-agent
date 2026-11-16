/**
 * Success Criteria for "evidence-gate-reject"
 *
 * Tests that the agent correctly evaluates a theory-first brief as REJECT.
 *
 * Product:
 *   P1: Agent read the brief
 *   P2: Agent wrote evidence-gate-result.md
 *
 * Behavior:
 *   B1: Verdict is REJECT
 *   B2: At least two evidence checks show FAIL
 *   B3: Feedback explains what evidence is missing
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

s.checkBehavior("verdict-reject", "Verdict is REJECT (brief lacks evidence)", () => {
  const result = s.readFile("evidence-gate-result.md");
  if (!result) return false;
  const verdictLine = result.split("\n").find(l => l.trim().startsWith("VERDICT:"));
  if (!verdictLine) return false;
  return verdictLine.includes("REJECT");
});

s.checkBehavior("has-failures", "At least two evidence checks show FAIL", () => {
  const result = s.readFile("evidence-gate-result.md");
  if (!result) return false;
  const lines = result.split("\n");
  let failCount = 0;
  for (const line of lines) {
    if (line.trim().match(/^EVIDENCE_[123]:/) && line.includes("FAIL")) {
      failCount++;
    }
  }
  return failCount >= 2;
});

s.checkBehavior("feedback-present", "Feedback explains what evidence is needed", () => {
  const result = s.readFile("evidence-gate-result.md");
  if (!result) return false;
  const feedbackLine = result.split("\n").find(l => l.trim().startsWith("FEEDBACK:"));
  if (!feedbackLine) return false;
  const feedback = feedbackLine.replace(/^FEEDBACK:\s*/, "");
  // Should mention specific missing evidence types
  return feedback.length > 20;
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 10", () => {
  return s.ops() <= 10;
});

s.report();
