/**
 * Test suite for data-pipeline
 * All 8 tests should pass when the code is correct.
 */
const { validateRecord, validateBatch } = require('./validator');
const { formatRecord, formatBatch, getQuarter } = require('./formatter');
const { processPipeline } = require('./pipeline');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

console.log('Validator tests:');

test('valid record passes validation', () => {
  const result = validateRecord({ name: 'Alice', amount: 100, date: '2025-03-15' });
  assert(result.valid === true, `Expected valid=true, got ${result.valid}. Errors: ${result.errors.join(', ')}`);
  assert(result.errors.length === 0, `Expected no errors, got: ${result.errors.join(', ')}`);
});

test('empty name fails validation', () => {
  const result = validateRecord({ name: '', amount: 100, date: '2025-03-15' });
  assert(result.valid === false, 'Expected valid=false for empty name');
});

test('negative amount fails validation', () => {
  const result = validateRecord({ name: 'Bob', amount: -50, date: '2025-03-15' });
  assert(result.valid === false, 'Expected valid=false for negative amount');
});

test('bad date format fails validation', () => {
  const result = validateRecord({ name: 'Carol', amount: 200, date: '15/03/2025' });
  assert(result.valid === false, 'Expected valid=false for bad date');
});

console.log('\nFormatter tests:');

test('getQuarter returns correct quarters', () => {
  assert(getQuarter('2025-01-15') === 'Q1', 'Jan should be Q1');
  assert(getQuarter('2025-06-15') === 'Q2', 'Jun should be Q2');
  assert(getQuarter('2025-09-15') === 'Q3', 'Sep should be Q3');
  assert(getQuarter('2025-12-15') === 'Q4', 'Dec should be Q4');
});

console.log('\nPipeline integration tests:');

test('pipeline exports valid records with correct structure', () => {
  const result = processPipeline([
    { name: 'Alice', amount: 100, date: '2025-03-15' },
    { name: 'Bob', amount: 200, date: '2025-07-20' }
  ]);
  assert(result.summary.exported === 2, `Expected 2 exported, got ${result.summary.exported}`);
  assert(result.summary.rejected === 0, `Expected 0 rejected, got ${result.summary.rejected}`);
  // This check catches Bug B (amount_cents as string) — but ONLY after Bug A is fixed,
  // because with Bug A, exported=0 and this test fails on the line above instead.
  assert(typeof result.exported[0].amount_cents === 'number',
    `Expected amount_cents to be a number, got ${typeof result.exported[0].amount_cents}`);
  assert(result.exported[0].amount_cents === 10000,
    `Expected amount_cents=10000, got ${result.exported[0].amount_cents}`);
});

test('pipeline separates valid and invalid records', () => {
  const result = processPipeline([
    { name: 'Alice', amount: 100, date: '2025-03-15' },
    { name: '', amount: -5, date: 'bad-date' },
    { name: 'Carol', amount: 50, date: '2025-11-01' }
  ]);
  assert(result.summary.exported === 2, `Expected 2 exported, got ${result.summary.exported}`);
  assert(result.summary.rejected === 1, `Expected 1 rejected, got ${result.summary.rejected}`);
  assert(result.rejected[0].index === 1, `Expected rejected index=1, got ${result.rejected[0].index}`);
});

test('pipeline formatted records have correct fields', () => {
  const result = processPipeline([
    { name: 'Alice', amount: 100, date: '2025-03-15' }
  ]);
  assert(result.exported.length === 1, `Expected 1 exported, got ${result.exported.length}`);
  const rec = result.exported[0];
  assert(rec.id === 'alice-20250315', `Expected id alice-20250315, got ${rec.id}`);
  assert(rec.display_name === 'ALICE', `Expected ALICE, got ${rec.display_name}`);
  assert(rec.formatted_amount === '$100.00', `Expected $100.00, got ${rec.formatted_amount}`);
  assert(rec.quarter === 'Q1', `Expected Q1, got ${rec.quarter}`);
  assert(typeof rec.amount_cents === 'number', `amount_cents should be number, got ${typeof rec.amount_cents}`);
});

console.log(`\nResults: ${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.log(`${failed} test(s) failed`);
  process.exit(1);
}
