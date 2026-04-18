/**
 * Invoice Calculator Tests
 * Run: node test/invoice-tests.js
 */

const { subtotal, applyDiscount, calculateTax, invoiceSummary } = require('../src/invoice');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${message}`);
  }
}

function assertClose(actual, expected, message, tolerance = 0.001) {
  if (Math.abs(actual - expected) < tolerance) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${message} (got ${actual}, expected ${expected})`);
  }
}

// ─── Subtotal Tests ──────────────────────────────────────────────

console.log('\n== Subtotal ==');

assert(subtotal([]) === 0, 'empty items = 0');
assert(subtotal([{quantity: 2, unitPrice: 10}]) === 20, 'single item');
assert(subtotal([{quantity: 1, unitPrice: 5}, {quantity: 3, unitPrice: 7}]) === 26, 'multiple items');
assert(subtotal(null) === 0, 'null returns 0');

// ─── Discount Tests ──────────────────────────────────────────────

console.log('\n== Discount ==');

assert(applyDiscount(100, 10) === 90, '10% off $100');
assert(applyDiscount(100, 0) === 100, '0% discount');
assert(applyDiscount(100, 100) === 0, '100% discount');
assertClose(applyDiscount(49.99, 15), 42.49, '15% off $49.99');

let threw = false;
try { applyDiscount(100, -5); } catch { threw = true; }
assert(threw, 'negative discount throws');

threw = false;
try { applyDiscount(100, 101); } catch { threw = true; }
assert(threw, 'over-100 discount throws');

// ─── Tax Tests ───────────────────────────────────────────────────

console.log('\n== Tax ==');

assertClose(calculateTax(100, 0.08), 8.00, '8% tax on $100');
assertClose(calculateTax(0, 0.08), 0, '8% tax on $0');

// Tax rounding: 29.99 * 0.08 = 2.3992, expected 2.40
assert(
  calculateTax(29.99, 0.08) === 2.40,
  'tax should round to cents: $29.99 × 8% = $2.40'
);

// Tax rounding: 47.50 * 0.0625 = 2.96875, expected 2.97
assert(
  calculateTax(47.50, 0.0625) === 2.97,
  'tax should round to cents: $47.50 × 6.25% = $2.97'
);

// ─── Invoice Summary Tests ───────────────────────────────────────

console.log('\n== Invoice Summary ==');

const items = [
  { quantity: 2, unitPrice: 25.00 },
  { quantity: 1, unitPrice: 15.00 }
];
const summary = invoiceSummary(items, 10, 0.08);

assert(summary.subtotal === 65, 'summary subtotal');
assert(summary.discount === 6.5, 'summary discount amount');
assert(summary.taxableAmount === 58.5, 'summary taxable amount after discount');

assertClose(summary.tax, 4.68, 'summary tax');
assertClose(summary.total, 63.18, 'summary total');

// Discount edge case with rounding
const items2 = [
  { quantity: 1, unitPrice: 14.99 },
  { quantity: 1, unitPrice: 18.98 }
];
assert(
  applyDiscount(subtotal(items2), 20) === 27.17,
  'discount on $33.97 at 20%'
);

// ─── Summary ─────────────────────────────────────────────────────

console.log(`\n== Results: ${passed} passed, ${failed} failed ==`);
process.exit(failed > 0 ? 1 : 0);
