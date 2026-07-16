/**
 * Test suite for grade processing pipeline
 * Run: node test/test.js
 * 
 * Tests verify the full pipeline: load → score → curve → grade → report
 * There are currently failing tests. Find and fix the bugs.
 */

const path = require('path');
const fs = require('fs');

// Run the pipeline
require('../process.js');

// Load the output
const report = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'output', 'report.json'), 'utf8'
));

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

function findStudent(id) {
  return report.students.find(s => s.student_id === id);
}

// === Structure Tests (should pass even with bugs) ===
console.log('\n=== Pipeline Structure ===');
check('report has students', report.students.length, 12);
check('report has class_statistics', typeof report.class_statistics, 'object');
check('report has grade_distribution', typeof report.grade_distribution, 'object');
check('report has honors_list', Array.isArray(report.honors_list), true);
check('each student has required fields', 
  report.students.every(s => 'student_id' in s && 'weighted_score' in s && 'letter_grade' in s && 'gpa' in s && 'curved' in s),
  true
);

// === Class Statistics ===
console.log('\n=== Class Statistics ===');
check('total students', report.class_statistics.total_students, 12);
check('class average', report.class_statistics.class_average, 81.16);
check('highest score', report.class_statistics.highest_score, 96.1);
check('lowest score', report.class_statistics.lowest_score, 52.95);
check('passing count', report.class_statistics.passing, 11);
check('failing count', report.class_statistics.failing, 1);

// === Curve Direction Test ===
// Students below average should be curved UP; students above should NOT
console.log('\n=== Curve Application ===');
check('S002 (below avg) should be curved', findStudent('S002').curved, true);
check('S004 (below avg) should be curved', findStudent('S004').curved, true);
check('S006 (below avg) should be curved', findStudent('S006').curved, true);
check('S001 (above avg) should NOT be curved', findStudent('S001').curved, false);
check('S010 (above avg) should NOT be curved', findStudent('S010').curved, false);
check('S003 (above avg) should NOT be curved', findStudent('S003').curved, false);

// === Key Student Scores ===
console.log('\n=== Key Student Scores ===');
check('S001 score (no curve, boundary case)', findStudent('S001').weighted_score, 90);
check('S004 score (curved, low performer)', findStudent('S004').weighted_score, 73.1);
check('S009 score (curved, boundary case)', findStudent('S009').weighted_score, 80);
check('S010 score (highest, no curve)', findStudent('S010').weighted_score, 96.1);
check('S006 score (curved, still failing)', findStudent('S006').weighted_score, 52.95);

// === Grade Boundary Tests ===
console.log('\n=== Letter Grades ===');
check('S001 grade (score=90, on A- boundary)', findStudent('S001').letter_grade, 'A-');
check('S003 grade (score=92.55)', findStudent('S003').letter_grade, 'A-');
check('S009 grade (score=80, on B- boundary)', findStudent('S009').letter_grade, 'B-');
check('S010 grade (top student)', findStudent('S010').letter_grade, 'A');
check('S006 grade (lowest)', findStudent('S006').letter_grade, 'F');
check('S005 grade (score=88.3)', findStudent('S005').letter_grade, 'B+');
check('S007 grade (score=83.5)', findStudent('S007').letter_grade, 'B');
check('S011 grade (score=61.75)', findStudent('S011').letter_grade, 'D');

// === Honors List ===
console.log('\n=== Honors List ===');
check('honors count (score >= 85 AND gpa >= 3.5)', report.honors_list.length, 3);
const honorsIds = report.honors_list.map(h => h.student_id).sort();
check('honors students', honorsIds, ['S001', 'S003', 'S010']);

// === Grade Distribution ===
console.log('\n=== Grade Distribution ===');
check('A count', report.grade_distribution['A'] || 0, 1);
check('A- count', report.grade_distribution['A-'] || 0, 2);
check('B+ count', report.grade_distribution['B+'] || 0, 2);
check('B count', report.grade_distribution['B'] || 0, 2);
check('F count', report.grade_distribution['F'] || 0, 1);

// === Summary ===
console.log(`\n=== Results: ${passed} passed, ${failed} failed out of ${passed + failed} ===`);
process.exit(failed > 0 ? 1 : 0);
