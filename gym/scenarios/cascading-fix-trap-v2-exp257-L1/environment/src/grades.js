/**
 * Final Grade Calculator
 *
 * Computes weighted final grades from homework averages, midterm,
 * and final exam scores.
 *
 * Weighted formula:
 *   final_grade = homework_avg * hw_weight
 *                + midterm_pct * midterm_weight  
 *                + final_pct * final_weight
 */
const policy = require("./policy");

function computeFinalGrades(records, homeworkAggs) {
  const students = {};

  // Collect exam scores per student
  for (const r of records) {
    if (!students[r.student_id]) {
      students[r.student_id] = {};
    }
    if (r.assignment === "midterm") {
      students[r.student_id].midterm_pct = r.pct;
    }
    if (r.assignment === "final") {
      students[r.student_id].final_pct = r.pct;
    }
  }

  const results = [];

  for (const [sid, exams] of Object.entries(students)) {
    const hwAvg = homeworkAggs[sid]?.homework_avg || 0;
    const midPct = exams.midterm_pct || 0;
    const finPct = exams.final_pct || 0;

    // Weighted average
    const weighted = (
      hwAvg    * policy.weights.homework +
      midPct   * policy.weights.midterm +
      finPct   * policy.weights.final
    );

    const finalGrade = Math.round(weighted * 100) / 100;

    // Determine letter grade
    const letter = getLetterGrade(finalGrade);

    results.push({
      student_id: sid,
      homework_avg: hwAvg,
      midterm_pct: midPct,
      final_pct: finPct,
      weighted_score: finalGrade,
      letter_grade: letter,
    });
  }

  // Sort by weighted score descending
  results.sort((a, b) => b.weighted_score - a.weighted_score);
  return results;
}

function getLetterGrade(score) {
  // Walk the grade scale from highest to lowest
  const scale = Object.entries(policy.grade_scale);
  scale.sort((a, b) => b[1] - a[1]);

  for (const [letter, threshold] of scale) {
    if (score > threshold) return letter;
  }
  return "F";
}

module.exports = { computeFinalGrades, getLetterGrade };
