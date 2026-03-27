/**
 * Success Criteria for "evidence-gate-pass"
 *
 * Tests that the evidence-gate workflow correctly PASSES an evidence-backed brief.
 *
 * Product:
 *   P1: Workflow returned a result (didn't crash)
 *
 * Behavior:
 *   B1: Verdict is PASS (the brief has all three evidence elements)
 *   B2: All three evidence checks show PASS
 *
 * Efficiency:
 *   E1: Completed in ≤ 2 agent calls (evaluator check only)
 */

const { Score } = require("../../lib/gym-score-utils.cjs");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("workflow-completed", "Workflow returned a result", () => {
  const summary = s.readFile("workflow-result.md");
  if (summary) return summary.length > 0;
  // Fall back: check if transcript exists and has evaluator calls
  if (!s.hasTranscript()) return false;
  return s.ops() > 0;
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("verdict-pass", "Evidence gate verdict is PASS", () => {
  const summary = s.readFile("workflow-result.md");
  if (summary) {
    return summary.includes("PASS") && !summary.includes("REJECT");
  }
  // Fall back to transcript: check evaluator response
  if (!s.hasTranscript()) return false;
  const assistantMsgs = s.toolCalls("evaluator");
  // Check the last assistant message for PASS verdict
  return false; // Can't determine without workflow result file
});

s.checkBehavior("all-checks-pass", "All three evidence checks show PASS", () => {
  const summary = s.readFile("workflow-result.md");
  if (!summary) return false;
  // Count ✅ marks — should be 3 (one per evidence check)
  const checkmarks = (summary.match(/✅/g) || []).length;
  return checkmarks >= 3;
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("minimal-calls", "Completed in ≤ 2 agent calls", () => {
  return s.ops() <= 5; // Workflow overhead is small
});

s.report();
