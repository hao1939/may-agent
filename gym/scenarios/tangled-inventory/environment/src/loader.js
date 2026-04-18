/**
 * Student Data Loader
 * Reads CSV and applies late penalties
 */
const fs = require('fs');

function loadStudents(csvPath, policy) {
  const lines = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const student = {};
    headers.forEach((h, i) => {
      student[h] = isNaN(vals[i]) ? vals[i] : Number(vals[i]);
    });
    
    // Apply late penalty to the specified component
    const penaltyField = policy.late_penalty.applies_to;
    const penalty = Math.min(
      student.late_days * policy.late_penalty.points_per_day,
      policy.late_penalty.max_penalty
    );
    student[penaltyField] = Math.max(0, student[penaltyField] - penalty);
    
    return student;
  });
}

module.exports = { loadStudents };
