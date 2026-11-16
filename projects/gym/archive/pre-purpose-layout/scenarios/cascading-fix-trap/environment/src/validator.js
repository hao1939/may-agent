/**
 * Validates score arrays before analysis.
 * Ensures no negative values, no NaN, reasonable range.
 */

function validateScores(scores) {
  const errors = [];
  
  scores.forEach((score, idx) => {
    if (typeof score !== "number" || isNaN(score)) {
      errors.push(`Index ${idx}: not a valid number`);
    } else if (score < 0) {
      errors.push(`Index ${idx}: negative value (${score})`);
    } else if (score > 100) {
      errors.push(`Index ${idx}: exceeds maximum (${score})`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    count: scores.length
  };
}

module.exports = { validateScores };
