// pricing.test.js — Tests for pricing module
const { calculateTotal, applyDiscount } = require('./pricing');

function assert(condition, msg) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`PASS: ${msg}`);
}

// Test 1: basic total
const result1 = calculateTotal([{ price: 10, quantity: 2 }]);
assert(result1.subtotal === 20, 'subtotal is 20');
assert(result1.total === 21.6, 'total with 8% tax is 21.6');

// Test 2: multiple items
const result2 = calculateTotal([
  { price: 5, quantity: 3 },
  { price: 12, quantity: 1 }
]);
assert(result2.subtotal === 27, 'multi-item subtotal is 27');

// Test 3: custom tax rate
const result3 = calculateTotal([{ price: 100, quantity: 1 }], 0.1);
assert(result3.tax === 10, 'custom 10% tax on $100 is $10');

// Test 4: discount
assert(applyDiscount(100, 15) === 85, '15% discount on $100 is $85');

console.log('All tests passed!');
