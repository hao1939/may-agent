/**
 * Regression-from-fix scenario scorer.
 * 
 * The bug: In billing.js, the discount lookup uses undefined variable `code`
 * instead of `discountCode`. The fix is simple: change `code` to `discountCode`.
 * 
 * What we check (file-level, not transcript-based):
 * 1. The discount bug is actually fixed (code executes correctly)
 * 2. Tax-exempt functionality still works (no regression)
 * 3. Invoice generation still works
 * 4. The fix is minimal (didn't rewrite the whole file)
 * 5. Tax calculations are correct with discount
 * 6. All tests pass when run
 * 
 * Usage: node success_criteria.js <workDir>
 */

const fs = require('fs');
const path = require('path');

const workDir = process.argv[2] || __dirname;

const results = {
  scenario: 'regression-from-fix',
  passed: false,
  checks: [],
  summary: ''
};

function check(name, fn) {
  try {
    const result = fn();
    results.checks.push({ name, passed: result.passed, detail: result.detail });
    return result.passed;
  } catch (err) {
    results.checks.push({ name, passed: false, detail: `Error: ${err.message}` });
    return false;
  }
}

// Helper: load billing module from work dir
function loadBilling() {
  const billingPath = path.join(workDir, 'src', 'billing.js');
  // Clear require cache
  delete require.cache[require.resolve(billingPath)];
  return require(billingPath);
}

// Check 1: Discount bug is fixed — SAVE20 on $100 gives correct result
check('discount-bug-fixed', () => {
  const { calculateTotal } = loadBilling();
  const result = calculateTotal(100, 'SAVE20');
  const discountCorrect = result.discount === 20;
  const totalCorrect = result.total === 86.4; // (100-20)*1.08 = 86.40
  return {
    passed: discountCorrect && totalCorrect,
    detail: discountCorrect && totalCorrect
      ? 'SAVE20 discount works: $100 → $20 off → $86.40 total'
      : `SAVE20 on $100: discount=${result.discount} (expected 20), total=${result.total} (expected 86.4)`
  };
});

// Check 2: Tax-exempt still works correctly
check('tax-exempt-preserved', () => {
  const { calculateTaxExemptTotal } = loadBilling();
  const result = calculateTaxExemptTotal(100, 'SAVE20');
  const taxZero = result.tax === 0;
  const totalCorrect = result.total === 80; // $100 - $20, no tax
  const markedExempt = result.taxExempt === true;
  return {
    passed: taxZero && totalCorrect && markedExempt,
    detail: taxZero && totalCorrect && markedExempt
      ? 'Tax-exempt works: $100 - $20 discount = $80 total, tax=0, taxExempt=true'
      : `Tax-exempt broken: tax=${result.tax} (expect 0), total=${result.total} (expect 80), taxExempt=${result.taxExempt}`
  };
});

// Check 3: Invoice generation still works
check('invoice-works', () => {
  const { generateInvoice } = loadBilling();
  const items = [
    { name: 'Widget', qty: 2, price: 25 },
    { name: 'Gadget', qty: 1, price: 50 }
  ];
  const result = generateInvoice(items, 'LOYALTY');
  const linesCorrect = result.lines.length === 2;
  const subtotalCorrect = result.subtotal === 100;
  const discountCorrect = result.discount === 15; // 15% of 100
  const totalCorrect = result.total === 91.8; // (100-15)*1.08 = 91.80
  return {
    passed: linesCorrect && subtotalCorrect && discountCorrect && totalCorrect,
    detail: linesCorrect && subtotalCorrect && discountCorrect && totalCorrect
      ? 'Invoice generation works correctly with LOYALTY discount'
      : `Invoice issue: lines=${result.lines?.length}, subtotal=${result.subtotal}, discount=${result.discount}, total=${result.total}`
  };
});

// Check 4: Fix is minimal — billing.js still has all original functions
check('minimal-fix', () => {
  const billingPath = path.join(workDir, 'src', 'billing.js');
  const content = fs.readFileSync(billingPath, 'utf-8');
  
  // Check that all three functions are still present
  const hasCalculateTotal = content.includes('function calculateTotal');
  const hasTaxExempt = content.includes('function calculateTaxExemptTotal');
  const hasInvoice = content.includes('function generateInvoice');
  const hasTaxRate = content.includes('TAX_RATE');
  const hasDiscountCodes = content.includes('DISCOUNT_CODES');
  
  // Check file wasn't drastically rewritten (original is ~70 lines)
  const lineCount = content.split('\n').length;
  const reasonableLength = lineCount >= 40 && lineCount <= 120;
  
  const allPresent = hasCalculateTotal && hasTaxExempt && hasInvoice && hasTaxRate && hasDiscountCodes && reasonableLength;
  return {
    passed: allPresent,
    detail: allPresent
      ? 'Fix is minimal — all original functions and constants preserved'
      : `File structure changed: calculateTotal=${hasCalculateTotal}, taxExempt=${hasTaxExempt}, invoice=${hasInvoice}, lines=${lineCount}`
  };
});

// Check 5: FLAT10 discount works too (tests multiple discount types)
check('flat-discount-works', () => {
  const { calculateTotal } = loadBilling();
  const result = calculateTotal(50, 'FLAT10');
  const discountCorrect = result.discount === 10;
  const totalCorrect = result.total === 43.2; // (50-10)*1.08 = 43.20
  return {
    passed: discountCorrect && totalCorrect,
    detail: discountCorrect && totalCorrect
      ? 'FLAT10 discount works: $50 - $10 = $40 → $43.20 with tax'
      : `FLAT10 on $50: discount=${result.discount} (expected 10), total=${result.total} (expected 43.2)`
  };
});

// Check 6: No-discount case still works (no regression on base case)
check('no-discount-works', () => {
  const { calculateTotal } = loadBilling();
  const result = calculateTotal(100, null);
  const noDiscount = result.discount === 0;
  const totalCorrect = result.total === 108; // 100 * 1.08 = 108
  return {
    passed: noDiscount && totalCorrect,
    detail: noDiscount && totalCorrect
      ? 'No-discount case preserved: $100 → $108 with tax'
      : `No-discount case: discount=${result.discount} (expected 0), total=${result.total} (expected 108)`
  };
});

// Overall pass: all checks passed
results.passed = results.checks.every(c => c.passed);
results.summary = results.passed 
  ? 'All checks passed — bug fixed without regressions'
  : `${results.checks.filter(c => c.passed).length}/${results.checks.length} checks passed`;

console.log(JSON.stringify(results));
process.exit(results.passed ? 0 : 1);
