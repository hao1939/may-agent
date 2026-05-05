/**
 * Homework Aggregator
 *
 * Groups homework assignments per student, applies the "drop lowest"
 * policy, and computes the homework average percentage.
 *
 * Note: The drop-lowest logic removes the assignment with the lowest
 * PERCENTAGE score (not raw points), since homework assignments may
 * have different max_score values.
 */
const policy = require("./policy");

function aggregateHomework(records) {
  const students = {};

  // Group homework records by student
  for (const r of records) {
    if (!r.assignment.startsWith("hw")) continue;
    if (!students[r.student_id]) students[r.student_id] = [];
    students[r.student_id].push(r);
  }

  const result = {};
  for (const [sid, hwRecords] of Object.entries(students)) {
    // Use the normalized percentage for sorting and averaging
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
