/**
 * billing.test.js — Tests for billing module
 */
const { createInvoice, applyDiscount, formatCurrency, calculateTax } = require('./billing');

let passed = 0, failed = 0;

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    console.log(`FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertThrows(fn, label) {
  try {
    fn();
    console.log(`FAIL: ${label} — expected throw`);
    failed++;
  } catch {
    passed++;
  }
}

// Test createInvoice
const invoice = createInvoice([
  { name: 'Widget', price: 10, quantity: 2 },
  { name: 'Gadget', price: 25, quantity: 1 },
]);
assertEqual(invoice.subtotal, 45, 'invoice subtotal');

// Test applyDiscount
const discounted = applyDiscount({ subtotal: 100 }, 10);
assertEqual(discounted.discount, 10, 'discount amount');
assertEqual(discounted.subtotal, 90, 'discounted subtotal');

// Test discount validation
assertThrows(() => applyDiscount({ subtotal: 100 }, -5), 'negative discount throws');
assertThrows(() => applyDiscount({ subtotal: 100 }, 150), 'over 100 discount throws');

// Test formatCurrency
assertEqual(formatCurrency(99.5), '$99.50', 'format currency');

// Test calculateTax
assertEqual(calculateTax(100), 8, 'tax on 100');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
