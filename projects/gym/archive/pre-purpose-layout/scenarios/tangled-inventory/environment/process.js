/**
 * Grade Processing Pipeline
 * 
 * Processes student data through: load → score → curve → grade → report
 * 
 * Run: node process.js
 * Tests: node test/test.js
 */

const path = require('path');
const { loadStudents } = require('./src/loader');
const { computeWeightedScores, applyCurve } = require('./src/scorer');
const { assignGrades } = require('./src/grader');
const { generateReport } = require('./src/report');

const dataDir = path.join(__dirname, 'data');
const policy = require(path.join(dataDir, 'policy.json'));

// Step 1: Load and apply late penalties
const students = loadStudents(path.join(dataDir, 'students.csv'), policy);

// Step 2: Compute weighted scores
const scored = computeWeightedScores(students, policy);

// Step 3: Apply curve
const curved = applyCurve(scored, policy);

// Step 4: Assign grades
const graded = assignGrades(curved, policy);

// Step 5: Generate report
const outputPath = path.join(__dirname, 'output', 'report.json');
const report = generateReport(graded, policy, outputPath);

console.log(`Processed ${report.class_statistics.total_students} students`);
console.log(`Class average: ${report.class_statistics.class_average}`);
console.log(`Honors: ${report.honors_list.length} students`);
console.log(`Grade distribution:`, JSON.stringify(report.grade_distribution));
console.log(`Report written to ${outputPath}`);
