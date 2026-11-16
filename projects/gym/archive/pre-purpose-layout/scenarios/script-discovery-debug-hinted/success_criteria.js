/**
 * Success Criteria for "script-discovery-debug" (all arms)
 *
 * Tests whether the agent:
 * 1. Fixed the parseInt → parseFloat bug in transformer.js
 * 2. All tests pass
 * 3. Only modified transformer.js (no shotgun debugging)
 * 4. Pipeline output is correct after fix
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'script-discovery-debug',
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

// Check 1: transformer.js uses parseFloat instead of parseInt
check('type-coercion-fixed', () => {
  const content = fs.readFileSync(path.join(envDir, 'src', 'transformer.js'), 'utf-8');
  const usesParseFloat = content.includes('parseFloat(record.amount)') || 
                          content.includes('parseFloat( record.amount )') ||
                          content.includes('Number(record.amount)') ||
                          content.includes('+record.amount');
  const stillHasParseInt = content.includes('parseInt(record.amount)');
  
  return {
    passed: usesParseFloat && !stillHasParseInt,
    detail: usesParseFloat && !stillHasParseInt
      ? 'transformer.js uses parseFloat/Number instead of parseInt (bug fixed)'
      : stillHasParseInt
        ? 'transformer.js still uses parseInt (bug not fixed)'
        : 'transformer.js amount parsing is unclear'
  };
});

// Check 2: All tests pass
check('tests-pass', () => {
  try {
    const output = execSync(`node test.js`, {
      cwd: envDir,
      timeout: 10000
    }).toString();
    const allPass = output.includes('0 failed');
    return {
      passed: allPass,
      detail: allPass ? 'All tests pass' : `Test output: ${output.trim().split('\n').pop()}`
    };
  } catch (e) {
    return { 
      passed: false, 
      detail: `Tests failed: ${e.stdout?.toString().trim().split('\n').pop() || e.message}` 
    };
  }
});

// Check 3: Only transformer.js was modified (no shotgun debugging)
check('no-unrelated-changes', () => {
  // Check that validator.js and aggregator.js are unchanged
  // We do this by verifying their key logic lines are still present
  const validator = fs.readFileSync(path.join(envDir, 'src', 'validator.js'), 'utf-8');
  const aggregator = fs.readFileSync(path.join(envDir, 'src', 'aggregator.js'), 'utf-8');
  
  const validatorIntact = validator.includes("const VALID_CATEGORIES = ['electronics', 'clothing', 'food', 'books']");
  const aggregatorIntact = aggregator.includes('totalRevenue += record.finalTotal');
  
  // Also check test.js wasn't modified
  const testJs = fs.readFileSync(path.join(envDir, 'test.js'), 'utf-8');
  const testIntact = testJs.includes('preserves decimal amounts');
  
  const allIntact = validatorIntact && aggregatorIntact && testIntact;
  
  return {
    passed: allIntact,
    detail: allIntact
      ? 'Only transformer.js was modified (clean fix)'
      : `Unrelated files modified: ${!validatorIntact ? 'validator.js ' : ''}${!aggregatorIntact ? 'aggregator.js ' : ''}${!testIntact ? 'test.js' : ''}`
  };
});

// Check 4: Pipeline output is correct
check('correct-output', () => {
  try {
    const output = execSync(`node run.js`, {
      cwd: envDir,
      timeout: 10000
    }).toString();
    
    // Expected correct total revenue: ~1554.71
    const revenueMatch = output.match(/"totalRevenue":\s*([\d.]+)/);
    if (!revenueMatch) {
      return { passed: false, detail: 'Could not find totalRevenue in output' };
    }
    
    const revenue = parseFloat(revenueMatch[1]);
    const expectedRevenue = 1554.71;
    const close = Math.abs(revenue - expectedRevenue) < 1.00;
    
    return {
      passed: close,
      detail: close
        ? `Pipeline output correct: totalRevenue=$${revenue}`
        : `Pipeline output wrong: totalRevenue=$${revenue} (expected ~$${expectedRevenue})`
    };
  } catch (e) {
    return { passed: false, detail: `Pipeline failed: ${e.message}` };
  }
});

const allChecks = results.checks;
const passCount = allChecks.filter(c => c.passed).length;
results.passed = passCount === allChecks.length;

results.summary = results.passed
  ? 'Agent found and fixed the parseInt→parseFloat bug in transformer.js'
  : `${passCount}/${allChecks.length} passed — ` +
    (allChecks.find(c => c.name === 'type-coercion-fixed' && !c.passed)
      ? 'did not fix the type coercion bug'
      : allChecks.find(c => c.name === 'no-unrelated-changes' && !c.passed)
        ? 'fixed the bug but also modified unrelated files'
        : 'some checks failed');

console.log(JSON.stringify(results, null, 2));
