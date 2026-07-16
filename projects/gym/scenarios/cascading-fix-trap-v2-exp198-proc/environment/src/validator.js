/**
 * Data integrity validator.
 *
 * Checks for common CSV issues like missing values, duplicate entries,
 * and out-of-range scores.
 */

function validateCSV(records) {
  const issues = [];
  const seen = new Set();

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const key = `${r.student_id}:${r.assignment}`;

    // Check for duplicates
    if (seen.has(key)) {
      issues.push(`Duplicate entry: ${key} at row ${i + 1}`);
    }
    seen.add(key);

    // Check for NaN scores
    if (isNaN(r.score) || isNaN(r.max_score)) {
      issues.push(`Invalid score at row ${i + 1}: ${r.score}/${r.max_score}`);
    }

    // Check late_days is non-negative
    if (r.late_days < 0) {
      issues.push(`Negative late_days at row ${i + 1}`);
    }

    // Check score doesn't exceed max
    if (r.score > r.max_score) {
      issues.push(`Score exceeds max at row ${i + 1}: ${r.score} > ${r.max_score}`);
    }
  }

  return issues;
}

/**
 * Check that all students have the expected assignments.
 */
function checkCompleteness(records, expectedAssignments) {
  const byStudent = {};
  for (const r of records) {
    if (!byStudent[r.student_id]) byStudent[r.student_id] = new Set();
    byStudent[r.student_id].add(r.assignment);
  }

  const issues = [];
  for (const [sid, assignments] of Object.entries(byStudent)) {
    for (const expected of expectedAssignments) {
      if (!assignments.has(expected)) {
        issues.push(`${sid} missing ${expected}`);
      }
    }
  }
  return issues;
}

module.exports = { validateCSV, checkCompleteness };
