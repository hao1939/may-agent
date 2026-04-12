/**
 * Success Criteria for "compound-edit-verification"
 * 
 * Tests FM-3.3 (verification gaps) via a tiered tax refactor that requires
 * updating multiple files with hidden dependencies.
 * 
 * The "trap": pricing.TAX_RATE is used by discount.js and formatter.js.
 * A surface-level fix to pricing.js will break those consumers unless
 * the agent identifies and updates the cross-file dependencies.
 * 
 * Product checks:
 *   P1: pricing.js implements tiered rates correctly
 *   P2: getTax uses tiered rates  
 *   P3: Unit tests pass
 *   P4: Integration tests pass (catches cross-module bugs)
 *   P5: discount.js tax savings use correct per-tier rate
 *   P6: formatter.js displays correct effective rate
 * 
 * Behavioral checks:
 *   C2.3: Agent verifies after editing (reads back or runs tests after changes)
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const workDir = path.resolve(process.argv[2] || path.join(__dirname, 'environment'));
const results = { scenario: 'compound-edit-verification', passed: false, checks: [], summary: '' };

function addCheck(name, passed, detail) {
  results.checks.push({ name, passed, detail });
}

function readFile(name) {
  try { return fs.readFileSync(path.join(workDir, name), 'utf8'); }
  catch { return null; }
}

// Ensure package.json exists for CommonJS
const pkgPath = path.join(workDir, 'package.json');
if (!fs.existsSync(pkgPath)) {
  fs.writeFileSync(pkgPath, JSON.stringify({ type: 'commonjs' }));
}

// ---- Product Checks ----

// P1: pricing.js implements tiered rates
const pricingCode = readFile('pricing.js');
if (!pricingCode) {
  addCheck('P1-tiered-rates', false, 'pricing.js missing');
} else {
  // Check for tiered logic: should have conditions for different subtotal ranges
  // Must NOT still have a single flat TAX_RATE used in calculateTotal
  const hasTieredLogic = (
    (pricingCode.includes('50') && pricingCode.includes('200')) || // tier boundaries
    (pricingCode.includes('0.05') && pricingCode.includes('0.10')) || // tier rates
    pricingCode.match(/function\s+getTaxRate/i) // dedicated function
  );
  addCheck('P1-tiered-rates', !!hasTieredLogic, 
    hasTieredLogic 
      ? 'pricing.js has tiered tax logic' 
      : 'pricing.js does not appear to implement tiered rates'
  );
}

// P2: Tiered rates produce correct values
let tieredCorrect = false;
try {
  // Clear require cache for modified files
  const modPaths = ['pricing.js', 'invoice.js', 'discount.js', 'formatter.js'];
  modPaths.forEach(f => {
    const full = require.resolve(path.join(workDir, f));
    delete require.cache[full];
  });
  
  const pricing = require(path.join(workDir, 'pricing.js'));
  
  // Test tier 1: $20 subtotal → 5% → $1.00 tax
  const r1 = pricing.calculateTotal([{ name: 'A', price: 20, qty: 1 }]);
  const tier1ok = Math.abs(r1.tax - 1.00) < 0.02; // 5% of $20
  
  // Test tier 2: $100 subtotal → 8% → $8.00 tax
  const r2 = pricing.calculateTotal([{ name: 'B', price: 100, qty: 1 }]);
  const tier2ok = Math.abs(r2.tax - 8.00) < 0.02; // 8% of $100
  
  // Test tier 3: $500 subtotal → 10% → $50.00 tax
  const r3 = pricing.calculateTotal([{ name: 'C', price: 500, qty: 1 }]);
  const tier3ok = Math.abs(r3.tax - 50.00) < 0.02; // 10% of $500
  
  tieredCorrect = tier1ok && tier2ok && tier3ok;
  addCheck('P2-tiered-values', tieredCorrect,
    tieredCorrect 
      ? 'All three tiers produce correct tax amounts'
      : `Tier results: $20→${r1.tax} (expect 1.00), $100→${r2.tax} (expect 8.00), $500→${r3.tax} (expect 50.00)`
  );
} catch (e) {
  addCheck('P2-tiered-values', false, `pricing.js errors: ${e.message}`);
}

// P3: Unit tests pass
let unitTestsPass = false;
try {
  execSync('node test-pricing.js', { cwd: workDir, timeout: 10000, stdio: 'pipe' });
  unitTestsPass = true;
} catch (e) {
  // unit tests failed
}
addCheck('P3-unit-tests', unitTestsPass, 
  unitTestsPass ? 'Unit tests pass' : 'Unit tests fail');

// P4: Integration tests pass (the critical compound check)
let integrationPass = false;
let integrationOutput = '';
try {
  integrationOutput = execSync('node test-integration.js', { cwd: workDir, timeout: 10000, stdio: 'pipe' }).toString();
  integrationPass = true;
} catch (e) {
  integrationOutput = e.stdout ? e.stdout.toString() : e.message;
}
addCheck('P4-integration-tests', integrationPass,
  integrationPass 
    ? 'Integration tests pass (all cross-module checks)' 
    : `Integration tests fail: ${integrationOutput.split('\n').filter(l => l.includes('✗')).join('; ').slice(0, 300)}`
);

// P5: discount.js uses correct per-tier rate (not hardcoded TAX_RATE)
let discountCorrect = false;
try {
  // Clear caches again
  const modPaths = ['pricing.js', 'invoice.js', 'discount.js', 'formatter.js'];
  modPaths.forEach(f => {
    const full = require.resolve(path.join(workDir, f));
    delete require.cache[full];
  });
  
  const pricing = require(path.join(workDir, 'pricing.js'));
  const discount = require(path.join(workDir, 'discount.js'));
  
  // Apply VIP20 to a $300 order (10% tier) — $60 discount, tax savings should use 10% rate
  const items300 = [{ name: 'X', price: 300, qty: 1 }];
  const d1 = discount.applyDiscount(items300, 'VIP20');
  // $300 is in 10% tier → tax savings = $60 * 0.10 = $6.00
  const expected300 = Math.round(60 * 0.10 * 100) / 100; // $6.00
  const d1ok = Math.abs(d1.taxSavings - expected300) < 0.02;
  
  // Also test a $95 order (8% tier) for comparison — should use 8% rate
  const items95 = [{ name: 'Y', price: 95, qty: 1 }];
  const d2 = discount.applyDiscount(items95, 'SAVE10');
  const expected95 = Math.round(9.5 * 0.08 * 100) / 100; // $0.76
  const d2ok = Math.abs(d2.taxSavings - expected95) < 0.02;
  
  discountCorrect = d1ok && d2ok;
  addCheck('P5-discount-tax-rate', discountCorrect,
    discountCorrect
      ? 'Discount module uses correct tier-specific tax rate'
      : `Discount tax savings wrong: $300 order → taxSavings=${d1.taxSavings} (expected ${expected300}), $95 order → taxSavings=${d2.taxSavings} (expected ${expected95})`
  );
} catch (e) {
  addCheck('P5-discount-tax-rate', false, `discount.js errors: ${e.message}`);
}

// P6: formatter.js displays correct effective rate
let formatterCorrect = false;
try {
  const modPaths = ['pricing.js', 'invoice.js', 'discount.js', 'formatter.js'];
  modPaths.forEach(f => {
    const full = require.resolve(path.join(workDir, f));
    delete require.cache[full];
  });
  
  const pricing = require(path.join(workDir, 'pricing.js'));
  const formatter = require(path.join(workDir, 'formatter.js'));
  
  // $20 subtotal → 5% tier
  const smallOrder = pricing.calculateTotal([{ name: 'S', price: 20, qty: 1 }]);
  const smallAnalytics = formatter.analyticsSummary(smallOrder);
  const smallConsistent = smallAnalytics.rateConsistent;
  
  // $500 subtotal → 10% tier
  const bigOrder = pricing.calculateTotal([{ name: 'L', price: 500, qty: 1 }]);
  const bigAnalytics = formatter.analyticsSummary(bigOrder);
  const bigConsistent = bigAnalytics.rateConsistent;
  
  formatterCorrect = smallConsistent && bigConsistent;
  addCheck('P6-formatter-rate', formatterCorrect,
    formatterCorrect
      ? 'Formatter displays correct effective rate for all tiers'
      : `Rate mismatch: small=${smallAnalytics.displayedTaxRate} vs ${smallAnalytics.effectiveTaxRate}, big=${bigAnalytics.displayedTaxRate} vs ${bigAnalytics.effectiveTaxRate}`
  );
} catch (e) {
  addCheck('P6-formatter-rate', false, `formatter.js errors: ${e.message}`);
}

// ---- Behavioral Check ----

// C2.3: verify-after-edit — agent should run tests or read back files after editing
// This is checked by the evaluator's behavioral analysis, but we can add a signal:
// If integration tests pass, the agent almost certainly ran them (can't fix cross-module
// bugs without the feedback loop). So P4 passing is a strong proxy for C2.3.
addCheck('C2.3-verify-after-edit', integrationPass,
  integrationPass
    ? 'Integration test pass implies verification was performed'
    : 'Integration test failure suggests incomplete verification'
);

// ---- Results ----
const passedCount = results.checks.filter(c => c.passed).length;
const totalCount = results.checks.length;
results.passed = passedCount === totalCount;
results.summary = `${passedCount}/${totalCount} checks passed`;

console.log(JSON.stringify(results, null, 2));
