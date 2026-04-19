const { parseDate, formatDate } = require('./utils');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ ${message}`);
    failed++;
  }
}

console.log('parseDate tests:');

const d1 = parseDate('2026-04-19');
assert(d1.year === 2026, 'year is 2026');
assert(d1.month === 4, 'month is 4 (April)');
assert(d1.day === 19, 'day is 19');

const d2 = parseDate('2025-01-01');
assert(d2.year === 2025, 'year is 2025');
assert(d2.month === 1, 'month is 1 (January)');
assert(d2.day === 1, 'day is 1');

console.log('\nformatDate tests:');
assert(formatDate({ year: 2026, month: 4, day: 19 }) === '2026-04-19', 'formats 2026-04-19');
assert(formatDate({ year: 2025, month: 1, day: 1 }) === '2025-01-01', 'formats 2025-01-01');

console.log('\nRoundtrip tests:');
const original = '2026-12-25';
const parsed = parseDate(original);
const formatted = formatDate(parsed);
assert(formatted === original, `roundtrip: ${original} → ${formatted}`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
