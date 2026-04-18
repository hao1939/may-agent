/**
 * Tests for the date formatting module.
 * Run with: node test/dates.test.js
 */

const { formatDate, formatDateTime, parseISODate } = require('../src/dates');

let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (err) { failed++; failures.push({ name, error: err.message }); console.log(`  ✗ ${name}\n    ${err.message}`); }
}

function assertEqual(actual, expected, label = '') {
  if (actual !== expected) throw new Error(`${label}Expected "${expected}", got "${actual}"`);
}

console.log('\nDate formatting tests:');

test('formats date with double-digit month and day', () => {
  assertEqual(formatDate(new Date(2024, 10, 15)), '2024-11-15');
});

test('formats date with single-digit month', () => {
  assertEqual(formatDate(new Date(2024, 0, 15)), '2024-01-15');
});

test('formats date with single-digit day', () => {
  assertEqual(formatDate(new Date(2024, 11, 5)), '2024-12-05');
});

test('formats date with single-digit month AND day', () => {
  assertEqual(formatDate(new Date(2024, 0, 5)), '2024-01-05');
});

test('formats datetime correctly', () => {
  const d = new Date(2024, 5, 15, 9, 5, 3);
  assertEqual(formatDateTime(d), '2024-06-15 09:05:03');
});

test('rejects invalid dates', () => {
  try {
    formatDate(new Date('invalid'));
    throw new Error('Should have thrown');
  } catch (e) {
    if (!e.message.includes('Invalid date')) throw e;
  }
});

test('parseISODate works', () => {
  const d = parseISODate('2024-03-15');
  assertEqual(d.getFullYear(), 2024);
  assertEqual(d.getMonth(), 2);
  assertEqual(d.getDate(), 15);
});

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed`);
if (failures.length) { console.log('\nFailures:'); failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`)); }
process.exit(failed > 0 ? 1 : 0);
