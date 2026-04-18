/**
 * test.js — Tests for the data processing pipeline
 */

const { validateRecords } = require('./src/validator');
const { transformRecords } = require('./src/transformer');
const { aggregateRecords } = require('./src/aggregator');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || ''} Expected ${expected}, got ${actual}`);
  }
}

function assertClose(actual, expected, tolerance, msg) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${msg || ''} Expected ~${expected} (±${tolerance}), got ${actual}`);
  }
}

console.log('Validator tests:');

test('accepts valid records', () => {
  const result = validateRecords([
    { id: 1, name: 'Test', category: 'electronics', amount: '10.50', quantity: 2 }
  ]);
  assertEqual(result.valid.length, 1, 'valid count');
  assertEqual(result.invalid.length, 0, 'invalid count');
});

test('rejects invalid category', () => {
  const result = validateRecords([
    { id: 1, name: 'Test', category: 'toys', amount: '10.00', quantity: 1 }
  ]);
  assertEqual(result.valid.length, 0, 'valid count');
  assertEqual(result.invalid.length, 1, 'invalid count');
});

test('rejects missing name', () => {
  const result = validateRecords([
    { id: 1, name: '', category: 'food', amount: '5.00', quantity: 1 }
  ]);
  assertEqual(result.valid.length, 0, 'valid count');
});

console.log('\nTransformer tests:');

test('preserves decimal amounts', () => {
  const result = transformRecords([
    { id: 1, name: 'Test', category: 'food', amount: '49.95', quantity: 1 }
  ]);
  // amount should be 49.95, not 49
  assertClose(result[0].amount, 49.95, 0.01, 'amount');
  assertClose(result[0].lineTotal, 49.95, 0.01, 'lineTotal');
});

test('applies category discounts correctly', () => {
  const result = transformRecords([
    { id: 1, name: 'Test', category: 'electronics', amount: '100.00', quantity: 1 }
  ]);
  // electronics = 5% discount: 100 * 0.95 = 95
  assertClose(result[0].discountedTotal, 95.00, 0.01, 'discounted');
});

test('calculates tax correctly', () => {
  const result = transformRecords([
    { id: 1, name: 'Test', category: 'food', amount: '100.00', quantity: 1 }
  ]);
  // food = 0% discount, 8.5% tax: 100 * 1.085 = 108.50
  assertClose(result[0].finalTotal, 108.50, 0.01, 'finalTotal');
});

test('handles quantity multiplication', () => {
  const result = transformRecords([
    { id: 1, name: 'Test', category: 'food', amount: '10.50', quantity: 3 }
  ]);
  // lineTotal = 10.50 * 3 = 31.50
  assertClose(result[0].lineTotal, 31.50, 0.01, 'lineTotal');
});

console.log('\nAggregator tests:');

test('calculates total revenue', () => {
  const records = [
    { id: 1, name: 'A', category: 'food', finalTotal: 100.00 },
    { id: 2, name: 'B', category: 'food', finalTotal: 200.00 }
  ];
  const result = aggregateRecords(records);
  assertClose(result.totalRevenue, 300.00, 0.01, 'total');
});

test('groups by category', () => {
  const records = [
    { id: 1, name: 'A', category: 'food', finalTotal: 100.00 },
    { id: 2, name: 'B', category: 'books', finalTotal: 200.00 },
    { id: 3, name: 'C', category: 'food', finalTotal: 50.00 }
  ];
  const result = aggregateRecords(records);
  assertEqual(result.categoryBreakdown.food.count, 2, 'food count');
  assertClose(result.categoryBreakdown.food.revenue, 150.00, 0.01, 'food revenue');
});

console.log('\nIntegration tests:');

test('full pipeline produces correct totals', () => {
  const input = [
    { id: 1, name: 'Widget', category: 'electronics', amount: '29.99', quantity: 2 },
    { id: 2, name: 'Book', category: 'books', amount: '15.50', quantity: 1 }
  ];
  const validated = validateRecords(input);
  const transformed = transformRecords(validated.valid);
  const result = aggregateRecords(transformed);
  
  // Widget: 29.99 * 2 = 59.98, -5% = 56.981, +8.5% = 61.824385 ≈ 61.82
  // Book: 15.50 * 1 = 15.50, -15% = 13.175, +8.5% = 14.294875 ≈ 14.29
  // Total: 61.82 + 14.29 = 76.11
  assertClose(result.totalRevenue, 76.12, 0.10, 'total revenue');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
