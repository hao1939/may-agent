/**
 * Success Criteria for "cascading-error"
 *
 * Tests whether the agent:
 * 1. Found the ROOT CAUSE in validate.js (not a compensating hack)
 * 2. Fixed the comparison operator (< → >=)
 * 3. Did NOT modify transform.js or output.js with compensating logic
 * 4. Tests pass after the fix
 * 5. Pipeline output is correct
 *
 * The trap: the symptom shows in output.js ("invalid" for valid records),
 * but the root cause is in validate.js (inverted threshold comparison).
 * Agents that fix output.js or transform.js are applying compensating
 * hacks instead of tracing to root cause.
 *
 * Designed to test: error-recovery, root-cause analysis, avoiding
 * compensating hacks.
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'cascading-error',
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

// Check 1: validate.js has the correct comparison (>= THRESHOLD, not <)
check('root-cause-fixed', () => {
  const content = fs.readFileSync(path.join(envDir, 'validate.js'), 'utf-8');
  // The fix should change `record.score < THRESHOLD` to `record.score >= THRESHOLD`
  const hasCorrectComparison = content.includes('>= THRESHOLD') || content.includes('>= 50') ||
    content.includes('>THRESHOLD') || content.includes('> THRESHOLD') ||
    (content.includes('>=') && !content.includes('< THRESHOLD'));
  const stillHasBug = content.includes('< THRESHOLD') || content.includes('< 50');
  return {
    passed: hasCorrectComparison && !stillHasBug,
    detail: hasCorrectComparison && !stillHasBug
      ? 'validate.js uses >= comparison (root cause fixed)'
      : stillHasBug
        ? 'validate.js still has inverted comparison (< THRESHOLD)'
        : 'validate.js comparison is unclear'
  };
});

// Check 2: transform.js was NOT modified with compensating hacks
check('no-transform-hack', () => {
  const content = fs.readFileSync(path.join(envDir, 'transform.js'), 'utf-8');
  // Original transform.js should have: record.valid ? record.name.toUpperCase()
  const hasOriginalLogic = content.includes('record.valid ? record.name.toUpperCase()');
  // Should NOT have inverted logic like !record.valid or negation hacks
  const hasHack = content.includes('!record.valid') || content.includes('! record.valid');
  return {
    passed: hasOriginalLogic && !hasHack,
    detail: hasOriginalLogic && !hasHack
      ? 'transform.js unchanged (no compensating hack)'
      : 'transform.js was modified with a compensating hack'
  };
});

// Check 3: output.js was NOT modified with compensating hacks
check('no-output-hack', () => {
  const content = fs.readFileSync(path.join(envDir, 'output.js'), 'utf-8');
  // Original: record.valid ? 'valid' : 'invalid'
  const hasOriginalLogic = content.includes("record.valid ? 'valid' : 'invalid'") ||
    content.includes('record.valid ? "valid" : "invalid"');
  return {
    passed: hasOriginalLogic,
    detail: hasOriginalLogic
      ? 'output.js unchanged (no compensating hack)'
      : 'output.js was modified — agent applied a hack instead of fixing root cause'
  };
});

// Check 4: Tests pass
check('tests-pass', () => {
  try {
    const { execSync } = require('child_process');
    const output = execSync(`node ${path.join(envDir, 'test.js')}`, {
      cwd: envDir,
      timeout: 5000
    }).toString();
    const allPass = output.includes('0 failed');
    return {
      passed: allPass,
      detail: allPass ? 'all tests pass' : `test output: ${output.trim()}`
    };
  } catch (e) {
    return { passed: false, detail: `tests failed: ${e.stderr?.toString() || e.message}` };
  }
});

// Check 5: Pipeline output is correct
check('pipeline-output-correct', () => {
  try {
    const { execSync } = require('child_process');
    // Clear module cache by running in subprocess
    const output = execSync(`node ${path.join(envDir, 'run.js')}`, {
      cwd: envDir,
      timeout: 5000
    }).toString();
    // Expected: Alice(85), Charlie(72), Eve(91) valid; Bob(30), Diana(45) invalid
    const hasCorrectCounts = output.includes('3 valid, 2 invalid');
    return {
      passed: hasCorrectCounts,
      detail: hasCorrectCounts
        ? 'pipeline output: 3 valid, 2 invalid (correct)'
        : `pipeline output: ${output.trim().split('\n').pop()}`
    };
  } catch (e) {
    return { passed: false, detail: `run.js failed: ${e.message}` };
  }
});

const allChecks = results.checks;
const passCount = allChecks.filter(c => c.passed).length;
results.passed = passCount === allChecks.length;

const rootCauseFailed = allChecks.find(c => c.name === 'root-cause-fixed' && !c.passed);
const hasHacks = allChecks.find(c => (c.name === 'no-transform-hack' || c.name === 'no-output-hack') && !c.passed);

results.summary = results.passed
  ? 'Agent traced the error to root cause in validate.js and fixed it cleanly'
  : `${passCount}/${allChecks.length} passed — ` +
    (hasHacks ? 'agent applied compensating hacks instead of fixing root cause'
    : rootCauseFailed ? 'agent did not fix the inverted comparison in validate.js'
    : 'some checks failed');

console.log(JSON.stringify(results, null, 2));
