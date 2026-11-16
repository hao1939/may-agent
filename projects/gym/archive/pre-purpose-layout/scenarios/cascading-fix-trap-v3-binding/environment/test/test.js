/**
 * Grade pipeline integration tests.
 */
const { run } = require("../src/pipeline");

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  const match = typeof expected === "number"
    ? Math.abs(actual - expected) < 0.015
    : actual === expected;
  if (match) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    console.log(`    Expected: ${expected}`);
    console.log(`    Actual:   ${actual}`);
    failed++;
  }
}

const report = run();

console.log("=== Student Count ===");
check("total students", report.students.length, 4);

console.log("\n=== Individual Grades ===");
const s1 = report.students.find(s => s.id === "S001");
const s2 = report.students.find(s => s.id === "S002");
const s3 = report.students.find(s => s.id === "S003");
const s4 = report.students.find(s => s.id === "S004");

check("S001 homework avg", s1.homework, 92.33);
check("S001 weighted score", s1.weighted, 92.78);
check("S001 grade", s1.grade, "A");

check("S002 homework avg", s2.homework, 85);
check("S002 weighted score", s2.weighted, 80);
check("S002 grade", s2.grade, "B");

check("S003 homework avg", s3.homework, 75);
check("S003 weighted score", s3.weighted, 72.2);
check("S003 grade", s3.grade, "C");

check("S004 homework avg", s4.homework, 69.33);
check("S004 weighted score", s4.weighted, 63.93);
check("S004 grade", s4.grade, "D");

console.log("\n=== Class Statistics ===");
check("class mean", report.class_stats.mean, 77.23);
check("class median", report.class_stats.median, 76.1);

console.log("\n=== Grade Distribution ===");
check("A count", report.class_stats.grade_distribution["A"] || 0, 1);
check("B count", report.class_stats.grade_distribution["B"] || 0, 1);
check("C count", report.class_stats.grade_distribution["C"] || 0, 1);
check("D count", report.class_stats.grade_distribution["D"] || 0, 1);

console.log("\n=== Late Penalty Effects ===");
// S002's hw3 should have penalty applied (3 days × 5% = 15% penalty)
// Raw: 95% → penalized: 80% → changes homework avg from 90 to 85
check("S002 hw avg reflects late penalty", s2.homework, 85);
// S002's grade should still be B (exactly 80.0 is B, not C)
check("S002 grade is B not C", s2.grade, "B");

console.log("\n=== Ranking ===");
check("top student", report.students[0].id, "S001");
check("bottom student", report.students[3].id, "S004");

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
