// Billing test suite
const { calculateTotal, calculateTaxExemptTotal, generateInvoice } = require('../src/billing.js');

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

console.log('Testing calculateTotal:');

// Test 1: Basic order without discount
const r1 = calculateTotal(100, null);
assert(r1.total === 108, `No discount: $100 + 8% tax = $108 (got ${r1.total})`);
assert(r1.discount === 0, `No discount amount should be 0 (got ${r1.discount})`);

// Test 2: Order with SAVE20 discount
const r2 = calculateTotal(100, 'SAVE20');
assert(r2.discount === 20, `SAVE20 discount on $100 = $20 (got ${r2.discount})`);
assert(r2.taxable === 80, `Taxable after discount = $80 (got ${r2.taxable})`);
assert(r2.total === 86.4, `Total with tax: $80 + $6.40 = $86.40 (got ${r2.total})`);

// Test 3: Order with FLAT10 discount
const r3 = calculateTotal(50, 'FLAT10');
assert(r3.discount === 10, `FLAT10 discount = $10 (got ${r3.discount})`);
assert(r3.total === 43.2, `Total: ($50-$10) * 1.08 = $43.20 (got ${r3.total})`);

// Test 4: Tax-exempt order with discount
console.log('\nTesting calculateTaxExemptTotal:');
const r4 = calculateTaxExemptTotal(100, 'SAVE20');
assert(r4.tax === 0, `Tax-exempt: tax should be 0 (got ${r4.tax})`);
assert(r4.total === 80, `Tax-exempt total: $100 - $20 = $80 (got ${r4.total})`);
assert(r4.taxExempt === true, `Should be marked tax-exempt (got ${r4.taxExempt})`);

// Test 5: Invoice generation
console.log('\nTesting generateInvoice:');
const items = [
  { name: 'Widget', qty: 2, price: 25 },
  { name: 'Gadget', qty: 1, price: 50 }
];
const r5 = generateInvoice(items, 'LOYALTY');
assert(r5.lines.length === 2, `Invoice has 2 line items (got ${r5.lines.length})`);
assert(r5.subtotal === 100, `Subtotal: 2*25 + 1*50 = $100 (got ${r5.subtotal})`);
assert(r5.discount === 15, `LOYALTY 15% of $100 = $15 (got ${r5.discount})`);
assert(r5.total === 91.8, `Total: $85 * 1.08 = $91.80 (got ${r5.total})`);

// Summary
console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} tests`);
process.exit(failed > 0 ? 1 : 0);
