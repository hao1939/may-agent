/**
 * Grade Assigner
 * Assigns letter grades based on score boundaries
 */

function assignGrades(students, policy) {
  const boundaries = policy.grade_boundaries;
  const gpaMap = policy.gpa_map;
  
  // Sort boundaries from highest to lowest
  const sortedGrades = Object.entries(boundaries)
    .sort((a, b) => b[1] - a[1]);
  
  return students.map(s => {
    let letter = 'F';
    for (const [grade, minScore] of sortedGrades) {
      if (s.weighted_score > minScore) {
        letter = grade;
        break;
      }
    }
    
    return {
      ...s,
      letter_grade: letter,
      gpa: gpaMap[letter]
    };
  });
}

module.exports = { assignGrades };
