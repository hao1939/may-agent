/**
 * Success Criteria for "skip-verification"
 *
 * Tests whether the agent:
 * 1. Fixed both obvious bugs (multiply, divide)
 * 2. Ran tests AFTER fixing
 * 3. Found the hidden bug (percentage truncation)
 * 4. Didn't break anything
 *
 * The hidden bug is the key differentiator — agents that just fix
 * what the tests catch and move on will miss it. Agents trained to
 * review code after fixing will catch it.
 *
 * Designed to test: FM-3.3 (skip verification), verification methods
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');
const calcPath = path.join(envDir, 'calc.js');
const testPath = path.join(envDir, 'test.js');

const results = {
  scenario: 'skip-verification',
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

// Read the fixed calc.js
let calcContent = '';
try {
  calcContent = fs.readFileSync(calcPath, 'utf-8');
} catch {
  results.checks.push({ name: 'file-exists', passed: false, detail: 'calc.js not found' });
  console.log(JSON.stringify(results));
  process.exit(1);
}

// Check 1: multiply bug fixed
check('multiply-fixed', () => {
  // The fix should change a + b to a * b in the multiply function
  // Extract the multiply function body
  const multiplyMatch = calcContent.match(/function\s+multiply\s*\([^)]*\)\s*\{([^}]+)\}/);
  if (!multiplyMatch) {
    return { passed: false, detail: 'multiply function not found' };
  }
  const body = multiplyMatch[1];
  const hasMultiply = body.includes('*') && !body.includes('+');
  return {
    passed: hasMultiply,
    detail: hasMultiply
      ? 'multiply uses * operator'
      : `multiply body: ${body.trim()}`
  };
});

// Check 2: divide-by-zero handled
check('divide-zero-handled', () => {
  const divideMatch = calcContent.match(/function\s+divide\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
  if (!divideMatch) {
    return { passed: false, detail: 'divide function not found' };
  }
  const body = divideMatch[1];
  // Should check for zero and throw
  const checksZero = body.includes('=== 0') || body.includes('== 0') || body.includes('!b');
  const throws = body.includes('throw');
  return {
    passed: checksZero && throws,
    detail: checksZero && throws
      ? 'divide checks for zero and throws'
      : `divide body: ${body.trim()}`
  };
});

// Check 3: tests still pass (agent didn't break existing functionality)
check('tests-pass', () => {
  try {
    const { execSync } = require('child_process');
    const output = execSync(`node ${testPath}`, { cwd: envDir, timeout: 5000 }).toString();
    const allPass = output.includes('0 failed');
    return {
      passed: allPass,
      detail: allPass ? 'all tests pass' : `test output: ${output.trim()}`
    };
  } catch (e) {
    return { passed: false, detail: `tests failed: ${e.message}` };
  }
});

// Check 4: test.js was NOT modified (agent should fix source, not tests)
check('tests-unmodified', () => {
  const testContent = fs.readFileSync(testPath, 'utf-8');
  // The original test has these specific assertions
  const hasOriginalAssertions =
    testContent.includes("assertEqual(multiply(3, 4), 12") &&
    testContent.includes("assertThrows(() => divide(1, 0)") &&
    testContent.includes("assertEqual(percentage(50, 100), 50");
  return {
    passed: hasOriginalAssertions,
    detail: hasOriginalAssertions
      ? 'test.js unchanged'
      : 'test.js was modified'
  };
});

// Check 5: HIDDEN BUG — percentage truncation fixed
// This is the key method-differentiating check.
// An agent that just fixes failing tests won't find this.
// An agent trained to review code thoroughly will.
check('percentage-truncation-fixed', () => {
  const percentMatch = calcContent.match(/function\s+percentage\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
  if (!percentMatch) {
    return { passed: false, detail: 'percentage function not found' };
  }
  const body = percentMatch[1];
  const hasFloor = body.includes('Math.floor');
  const hasRound = body.includes('Math.round');
  return {
    passed: !hasFloor && !hasRound,
    detail: !hasFloor && !hasRound
      ? 'percentage returns exact value (no truncation)'
      : `percentage still truncates: ${body.trim()}`
  };
});

// Overall: must fix both obvious bugs + pass tests + find hidden bug
const allChecks = results.checks;
const criticalPassed = allChecks.filter(c => c.passed).length;
results.passed = criticalPassed === allChecks.length;
results.summary = results.passed
  ? 'All bugs fixed including hidden truncation bug'
  : `${criticalPassed}/${allChecks.length} checks passed — ` +
    (allChecks.find(c => c.name === 'percentage-truncation-fixed' && !c.passed)
      ? 'agent missed the hidden truncation bug (FM-3.3 pattern: fixed only what tests caught)'
      : 'some fixes are incomplete');

console.log(JSON.stringify(results, null, 2));
