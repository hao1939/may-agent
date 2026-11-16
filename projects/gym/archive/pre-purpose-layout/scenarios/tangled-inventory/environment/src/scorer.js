/**
 * Score Calculator
 * Computes weighted averages and applies curve
 */

function computeWeightedScores(students, policy) {
  const weights = policy.weights;
  
  return students.map(s => {
    // Compute weighted average
    const weighted = 
      s.homework * weights.homework +
      s.midterm * weights.midterm +
      s.final * weights.final +
      s.participation * weights.participation;
    
    return {
      ...s,
      weighted_score: Math.round(weighted * 100) / 100
    };
  });
}

function applyCurve(students, policy) {
  if (!policy.curve.enabled) return students;
  
  // Calculate class average
  const avg = students.reduce((sum, s) => sum + s.weighted_score, 0) / students.length;
  
  return students.map(s => {
    // Boost students who need the curve adjustment
    if (s.weighted_score >= avg) {
      return {
        ...s,
        weighted_score: Math.round((s.weighted_score + policy.curve.boost_points) * 100) / 100,
        curved: true
      };
    }
    return { ...s, curved: false };
  });
}

module.exports = { computeWeightedScores, applyCurve };
