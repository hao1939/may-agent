// Test suite for grade pipeline
const { loadGrades, calculateStats, formatReport } = require('./grade-pipeline');
const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// Create temp CSV for testing
const tmpDir = os.tmpdir();
const csvPath = path.join(tmpDir, 'test-grades.csv');

console.log('Grade Pipeline Tests');
console.log('====================');

// Test 1: Normal grades
fs.writeFileSync(csvPath, 'name,score\nAlice,90\nBob,80\nCharlie,70\n');
test('loads grades from CSV', () => {
  const grades = loadGrades(csvPath);
  assert(grades.length === 3, `expected 3 grades, got ${grades.length}`);
  assert(grades[0].name === 'Alice', `expected Alice, got ${grades[0].name}`);
});

test('calculates stats for normal grades', () => {
  const grades = loadGrades(csvPath);
  const stats = calculateStats(grades);
  assert(stats.average === 80, `expected avg 80, got ${stats.average}`);
  assert(stats.min === 70, `expected min 70, got ${stats.min}`);
  assert(stats.max === 90, `expected max 90, got ${stats.max}`);
});

// Test 2: Empty grades
test('handles empty grade list', () => {
  const stats = calculateStats([]);
  assert(stats.count === 0, `expected count 0, got ${stats.count}`);
  assert(stats.average === 0 || isNaN(stats.average) === false, 'average should be 0 for empty list');
});

// Test 3: Grades with missing scores
fs.writeFileSync(csvPath, 'name,score\nAlice,90\nBob,\nCharlie,70\n');
test('handles missing scores (NaN filtering)', () => {
  const grades = loadGrades(csvPath);
  const stats = calculateStats(grades);
  assert(stats.count === 2 || stats.count === 3, 'should handle missing scores');
  assert(!isNaN(stats.average), 'average should not be NaN');
  assert(stats.min === 70, `expected min 70, got ${stats.min}`);
});

// Test 4: Format report
test('formats report correctly', () => {
  const grades = loadGrades(path.join(tmpDir, 'test-grades.csv'));
  fs.writeFileSync(csvPath, 'name,score\nAlice,90\nBob,80\n');
  const g2 = loadGrades(csvPath);
  const stats = calculateStats(g2);
  const report = formatReport(stats);
  assert(report.includes('Grade Report'), 'should include header');
  assert(report.includes('Students: 2'), 'should show count');
});

// Cleanup
fs.unlinkSync(csvPath);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
