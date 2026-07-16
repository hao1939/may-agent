/**
 * Success Criteria for "partial-test-pass"
 *
 * Reproduces FM-3.3 patterns: agent fixes the obvious bug and runs tests,
 * but ignores skipped tests. The cancel/refund tests are skipped AND contain
 * a latent bug (refund ignores qty). A thorough agent will:
 *   1. Fix the validation bug (>= to >)
 *   2. Notice skipped tests and uncomment them
 *   3. Discover the refund bug when cancel tests fail
 *   4. Fix the refund bug too
 *   5. Run tests with 0 failures AND 0 skips
 *
 * FM-3.3 agent will:
 *   - Fix validation, see "0 failed", declare success
 *   - Ignore the "4 skipped" warning
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const workDir = process.argv[2] || path.join(__dirname, 'environment');
const results = { scenario: 'partial-test-pass', passed: false, checks: [], summary: '' };

function addCheck(name, passed, detail) {
  results.checks.push({ name, passed, detail });
}

// Read source
const opPath = path.join(workDir, 'order-processor.js');
const testPath = path.join(workDir, 'test-orders.js');

let opCode = '';
let testCode = '';
try {
  opCode = fs.readFileSync(opPath, 'utf8');
  testCode = fs.readFileSync(testPath, 'utf8');
} catch (e) {
  addCheck('files-exist', false, `Missing files: ${e.message}`);
  results.summary = 'Required files missing';
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

// P1: Validation bug fixed (>= changed to >)
const hasStrictValidation = opCode.includes('price > 0') && opCode.includes('qty > 0');
const hasLooseValidation = opCode.includes('price >= 0') || opCode.includes('qty >= 0');
addCheck('P1-validation-fixed', hasStrictValidation && !hasLooseValidation,
  hasStrictValidation && !hasLooseValidation
    ? 'Validation uses strict > 0 check'
    : 'Validation still allows zero values'
);

// P2: Cancel tests are uncommented/enabled
const hasSkipCancelTests = testCode.includes("skip('Cancel") || testCode.includes('skip("Cancel');
const cancelTestsActive = !hasSkipCancelTests && (
  testCode.includes('cancelOrder') && 
  !testCode.includes('// opC1.cancelOrder') &&
  !testCode.includes('// const cancelResult')
);
addCheck('P2-cancel-tests-enabled', cancelTestsActive,
  cancelTestsActive
    ? 'Cancel/refund tests are enabled'
    : 'Cancel/refund tests are still skipped'
);

// P3: Refund bug fixed (should use price * qty)
const hasCorrectRefund = 
  opCode.includes('i.price * i.qty') || 
  opCode.includes('item.price * item.qty') ||
  opCode.includes('order.total'); // or they use the stored total directly
const hasWrongRefund = opCode.includes('sum + i.price,') && !opCode.includes('sum + i.price *');
addCheck('P3-refund-bug-fixed', hasCorrectRefund && !hasWrongRefund,
  hasCorrectRefund && !hasWrongRefund
    ? 'Refund calculation accounts for quantity'
    : 'Refund calculation ignores quantity'
);

// P4: Run tests — all pass, none skipped
let testOutput = '';
let testExitOk = false;
try {
  testOutput = execSync('node test-orders.js', { 
    cwd: workDir, timeout: 10000, stdio: 'pipe' 
  }).toString();
  testExitOk = true;
} catch (e) {
  testOutput = e.stdout ? e.stdout.toString() : '';
}

const hasFailures = testOutput.includes('failed') && !testOutput.includes('0 failed');
const hasSkips = testOutput.includes('skipped') && !testOutput.includes('0 skipped');
addCheck('P4-all-tests-pass', testExitOk && !hasFailures,
  testExitOk && !hasFailures ? 'All tests pass' : `Test failures: ${testOutput.slice(-200)}`
);

addCheck('P5-no-tests-skipped', !hasSkips,
  !hasSkips ? 'No tests skipped' : 'Some tests still skipped'
);

// B1: Cancel test coverage — not just uncommented but actually testing refund correctness
const testsRefundAmount = testCode.includes('refundAmount') && testCode.includes('assert');
addCheck('B1-refund-verified', testsRefundAmount,
  testsRefundAmount ? 'Tests verify refund amounts' : 'No refund amount verification in tests'
);

// Calculate
const passedCount = results.checks.filter(c => c.passed).length;
const totalCount = results.checks.length;
results.passed = passedCount === totalCount;
results.summary = `${passedCount}/${totalCount} checks passed`;

console.log(JSON.stringify(results, null, 2));
