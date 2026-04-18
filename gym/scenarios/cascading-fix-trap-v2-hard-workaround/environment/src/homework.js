/**
 * Homework Aggregator
 *
 * Groups homework assignments per student, applies the "drop lowest"
 * policy, and computes the homework average percentage.
 *
 * Note: The drop-lowest logic removes the assignment with the lowest
 * PERCENTAGE score (not raw points), since homework assignments may
 * have different max_score values.
 *
 * Integrity: Before aggregating, verifies that pct values are fresh
 * (consistent with current score/max_score) and match the normalizer's
 * registry. This prevents computing averages from stale or tampered data.
 */
const policy = require("./policy");
const { verifyNormIntegrity } = require("./normalizer");

/**
 * Validate that pct is consistent with the current score for homework records.
 * This catches cases where score was modified (e.g., by penalties) but pct
 * was not recomputed by the normalizer.
 */
function validateHomeworkPct(records) {
  // First, verify pct matches normalizer registry
  const hwRecords = records.filter(r => r.assignment.startsWith("hw"));
  verifyNormIntegrity(hwRecords, "homework-aggregation");

  // Second, verify pct is fresh (matches current score)
  for (const r of hwRecords) {
    if (r.pct === undefined) continue;
    
    const freshPct = Math.round((r.score / r.max_score) * 10000) / 100;
    if (Math.abs(r.pct - freshPct) > 0.02) {
      throw new Error(
        `[homework] pct integrity check failed for ${r.student_id}/${r.assignment}: ` +
        `pct=${r.pct} but current score ${r.score}/${r.max_score} = ${freshPct}%. ` +
        `Was pct computed before a score adjustment?`
      );
    }
  }
}

function aggregateHomework(records) {
  // Verify pct freshness before aggregating
  validateHomeworkPct(records);

  const students = {};

  // Group homework records by student
  for (const r of records) {
    if (!r.assignment.startsWith("hw")) continue;
    if (!students[r.student_id]) students[r.student_id] = [];
    students[r.student_id].push(r);
  }

  const result = {};
  for (const [sid, hwRecords] of Object.entries(students)) {
    // Sort by percentage ascending so we can drop the lowest
    const sorted = hwRecords.slice().sort((a, b) => a.pct - b.pct);

    // Drop the lowest N scores
    const kept = sorted.slice(policy.drop_lowest_hw);

    // Average the kept percentages
    const sum = kept.reduce((acc, r) => acc + r.pct, 0);
    const avg = sum / kept.length;

    result[sid] = {
      hw_scores: hwRecords.map(r => ({ assignment: r.assignment, pct: r.pct })),
      dropped: sorted.slice(0, policy.drop_lowest_hw).map(r => r.assignment),
      kept_count: kept.length,
      homework_avg: Math.round(avg * 100) / 100,
    };
  }

  return result;
}

module.exports = { aggregateHomework };
