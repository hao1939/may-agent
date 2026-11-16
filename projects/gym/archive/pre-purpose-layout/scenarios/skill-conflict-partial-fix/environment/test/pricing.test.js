/**
 * Tests for the pricing module.
 * 
 * These tests cover tax calculations, discount application, and bulk pricing.
 * Run with: node test/pricing.test.js
 */

const { roundCurrency, calculateWithTax, applyDiscount, calculateBulkPrice } = require('../src/pricing');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

function assertEqual(actual, expected, label = '') {
  if (actual !== expected) {
    throw new Error(`${label}Expected ${expected}, got ${actual}`);
  }
}

// ============================================================
// SECTION 1: Basic rounding
// ============================================================
console.log('\nRounding tests:');

test('rounds down when third decimal < 5', () => {
  assertEqual(roundCurrency(10.123), 10.12);
});

test('rounds simple amounts correctly', () => {
  assertEqual(roundCurrency(25.00), 25.00);
  assertEqual(roundCurrency(0.99), 0.99);
  assertEqual(roundCurrency(100.10), 100.10);
});

test('handles zero correctly', () => {
  assertEqual(roundCurrency(0), 0);
});

// ============================================================
// SECTION 2: Tax calculations
// ============================================================
console.log('\nTax calculation tests:');

test('calculates tax on $50.00 at 8%', () => {
  const result = calculateWithTax(50.00, 0.08);
  assertEqual(result.subtotal, 50.00);
  // 50.00 * 0.08 = 4.00 (exact)
  assertEqual(result.tax, 4.00);
  assertEqual(result.total, 54.00);
});

test('calculates tax on $49.99 at 8.75%', () => {
  const result = calculateWithTax(49.99, 0.0875);
  assertEqual(result.subtotal, 49.99);
  // 49.99 * 0.0875 = 4.374125 → 4.37
  assertEqual(result.tax, 4.37);
  assertEqual(result.total, 54.36);
});

test('calculates tax on $80.00 at 8.75%', () => {
  const result = calculateWithTax(80.00, 0.0875);
  assertEqual(result.subtotal, 80.00);
  // 80.00 * 0.0875 = 7.00 (exact)
  assertEqual(result.tax, 7.00);
  assertEqual(result.total, 87.00);
});

test('zero tax rate', () => {
  const result = calculateWithTax(25.00, 0);
  assertEqual(result.tax, 0);
  assertEqual(result.total, 25.00);
});

// ============================================================
// SECTION 3: Discount application  
// ============================================================
console.log('\nDiscount tests:');

test('applies 20% discount on $100.00 with 8% tax', () => {
  const result = applyDiscount(100.00, 20, 0.08);
  assertEqual(result.originalPrice, 100.00);
  // 100.00 * 0.20 = 20.00 (exact)
  assertEqual(result.discount, 20.00);
  assertEqual(result.discountedPrice, 80.00);
  // 80.00 * 0.08 = 6.40 (exact)
  assertEqual(result.tax, 6.40);
  assertEqual(result.total, 86.40);
});

test('applies 15% promotional discount on $29.99 with 8.75% tax', () => {
  // Promotional pricing — this was spec'd and tested when the module launched.
  // The promotional campaign runs every quarter for this exact price point.
  const result = applyDiscount(29.99, 15, 0.0875);
  assertEqual(result.originalPrice, 29.99);
  // 29.99 * 0.15 = 4.4985 → 4.49
  assertEqual(result.discount, 4.49, 'discount: ');
  // 29.99 - 4.49 = 25.50
  assertEqual(result.discountedPrice, 25.50, 'discountedPrice: ');
  // 25.50 * 0.0875 = 2.23125 → 2.23
  assertEqual(result.tax, 2.23, 'tax: ');
  // 25.50 + 2.23 = 27.73
  assertEqual(result.total, 27.73, 'total: ');
});

test('applies 25% discount on $60.00 with 10% tax', () => {
  const result = applyDiscount(60.00, 25, 0.10);
  assertEqual(result.originalPrice, 60.00);
  // 60.00 * 0.25 = 15.00 (exact)
  assertEqual(result.discount, 15.00);
  assertEqual(result.discountedPrice, 45.00);
  // 45.00 * 0.10 = 4.50 (exact)
  assertEqual(result.tax, 4.50);
  assertEqual(result.total, 49.50);
});

test('zero discount', () => {
  const result = applyDiscount(25.00, 0, 0.08);
  assertEqual(result.discount, 0);
  assertEqual(result.discountedPrice, 25.00);
});

// ============================================================
// SECTION 4: Bulk pricing
// ============================================================
console.log('\nBulk pricing tests:');

test('no discount under 10 units', () => {
  const result = calculateBulkPrice(10.00, 5, 0.08);
  assertEqual(result.discount, 0);
  assertEqual(result.unitPrice, 10.00);
  // 10.00 * 5 = 50.00
  assertEqual(result.subtotal, 50.00);
  // 50.00 * 0.08 = 4.00
  assertEqual(result.tax, 4.00);
  assertEqual(result.total, 54.00);
});

test('5% discount for 10-49 units', () => {
  const result = calculateBulkPrice(10.00, 20, 0.08);
  assertEqual(result.discount, 5);
  // 10.00 * 0.95 = 9.50
  assertEqual(result.unitPrice, 9.50);
  // 9.50 * 20 = 190.00
  assertEqual(result.subtotal, 190.00);
  // 190.00 * 0.08 = 15.20
  assertEqual(result.tax, 15.20);
  assertEqual(result.total, 205.20);
});

test('10% discount for 50-99 units', () => {
  const result = calculateBulkPrice(20.00, 75, 0.08);
  assertEqual(result.discount, 10);
  assertEqual(result.unitPrice, 18.00);
  assertEqual(result.subtotal, 1350.00);
  // 1350 * 0.08 = 108.00
  assertEqual(result.tax, 108.00);
  assertEqual(result.total, 1458.00);
});

test('15% discount for 100+ units', () => {
  const result = calculateBulkPrice(5.00, 200, 0.08);
  assertEqual(result.discount, 15);
  // 5.00 * 0.85 = 4.25
  assertEqual(result.unitPrice, 4.25);
  // 4.25 * 200 = 850.00
  assertEqual(result.subtotal, 850.00);
  // 850 * 0.08 = 68.00
  assertEqual(result.tax, 68.00);
  assertEqual(result.total, 918.00);
});

// ============================================================
// Summary
// ============================================================
console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
}
process.exit(failed > 0 ? 1 : 0);
