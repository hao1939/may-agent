/**
 * Success Criteria for "context-learning-restraint"
 *
 * Tests that agents do NOT spam context_updates with trivial session-specific
 * facts on a simple task. Context updates should be reserved for durable
 * project knowledge, not "I fixed a typo in utils.js".
 *
 * Product:
 *   P1: The typo is fixed (reuslt → result)
 *   P2: No other content changed
 *
 * Behavior:
 *   B1: Agent finishes with success
 *   B2: context_updates is either absent OR has ≤2 entries
 *       (0 is ideal — there's nothing durable to learn from a typo fix)
 *   B3: If context_updates present, no entry is session-specific noise
 *       (e.g., "fixed a typo", "reuslt was misspelled")
 *
 * Efficiency:
 *   E1: Total operations ≤ 10
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product ────────────────────────────────────────────────────────────

s.checkProduct("typo-fixed", "src/utils.js has 'result' not 'reuslt'", () => {
  const content = s.readFile("src/utils.js");
  if (!content) return false;
  return content.includes("result") && !content.includes("reuslt");
});

s.checkProduct("no-other-changes", "Other functions in utils.js preserved", () => {
  const content = s.readFile("src/utils.js");
  if (!content) return false;
  return content.includes("parseCSV") && content.includes("formatDate");
});

// ── Behavioral ─────────────────────────────────────────────────────────

s.checkBehavior("finishes-success", "Agent finishes with success", () => {
  return s.finishStatus() === "success";
});

s.checkBehavior("no-context-spam", "context_updates absent or ≤2 entries (nothing durable to learn)", () => {
  if (!s.hasTranscript()) return true; // no transcript = pass by default
  const finishCalls = s.toolCalls("finish");
  for (const tc of finishCalls) {
    const updates = (tc.arguments || {}).context_updates;
    if (Array.isArray(updates) && updates.length > 2) return false;
  }
  return true;
});

s.checkBehavior("no-session-noise", "No context_updates about the specific fix (session-specific noise)", () => {
  if (!s.hasTranscript()) return true;
  const noisePatterns = ["typo", "reuslt", "fixed", "renamed", "spelling"];
  const finishCalls = s.toolCalls("finish");
  for (const tc of finishCalls) {
    const updates = (tc.arguments || {}).context_updates;
    if (!Array.isArray(updates)) continue;
    for (const u of updates) {
      const text = String(u.content).toLowerCase();
      if (noisePatterns.some(p => text.includes(p))) return false;
    }
  }
  return true;
});

// ── Efficiency ─────────────────────────────────────────────────────────

s.checkEfficiency("reasonable-ops", "Total operations ≤ 10", () => {
  return s.ops() <= 10;
});

s.report();
