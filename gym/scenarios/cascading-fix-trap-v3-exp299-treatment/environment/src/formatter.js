/**
 * Report Formatter
 *
 * Generates structured output from grade results and statistics.
 */

function formatReport(gradeResults, stats) {
  return {
    students: gradeResults.map(r => ({
      id: r.student_id,
      homework: r.homework_avg,
      midterm: r.midterm_pct,
      final: r.final_pct,
      weighted: r.weighted_score,
      grade: r.letter_grade,
    })),
    class_stats: {
      count: stats.count,
      mean: stats.mean,
      median: stats.median,
      std_dev: stats.std_dev,
      grade_distribution: stats.distribution,
    },
  };
}

module.exports = { formatReport };
