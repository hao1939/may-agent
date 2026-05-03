// success_criteria.js — EXP-800 multi-file-refactor scenario (shipping task)
const fs = require('fs');
const path = require('path');

function evaluate(envDir) {
  const srcDir = path.join(envDir, 'src');
  const results = { passed: true, checks: [] };

  // Check 1: calculateShipping exists in pricing.js
  const pricingPath = path.join(srcDir, 'pricing.js');
  if (!fs.existsSync(pricingPath)) {
    results.passed = false;
    results.checks.push({ name: 'pricing.js', passed: false, detail: 'file not found' });
  } else {
    const pricing = fs.readFileSync(pricingPath, 'utf8');
    const hasShippingFn = pricing.includes('calculateShipping') && pricing.includes('function');
    const totalHasShipping = pricing.includes('shipping');
    const passed = hasShippingFn && totalHasShipping;
    results.checks.push({ name: 'pricing.js', passed, detail: passed ? 'calculateShipping + shipping field found' : 'missing calculateShipping or shipping field' });
    if (!passed) results.passed = false;
  }

  // Check 2: cart.js includes shipping in formatted
  const cartPath = path.join(srcDir, 'cart.js');
  if (!fs.existsSync(cartPath)) {
    results.passed = false;
    results.checks.push({ name: 'cart.js', passed: false, detail: 'file not found' });
  } else {
    const cart = fs.readFileSync(cartPath, 'utf8');
    const hasShipping = cart.includes('shipping');
    results.checks.push({ name: 'cart.js', passed: hasShipping, detail: hasShipping ? 'shipping referenced' : 'no shipping in cart' });
    if (!hasShipping) results.passed = false;
  }

  // Check 3: checkout.js includes shipping
  const checkoutPath = path.join(srcDir, 'checkout.js');
  if (!fs.existsSync(checkoutPath)) {
    results.passed = false;
    results.checks.push({ name: 'checkout.js', passed: false, detail: 'file not found' });
  } else {
    const checkout = fs.readFileSync(checkoutPath, 'utf8');
    const hasShipping = checkout.includes('shipping');
    results.checks.push({ name: 'checkout.js', passed: hasShipping, detail: hasShipping ? 'shipping in checkout' : 'no shipping in checkout' });
    if (!hasShipping) results.passed = false;
  }

  // Check 4: pricing.test.js has shipping tier tests
  const testPath = path.join(srcDir, 'pricing.test.js');
  if (!fs.existsSync(testPath)) {
    results.passed = false;
    results.checks.push({ name: 'pricing.test.js', passed: false, detail: 'file not found' });
  } else {
    const tests = fs.readFileSync(testPath, 'utf8');
    const hasTier1 = tests.includes('5.99');
    const hasTier2 = tests.includes('3.99');
    const hasFree = tests.includes('shipping');
    const passed = hasTier1 && hasTier2 && hasFree;
    results.checks.push({ name: 'pricing.test.js', passed, detail: passed ? 'all 3 shipping tiers tested' : 'missing shipping tier tests' });
    if (!passed) results.passed = false;
  }

  return results;
}

module.exports = { evaluate };

// CLI entry point
if (require.main === module) {
  const workDir = process.argv[2] || '.';
  const result = evaluate(workDir);
  console.log(JSON.stringify(result));
}
