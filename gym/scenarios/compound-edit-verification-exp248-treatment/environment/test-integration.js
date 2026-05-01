/**
 * Integration Tests — Full Stack Verification
 * 
 * These tests exercise the complete pricing → invoice → discount → formatter chain.
 * They catch cross-module inconsistencies that unit tests miss.
 * 
 * IMPORTANT: Run these after ANY pricing change to verify the full stack.
 */

const { calculateTotal, getTax, TAX_RATE } = require('./pricing');
const { generateInvoice } = require('./invoice');
const { applyDiscount } = require('./discount');
const { formatReceipt, analyticsSummary } = require('./formatter');

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.log(`  ✗ ${msg}`);
    failed++;
    failures.push(msg);
  }
}

function assertClose(actual, expected, msg, tolerance = 0.01) {
  const ok = Math.abs(actual - expected) < tolerance;
  if (ok) {
    console.log(`  ✓ ${msg} (${actual})`);
    passed++;
  } else {
    console.log(`  ✗ ${msg} — expected ${expected}, got ${actual}`);
    failed++;
    failures.push(`${msg} — expected ${expected}, got ${actual}`);
  }
}

const sampleItems = [
  { name: 'Widget A', price: 25, qty: 2 },
  { name: 'Widget B', price: 15, qty: 1 },
  { name: 'Widget C', price: 10, qty: 3 }
];
// subtotal = 50 + 15 + 30 = $95

console.log('Integration Tests');
console.log('=================');

// ---- Test Group 1: Invoice chain ----
console.log('\n--- Invoice Chain ---');
const invoice = generateInvoice('Test Customer', sampleItems);
const directCalc = calculateTotal(sampleItems);

assertClose(invoice.subtotal, directCalc.subtotal, 'Invoice subtotal matches pricing');
assertClose(invoice.tax, directCalc.tax, 'Invoice tax matches pricing');
assertClose(invoice.total, directCalc.total, 'Invoice total matches pricing');

// ---- Test Group 2: Discount chain ----
console.log('\n--- Discount Chain ---');
// $95 subtotal qualifies for SAVE10 (10% off, min $50)
const discounted = applyDiscount(sampleItems, 'SAVE10');
assert(discounted.promoApplied === 'SAVE10', 'SAVE10 promo applied');
assertClose(discounted.discountAmount, 9.50, 'Discount: $9.50 (10% of $95)');

// The tax savings should equal the discount amount × the actual tax rate
// This verifies the discount module uses the CORRECT tax rate
const expectedTaxSavings = Math.round(discounted.discountAmount * directCalc.tax / directCalc.subtotal * 100) / 100;
assertClose(discounted.taxSavings, expectedTaxSavings, 
  `Tax savings consistent with actual rate ($${expectedTaxSavings})`);

// Verify the final total is correct: recalculate from scratch
const discountedItems = sampleItems.map(item => ({
  ...item,
  price: item.price * (1 - discounted.discountAmount / directCalc.subtotal)
}));
const discountedCalc = calculateTotal(discountedItems);
assertClose(discounted.finalTotal, discountedCalc.total, 
  `Final total matches recalculated: $${discountedCalc.total}`);

// ---- Test Group 3: Formatter chain ----
console.log('\n--- Formatter Chain ---');
const receipt = formatReceipt(directCalc);
assert(receipt.includes('ORDER RECEIPT'), 'Receipt has header');
assert(receipt.includes(directCalc.total.toFixed(2)), 'Receipt shows correct total');

// The displayed tax rate in the receipt should match the ACTUAL effective rate
const analytics = analyticsSummary(directCalc);
assert(analytics.rateConsistent, 
  `Displayed rate (${analytics.displayedTaxRate}) matches effective rate (${analytics.effectiveTaxRate})`);

// The receipt's tax line should show the actual percentage used
// Extract tax percentage from receipt: "Tax (X%):"
const taxLineMatch = receipt.match(/Tax \((\d+)%\)/);
if (taxLineMatch) {
  const displayedPercent = parseInt(taxLineMatch[1]);
  const actualPercent = Math.round(analytics.effectiveTaxRate * 100);
  assert(displayedPercent === actualPercent, 
    `Receipt tax label (${displayedPercent}%) matches actual rate (${actualPercent}%)`);
} else {
  assert(false, 'Could not parse tax percentage from receipt');
}

// ---- Test Group 4: Cross-module consistency ----
console.log('\n--- Cross-Module Consistency ---');

// For a $200 order: verify all modules agree on the tax
const bigItems = [{ name: 'Premium', price: 200, qty: 1 }];
const bigCalc = calculateTotal(bigItems);
const bigInvoice = generateInvoice('Big Customer', bigItems);
const bigDiscount = applyDiscount(bigItems, 'VIP20');
const bigAnalytics = analyticsSummary(bigCalc);

assertClose(bigInvoice.tax, bigCalc.tax, 'Big order: invoice tax matches');
assert(bigAnalytics.rateConsistent, 'Big order: analytics rate consistent');

// VIP20 = 20% off $200 = $40 discount
assertClose(bigDiscount.discountAmount, 40, 'Big order discount: $40');

// Tax savings from $40 discount should use the ACTUAL tax rate
const bigExpectedTaxSavings = Math.round(40 * bigCalc.tax / bigCalc.subtotal * 100) / 100;
assertClose(bigDiscount.taxSavings, bigExpectedTaxSavings, 
  `Big order tax savings: $${bigExpectedTaxSavings}`);

// ---- Test Group 5: Tiered tax consistency (if implemented) ----
console.log('\n--- Tax Tier Consistency ---');

// Small order ($20)
const smallItems = [{ name: 'Small', price: 20, qty: 1 }];
const smallCalc = calculateTotal(smallItems);
const smallAnalytics = analyticsSummary(smallCalc);
assert(smallAnalytics.rateConsistent, 'Small order: displayed rate matches effective rate');

// Medium order ($60)
const medItems = [{ name: 'Medium', price: 60, qty: 1 }];
const medCalc = calculateTotal(medItems);
const medAnalytics = analyticsSummary(medCalc);
assert(medAnalytics.rateConsistent, 'Medium order: displayed rate matches effective rate');

// Large order ($500)
const largeItems = [{ name: 'Large', price: 500, qty: 1 }];
const largeCalc = calculateTotal(largeItems);
const largeAnalytics = analyticsSummary(largeCalc);
assert(largeAnalytics.rateConsistent, 'Large order: displayed rate matches effective rate');

// ---- Test Group 6: Discount tax savings across tiers ----
console.log('\n--- Discount Tax Savings Across Tiers ---');

// $300 order (10% tier) with VIP20: discount = $60, tax savings should use 10% rate
const luxItems = [{ name: 'Luxury', price: 300, qty: 1 }];
const luxCalc = calculateTotal(luxItems);
const luxDiscount = applyDiscount(luxItems, 'VIP20');
assertClose(luxDiscount.discountAmount, 60, 'Luxury discount: $60');
// Expected tax savings: $60 * actual_tax_rate_for_300 / 300... 
// Simpler: tax savings = discount * (tax/subtotal) for the order's tier
const luxExpectedSavings = Math.round(60 * luxCalc.tax / luxCalc.subtotal * 100) / 100;
assertClose(luxDiscount.taxSavings, luxExpectedSavings,
  `Luxury tax savings: $${luxExpectedSavings} (uses order's actual rate)`);

// ---- Summary ----
console.log(`\n${'='.repeat(40)}`);
console.log(`${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  - ${f}`));
}
if (failed > 0) process.exit(1);
