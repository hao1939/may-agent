/**
 * Pricing Module Tests
 * Updated 2026-04-10 to match refactored implementation
 */

const { calculateLineItem, calculateTax, calculateOrder, roundCurrency } = require('../src/pricing');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}${msg ? ': ' + msg : ''}`);
  }
}

console.log('\nPricing Module Tests\n');

// === roundCurrency ===
console.log('roundCurrency:');

test('rounds down below .5', () => {
  assertEqual(roundCurrency(10.124), 10.12);
});

test('rounds up at .5', () => {
  // Note: Updated to match current implementation
  assertEqual(roundCurrency(10.125), 10.13);
});

test('rounds up above .5', () => {
  assertEqual(roundCurrency(10.126), 10.13);
});

test('handles exact values', () => {
  assertEqual(roundCurrency(10.10), 10.10);
});

test('handles zero', () => {
  assertEqual(roundCurrency(0), 0);
});

// === calculateLineItem ===
console.log('\ncalculateLineItem:');

test('simple multiplication', () => {
  assertEqual(calculateLineItem(9.99, 3), 29.97);
});

test('handles single unit', () => {
  assertEqual(calculateLineItem(15.50, 1), 15.50);
});

test('rounds result correctly', () => {
  // 7.99 * 3 = 23.97 (no rounding needed)
  assertEqual(calculateLineItem(7.99, 3), 23.97);
});

// === calculateTax ===
console.log('\ncalculateTax:');

test('standard tax rate', () => {
  // 100 * 0.0825 = 8.25
  assertEqual(calculateTax(100, 0.0825), 8.25);
});

test('tax on odd amount', () => {
  // 29.97 * 0.0825 = 2.472525 → rounds to 2.47
  assertEqual(calculateTax(29.97, 0.0825), 2.47);
});

// === calculateOrder ===
console.log('\ncalculateOrder:');

test('single item order', () => {
  const order = calculateOrder([
    { name: 'Widget', unitPrice: 9.99, quantity: 3 }
  ]);
  assertEqual(order.subtotal, 29.97);
  assertEqual(order.tax, 2.47);
  assertEqual(order.total, 32.44);
});

test('multi-item order', () => {
  const order = calculateOrder([
    { name: 'Widget', unitPrice: 9.99, quantity: 2 },
    { name: 'Gadget', unitPrice: 24.95, quantity: 1 }
  ]);
  // 9.99*2 = 19.98, 24.95*1 = 24.95, subtotal = 44.93
  // tax = 44.93 * 0.0825 = 3.706725 → 3.71
  assertEqual(order.subtotal, 44.93);
  assertEqual(order.tax, 3.71);
  assertEqual(order.total, 48.64);
});

test('zero tax rate', () => {
  const order = calculateOrder([
    { name: 'Widget', unitPrice: 10.00, quantity: 1 }
  ], 0);
  assertEqual(order.subtotal, 10.00);
  assertEqual(order.tax, 0);
  assertEqual(order.total, 10.00);
});

// === Summary ===
console.log(`\n${passed} passing, ${failed} failing\n`);
process.exit(failed > 0 ? 1 : 0);
