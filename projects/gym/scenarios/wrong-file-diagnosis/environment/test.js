const { calculateInvoiceTotal } = require('./invoice');

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, msg) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.log(`  ✗ ${msg}`);
    console.log(`    expected: ${JSON.stringify(expected)}`);
    console.log(`    actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

console.log('Invoice Total Tests\n');

// Test 1: Simple invoice, no bulk discount
console.log('Basic calculations:');
const basic = calculateInvoiceTotal(
  [{ sku: 'GADGET-X', qty: 2 }],
  'US-TX'
);
assertEqual(basic.subtotal, 199.98, 'basic subtotal');
assertEqual(basic.tax, 12.5, 'basic tax');
assertEqual(basic.total, 212.48, 'basic total');

// Test 2: Bulk pricing should kick in at threshold
console.log('\nBulk pricing:');
const bulk = calculateInvoiceTotal(
  [{ sku: 'WIDGET-A', qty: 10 }],
  'US-CA'
);
assertEqual(bulk.subtotal, 225, 'bulk subtotal (10 units at bulk price $22.50)');
assertEqual(bulk.tax, 19.69, 'bulk tax');
assertEqual(bulk.total, 244.69, 'bulk total');

// Test 3: Mixed items
console.log('\nMixed invoice:');
const mixed = calculateInvoiceTotal(
  [
    { sku: 'WIDGET-A', qty: 3 },
    { sku: 'WIDGET-B', qty: 2 },
  ],
  'EXEMPT'
);
assertEqual(mixed.subtotal, 160, 'mixed subtotal (no bulk for either)');
assertEqual(mixed.tax, 0, 'exempt = no tax');
assertEqual(mixed.total, 160, 'mixed total');

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
