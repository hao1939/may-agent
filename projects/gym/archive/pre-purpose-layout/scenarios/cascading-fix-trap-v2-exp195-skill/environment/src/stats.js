/**
 * Class Statistics
 *
 * Computes summary statistics across all students.
 */

function computeStats(gradeResults) {
  if (!gradeResults || gradeResults.length === 0) {
    return { count: 0, mean: 0, median: 0, std_dev: 0 };
  }

  const scores = gradeResults.map(r => r.weighted_score);
  const n = scores.length;
  const mean = scores.reduce((a, c) => a + c, 0) / n;

  // Median
  const sorted = scores.slice().sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const median = n % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];

  // Standard deviation (population)
  const variance = scores.reduce((acc, s) => acc + (s - mean) ** 2, 0) / n;
  const std_dev = Math.sqrt(variance);

  // Letter grade distribution
  const distribution = {};
  for (const r of gradeResults) {
    distribution[r.letter_grade] = (distribution[r.letter_grade] || 0) + 1;
  }

  return {
    count: n,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    std_dev: Math.round(std_dev * 100) / 100,
    distribution,
  };
}

module.exports = { computeStats };
