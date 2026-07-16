/**
 * Format statistics as a human-readable report.
 */

function formatReport(stats) {
  if (!stats) return "No data available.";
  
  const lines = [
    "Score Analysis Report",
    "=====================",
    `Total scores: ${stats.count}`,
    `Sum: ${stats.sum}`,
    `Mean: ${stats.mean}`,
    `Median: ${stats.median}`,
    `Min: ${stats.min}`,
    `Max: ${stats.max}`,
    `Range: ${(stats.max - stats.min).toFixed(2)}`,
    "====================="
  ];
  
  return lines.join("\n");
}

module.exports = { formatReport };
