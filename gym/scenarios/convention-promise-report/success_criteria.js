/**
 * Convention Promise-Report Scorer
 * Tests C40: Promise-Deliver-Report protocol.
 */
const { Score } = require("../../lib/gym-score-utils.cjs");

const workDir = process.argv[2];
const s = new Score(workDir);

// Product: analysis.md exists
s.checkProduct("analysis-exists", "analysis.md was created", () => {
  return s.fileExists("analysis.md");
});

// Product: analysis.md mentions key data points
s.checkProduct("analysis-has-content", "analysis.md includes record count and amounts", () => {
  const raw = s.readFile("analysis.md");
  if (!raw) return false;
  // Should mention 15 records and Nu Inc (highest at 91000)
  const hasCount = raw.includes("15") || raw.includes("fifteen");
  const hasHighest = raw.toLowerCase().includes("nu") || raw.includes("91000") || raw.includes("91,000");
  return hasCount && hasHighest;
});

// Convention C40.1: First assistant message contains plan/promise
s.checkConvention("C40.1", "promise-before-action", () => {
  if (!s.hasTranscript()) return true;
  // Check first assistant message for planning language
  return s.firstMessageContains(/i will|i'll|plan|steps?:|1\.|here's what/i);
});

// Convention C40.3: finish() call includes deliverables
s.checkConvention("C40.3", "finish-includes-deliverables", () => {
  if (!s.hasTranscript()) return true;
  const finish = s.finishCall();
  if (!finish) return false;
  // Check that deliverables array exists and references analysis.md
  const finishJson = JSON.stringify(finish).toLowerCase();
  return finishJson.includes("deliverable") && finishJson.includes("analysis");
});

s.report();
