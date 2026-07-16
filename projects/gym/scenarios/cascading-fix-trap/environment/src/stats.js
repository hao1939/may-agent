/**
 * Simple statistics calculator for numeric arrays.
 */

function calcStats(numbers) {
  if (!numbers.length) return null;
  
  const sorted = numbers.slice().sort();
  const sum = numbers.reduce((a, b) => a + b, 0);
  const count = numbers.length;
  const mean = sum / count;
  
  // Median
  let median;
  const mid = Math.floor(count / 2);
  if (count % 2 === 0) {
    median = (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    median = sorted[mid];
  }
  
  return {
    count,
    sum: round2(sum),
    mean: round2(mean),
    median: round2(median),
    min: sorted[0],
    max: sorted[sorted.length - 1]
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { calcStats };
