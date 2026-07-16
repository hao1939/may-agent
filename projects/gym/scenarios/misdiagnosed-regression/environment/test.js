// test.js - Order processing tests
// Tests updated in PR #247 to cover extracted pricing module

const { processOrder } = require('./src/order');
const { calculateBasePrice } = require('./src/pricing');
const { calculateTax } = require('./src/tax');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    Expected: ${e.expected}`);
    console.log(`    Actual:   ${e.actual}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    const err = new Error(message || `${actual} !== ${expected}`);
    err.actual = actual;
    err.expected = expected;
    throw err;
  }
}

// === Pricing Tests ===
console.log('\nPricing Tests:');

test('single item no discount', () => {
  assertEqual(calculateBasePrice(10, 5), 50);
});

test('10+ items get 5% discount', () => {
  // 10 items at $10 = $100 - 5% = $95
  assertEqual(calculateBasePrice(10, 10), 95);
});

test('50+ items get 10% discount', () => {
  // 50 items at $20 = $1000 - 10% = $900
  assertEqual(calculateBasePrice(20, 50), 900);
});

test('bulk order rounding precision', () => {
  // 75 items at $9.99, 10% discount
  // Correct: round(9.99 * 75 * 0.90 * 100) / 100 = 674.33
  const result = calculateBasePrice(9.99, 75);
  assertEqual(result, 674.33, 'Bulk pricing should round the total, not per-unit');
});

test('zero quantity returns 0', () => {
  assertEqual(calculateBasePrice(10, 0), 0);
});

// === Tax Tests ===
console.log('\nTax Tests:');

test('California tax rate', () => {
  assertEqual(calculateTax(100, 'US-CA', { name: 'Alice', taxExempt: false }), 7.25);
});

test('Oregon no tax', () => {
  assertEqual(calculateTax(100, 'US-OR', { name: 'Bob', taxExempt: false }), 0);
});

test('tax-exempt boolean customer', () => {
  assertEqual(calculateTax(100, 'US-CA', { name: 'Gov', taxExempt: true }), 0);
});

test('tax-exempt string customer from API', () => {
  // Customer data from external API returns taxExempt as string "true"
  // This should still be treated as tax-exempt
  assertEqual(calculateTax(100, 'US-CA', { name: 'Embassy', taxExempt: 'true' }), 0,
    'String "true" from API should be treated as tax-exempt');
});

test('non-exempt customer pays tax', () => {
  assertEqual(calculateTax(100, 'US-NY', { name: 'Eve', taxExempt: false }), 8);
});

test('unknown region throws', () => {
  try {
    calculateTax(100, 'MARS', { name: 'Alien' });
    throw { actual: 'no error', expected: 'Error thrown' };
  } catch (e) {
    if (!e.message || !e.message.includes('Unknown tax region')) {
      throw { actual: e.message, expected: 'Error about unknown region' };
    }
  }
});

// === Integration Tests ===
console.log('\nIntegration Tests:');

test('simple order processing', () => {
  const result = processOrder(
    [{ name: 'Widget', unitPrice: 25, quantity: 4, weightKg: 0.5 }],
    'US-CA',
    { name: 'Alice', taxExempt: false }
  );
  assertEqual(result.subtotal, 100);
  assertEqual(result.shipping, 0); // Free shipping over $100
  assertEqual(result.tax, 7.25);
  assertEqual(result.total, 107.25);
});

test('bulk order with discount', () => {
  const result = processOrder(
    [{ name: 'Gadget', unitPrice: 9.99, quantity: 75, weightKg: 0.1 }],
    'US-TX',
    { name: 'Bob', taxExempt: false }
  );
  // 75 items at $9.99, 10% discount = $674.33
  assertEqual(result.subtotal, 674.33, 'Subtotal should be correctly rounded');
});

test('tax-exempt API customer order', () => {
  const result = processOrder(
    [{ name: 'Supply', unitPrice: 50, quantity: 2, weightKg: 1 }],
    'US-CA',
    { name: 'Embassy', taxExempt: 'true' }
  );
  // 2 items at $50, no discount = $100
  // Tax-exempt, so tax should be 0
  assertEqual(result.tax, 0, 'API customer with taxExempt "true" should pay no tax');
});

// === Summary ===
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed}`);
process.exit(failed > 0 ? 1 : 0);
