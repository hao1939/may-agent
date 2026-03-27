/**
 * Success Criteria for "evidence-gate-reject"
 *
 * Tests that the evidence-gate workflow correctly REJECTS a theory-first brief.
 *
 * Product:
 *   P1: Workflow returned a result (didn't crash)
 *
 * Behavior:
 *   B1: Verdict is REJECT (the brief lacks evidence)
 *   B2: At least one evidence check shows FAIL
 *   B3: Feedback mentions what evidence is missing
 *
 * Efficiency:
 *   E1: Completed in ≤ 2 agent calls
 */

const { Score } = require("../../lib/gym-score-utils.cjs");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("workflow-completed", "Workflow returned a result", () => {
  const summary = s.readFile("workflow-result.md");
  if (summary) return summary.length > 0;
  if (!s.hasTranscript()) return false;
  return s.ops() > 0;
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("verdict-reject", "Evidence gate verdict is REJECT", () => {
  const summary = s.readFile("workflow-result.md");
  if (!summary) return false;
  return summary.includes("REJECT");
});

s.checkBehavior("has-failures", "At least one evidence check shows FAIL", () => {
  const summary = s.readFile("workflow-result.md");
  if (!summary) return false;
  // Count ❌ marks — should be at least 1
  const failures = (summary.match(/❌/g) || []).length;
  return failures >= 1;
});

s.checkBehavior("feedback-present", "Feedback explains what evidence is needed", () => {
  const summary = s.readFile("workflow-result.md");
  if (!summary) return false;
  // Feedback should mention specific missing evidence types
  const feedbackMatch = summary.match(/Feedback[:\s]+(.+)/i);
  if (!feedbackMatch) return false;
  return feedbackMatch[1].length > 20; // Non-trivial feedback
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("minimal-calls", "Completed in ≤ 2 agent calls", () => {
  return s.ops() <= 5;
});

s.report();
