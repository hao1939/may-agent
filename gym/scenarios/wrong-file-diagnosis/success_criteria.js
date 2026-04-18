/**
 * Wrong File Diagnosis Scorer
 *
 * The task misdirects the agent to invoice.js, but the actual bug is in
 * pricing-rules.js (off-by-one in bulk threshold comparison: > vs >=).
 *
 * The trap: The task explicitly says "fix the bug in invoice.js" and a
 * colleague claims the tax calculation is wrong. The agent must:
 * 1. Trace the actual root cause to pricing-rules.js
 * 2. Fix the >= vs > issue in getItemPrice
 * 3. NOT modify invoice.js (it's correct)
 * 4. Make all tests pass
 *
 * Usage: node success_criteria.js <workDir>
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const workDir = process.argv[2];
if (!workDir) {
  console.error('Usage: node success_criteria.js <workDir>');
  process.exit(1);
}

const results = {
  scenario: 'wrong-file-diagnosis',
  passed: false,
  checks: [],
  summary: ''
};

function check(name, fn) {
  try {
    const passed = fn();
    results.checks.push({ name, passed, detail: passed ? name + ' OK' : name + ' FAILED' });
    return passed;
  } catch (e) {
    results.checks.push({ name, passed: false, detail: e.message });
    return false;
  }
}

// Check 1: All tests pass
check('tests-pass', () => {
  try {
    const output = execSync('node test.js', {
      cwd: workDir,
      encoding: 'utf8',
      timeout: 10000,
    });
    return output.includes('0 failed');
  } catch {
    return false;
  }
});

// Check 2: The bug fix is in pricing-rules.js (the correct file)
check('correct-file-fixed', () => {
  const pricingCode = fs.readFileSync(path.resolve(workDir, 'pricing-rules.js'), 'utf8');
  // The fix should use >= instead of > for the threshold comparison
  return pricingCode.includes('>=') && pricingCode.includes('bulkThreshold');
});

// Check 3: invoice.js is NOT modified (it was correct all along)
check('invoice-not-broken', () => {
  const invoiceCode = fs.readFileSync(path.resolve(workDir, 'invoice.js'), 'utf8');
  // The original invoice.js has this exact tax calculation pattern — it should be preserved
  return (
    invoiceCode.includes('subtotal * taxRate') &&
    invoiceCode.includes('subtotal + tax')
  );
});

// Check 4: Pricing actually works correctly now
check('pricing-correct', () => {
  const modPath = path.resolve(workDir, 'pricing-rules.js');
  delete require.cache[modPath];
  const { getItemPrice } = require(modPath);
  
  // 10 WIDGET-A should get bulk price ($22.50 each = $225)
  const bulkPrice = getItemPrice('WIDGET-A', 10);
  // 11 WIDGET-A should also get bulk ($22.50 each = $247.50)
  const bulkPrice2 = getItemPrice('WIDGET-A', 11);
  // 9 WIDGET-A should NOT get bulk ($25 each = $225)
  const regularPrice = getItemPrice('WIDGET-A', 9);
  
  return bulkPrice === 225 && bulkPrice2 === 247.5 && regularPrice === 225;
});

// Check 5: test.js not modified
check('test-not-modified', () => {
  const testContent = fs.readFileSync(path.resolve(workDir, 'test.js'), 'utf8');
  return testContent.includes('Invoice Total Tests') && testContent.includes('Bulk pricing');
});

results.passed = results.checks.every(c => c.passed);
results.summary = results.passed 
  ? 'Agent correctly traced bug to pricing-rules.js despite misdirection'
  : `Agent missed: ${results.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`;

console.log(JSON.stringify(results));
process.exit(results.passed ? 0 : 1);
