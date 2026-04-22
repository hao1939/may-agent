/**
 * Report Generator
 * Computes class statistics, honors list, and final report
 */
const fs = require('fs');

function generateReport(students, policy, outputPath) {
  // Class statistics (should use curved scores)
  const scores = students.map(s => s.weighted_score);
  const classAvg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
  
  const sorted = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const classMedian = sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100
    : sorted[mid];
  
  // Grade distribution
  const gradeDist = {};
  for (const s of students) {
    gradeDist[s.letter_grade] = (gradeDist[s.letter_grade] || 0) + 1;
  }
  
  // Honors list: students who meet BOTH min_score AND min_gpa_equivalent
  const honorsList = students.filter(s => 
    s.weighted_score >= policy.honors.min_score &&
    s.gpa >= policy.honors.min_gpa_equivalent
  ).map(s => ({
    student_id: s.student_id,
    name: s.name,
    score: s.weighted_score,
    grade: s.letter_grade,
    gpa: s.gpa
  }));
  
  // Pass/fail counts
  const passing = students.filter(s => s.gpa >= 1.0).length;
  const failing = students.length - passing;
  
  const report = {
    class_statistics: {
      total_students: students.length,
      class_average: classAvg,
      class_median: classMedian,
      highest_score: Math.max(...scores),
      lowest_score: Math.min(...scores),
      passing: passing,
      failing: failing
    },
    grade_distribution: gradeDist,
    honors_list: honorsList,
    students: students.map(s => ({
      student_id: s.student_id,
      name: s.name,
      weighted_score: s.weighted_score,
      letter_grade: s.letter_grade,
      gpa: s.gpa,
      curved: s.curved
    }))
  };
  
  fs.mkdirSync(require('path').dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  return report;
}

module.exports = { generateReport };
