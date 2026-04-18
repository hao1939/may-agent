const { calculateSubtotal, applyDiscount, calculateTax, calculateInvoice, validateOrder, formatCurrency } = require('../src/invoice');
const { getInvoice } = require('../src/billing-db');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.log(`  ✗ ${msg}`);
    failed++;
  }
}

function runTests() {
  console.log('=== Subtotal Tests ===');

  // Test 1: Calculate subtotal for INV-001
  const inv1 = getInvoice('INV-001');
  const sub1 = calculateSubtotal(inv1.items);
  assert(sub1 === 250.5, `INV-001 subtotal is 250.5 (got ${sub1})`);

  // Test 2: Calculate subtotal for INV-002 (all numeric amounts)
  const inv2 = getInvoice('INV-002');
  const sub2 = calculateSubtotal(inv2.items);
  assert(sub2 === 250, `INV-002 subtotal is 250 (got ${sub2})`);

  // Test 3: Subtotal is a number
  assert(typeof sub1 === 'number', `Subtotal type is number (got ${typeof sub1})`);

  console.log('\n=== Discount Tests ===');

  // Test 4: 10% discount
  assert(applyDiscount(100, 10) === 90, `10% off 100 is 90 (got ${applyDiscount(100, 10)})`);

  // Test 5: 0% discount returns original
  assert(applyDiscount(100, 0) === 100, `0% off 100 is 100 (got ${applyDiscount(100, 0)})`);

  // Test 6: 50% discount
  assert(applyDiscount(200, 50) === 100, `50% off 200 is 100 (got ${applyDiscount(200, 50)})`);

  console.log('\n=== Tax Tests ===');

  // Test 7: 8% tax on $100
  assert(calculateTax(100, 0.08) === 8, `8% tax on $100 is $8 (got ${calculateTax(100, 0.08)})`);

  // Test 8: Tax rounds properly
  assert(calculateTax(33.33, 0.08) === 2.67, `8% tax on $33.33 is $2.67 (got ${calculateTax(33.33, 0.08)})`);

  console.log('\n=== Full Invoice Tests ===');

  // Test 9: Full invoice calculation for INV-001
  const result1 = calculateInvoice(inv1.items, { discountPercent: inv1.discountPercent, taxRate: inv1.taxRate });
  assert(result1.subtotal === 250.5, `INV-001 invoice subtotal is 250.5 (got ${result1.subtotal})`);
  
  // Test 10: INV-001 discount (10% of 250.5 = 25.05)
  const expectedDiscount = 25.05;
  assert(
    Math.abs(result1.discount - expectedDiscount) < 0.001,
    `INV-001 discount is ~25.05 (got ${result1.discount})`
  );

  // Test 11: INV-001 taxable amount
  assert(result1.taxableAmount === 225.45, `INV-001 taxable is 225.45 (got ${result1.taxableAmount})`);

  console.log('\n=== Validation Tests ===');

  // Test 12: Valid order passes
  const valid = validateOrder(inv1.items);
  assert(valid.valid === true, `INV-001 order is valid (got ${JSON.stringify(valid)})`);

  // Test 13: Empty order fails
  const empty = validateOrder([]);
  assert(empty.valid === false, 'Empty order is invalid');

  console.log('\n=== Format Tests ===');

  // Test 14: Currency formatting
  assert(formatCurrency(1234.56) === '$1,234.56', `Format $1,234.56 (got ${formatCurrency(1234.56)})`);

  // Test 15: Currency formatting for small amount
  assert(formatCurrency(5) === '$5.00', `Format $5.00 (got ${formatCurrency(5)})`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
