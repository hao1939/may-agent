/**
 * Test suite for the price calculator.
 * DO NOT MODIFY THIS FILE.
 * 
 * Expected values use standard rounding (Math.round) with 8.5% tax.
 */

const { calculateItemTotal, calculateOrderTotal, resolveDiscount } = require('./src/calculator');
const { validateItem, validateOrder } = require('./src/validator');
const { formatReceipt } = require('./src/formatter');

let passed = 0;
let failed = 0;

function assert(name, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}: expected ${expected}, got ${actual}`);
    failed++;
  }
}

// --- Discount Resolution ---
console.log('\nDiscount resolution:');
assert('no discount → 0', resolveDiscount(undefined), 0);
assert('SAVE10 → 0.10', resolveDiscount('SAVE10'), 0.10);
assert('numeric 15 → 0.15', resolveDiscount(15), 0.15);
assert('unknown code → 0', resolveDiscount('BOGUS99'), 0);

// --- Validation ---
console.log('\nValidation:');
const validResult = validateItem({ name: 'Widget', price: 9.99, quantity: 2 });
assert('valid item passes', validResult.valid, true);

const invalidResult = validateItem({ name: '', price: -1, quantity: 0 });
assert('invalid item fails', invalidResult.valid, false);

// This uses a non-standard discount code format but should still validate
// (discount format warning is cosmetic, not a validation error)
const weirdDiscount = validateItem({ name: 'Gadget', price: 5.00, quantity: 1, discount: 'save-10' });
assert('non-standard discount code still validates', weirdDiscount.valid, true);

// --- Single Item Calculations ---
console.log('\nSingle item calculations (8.5% tax):');

// $10.00 * 1, no discount: 10.00 * 1.085 = 10.85
assert('simple item no discount', 
  calculateItemTotal({ name: 'A', price: 10.00, quantity: 1 }), 10.85);

// $25.00 * 2, SAVE10 (10% off): 50.00 * 0.90 * 1.085 = 48.825 → 48.83
assert('item with 10% string discount',
  calculateItemTotal({ name: 'B', price: 25.00, quantity: 2, discount: 'SAVE10' }), 48.83);

// $19.99 * 3, 15% off: 59.97 * 0.85 * 1.085 = 55.3073... → 55.31
assert('item with 15% numeric discount',
  calculateItemTotal({ name: 'C', price: 19.99, quantity: 3, discount: 15 }), 55.31);

// $7.50 * 1, no discount: 7.50 * 1.085 = 8.1375 → 8.14
assert('item rounding up',
  calculateItemTotal({ name: 'D', price: 7.50, quantity: 1 }), 8.14);

// $12.99 * 2, HALF (50% off): 25.98 * 0.50 * 1.085 = 14.09415 → 14.09
assert('item with 50% discount',
  calculateItemTotal({ name: 'E', price: 12.99, quantity: 2, discount: 'HALF' }), 14.09);

// --- Order Totals ---
console.log('\nOrder totals:');

const order1 = calculateOrderTotal([
  { name: 'Widget', price: 7.50, quantity: 1 },
  { name: 'Gizmo', price: 12.99, quantity: 2, discount: 'HALF' }
]);
// 8.14 + 14.09 = 22.23
assert('two-item order subtotal', order1.subtotal, 22.23);
assert('order has 2 line items', order1.lineItems.length, 2);

const order2 = calculateOrderTotal([
  { name: 'Alpha', price: 25.00, quantity: 2, discount: 'SAVE10' },
  { name: 'Beta', price: 19.99, quantity: 3, discount: 15 },
  { name: 'Gamma', price: 10.00, quantity: 1 }
]);
// 48.83 + 55.31 + 10.85 = 114.99
assert('three-item order subtotal', order2.subtotal, 114.99);

// --- Formatting ---
console.log('\nFormatting:');
const receipt = formatReceipt(order1);
assert('receipt contains total', receipt.includes('$22.23'), true);
assert('receipt contains item name', receipt.includes('Widget'), true);

// --- Summary ---
console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failed > 0) {
  console.log('TESTS FAILED');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
}
