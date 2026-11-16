/**
 * Success Criteria for "adversarial-qa-iteration" (EXP-190)
 *
 * ADVERSARIAL ITERATION SCENARIO:
 * Agent must fix a rate limiter time-unit mismatch bug AND handle
 * adversarial edge-case tests written by QA. A naive fix (just changing
 * seconds to milliseconds) will pass standard tests but may fail adversarial
 * ones if the implementation has subtle issues.
 *
 * Anti-ceiling: 8 checks, need 6+ to pass.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'adversarial-qa-iteration',
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

// CHECK 1: The time-unit bug is fixed (lastRefill uses consistent units)
check('time-unit-bug-fixed', () => {
  const src = fs.readFileSync(path.join(envDir, 'src/rate-limiter.js'), 'utf8');
  // The bug was: Date.now() / 1000 for storage, Date.now() for comparison
  // Fix: use consistent units (both ms or both seconds)
  const hasBug = /lastRefill\s*=\s*Date\.now\(\)\s*\/\s*1000/.test(src);
  return {
    passed: !hasBug,
    detail: hasBug ? 'Still has Date.now()/1000 bug' : 'Time units are consistent'
  };
});

// CHECK 2: Standard tests pass
check('standard-tests-pass', () => {
  try {
    const output = execSync(
      'npx jest test/rate-limiter.test.js --no-cache 2>&1',
      { cwd: envDir, timeout: 30000, encoding: 'utf8' }
    );
    const passed = /Tests:.*\d+ passed/.test(output) && !/failed/.test(output);
    return { passed, detail: passed ? 'All standard tests pass' : output.slice(-300) };
  } catch (e) {
    return { passed: false, detail: e.stdout?.slice(-300) || e.message };
  }
});

// CHECK 3: Adversarial tests pass
check('adversarial-tests-pass', () => {
  try {
    const output = execSync(
      'npx jest test/adversarial/rate-limiter-edge.test.js --no-cache 2>&1',
      { cwd: envDir, timeout: 30000, encoding: 'utf8' }
    );
    const passed = /Tests:.*\d+ passed/.test(output) && !/failed/.test(output);
    return { passed, detail: passed ? 'All adversarial tests pass' : output.slice(-300) };
  } catch (e) {
    return { passed: false, detail: e.stdout?.slice(-300) || e.message };
  }
});

// CHECK 4: FIX_NOTES.md exists and explains the fix
check('fix-notes-exist', () => {
  const notesPath = path.join(envDir, 'FIX_NOTES.md');
  if (!fs.existsSync(notesPath)) {
    return { passed: false, detail: 'FIX_NOTES.md not found' };
  }
  const notes = fs.readFileSync(notesPath, 'utf8');
  const hasContent = notes.length > 50;
  return {
    passed: hasContent,
    detail: hasContent ? `FIX_NOTES.md has ${notes.length} chars` : 'FIX_NOTES.md too short'
  };
});

// CHECK 5: Fix notes mention the time-unit mismatch
check('fix-notes-mention-bug', () => {
  const notesPath = path.join(envDir, 'FIX_NOTES.md');
  if (!fs.existsSync(notesPath)) return { passed: false, detail: 'No FIX_NOTES.md' };
  const notes = fs.readFileSync(notesPath, 'utf8').toLowerCase();
  const mentionsBug = /millisecond|time.?unit|seconds?\s*(vs|versus|mismatch|inconsisten)/i.test(notes) ||
    /date\.now|lastrefill|elapsed/i.test(notes);
  return {
    passed: mentionsBug,
    detail: mentionsBug ? 'Explains the time-unit issue' : 'Does not explain the root cause'
  };
});

// CHECK 6: Fix notes mention edge cases
check('fix-notes-mention-edge-cases', () => {
  const notesPath = path.join(envDir, 'FIX_NOTES.md');
  if (!fs.existsSync(notesPath)) return { passed: false, detail: 'No FIX_NOTES.md' };
  const notes = fs.readFileSync(notesPath, 'utf8').toLowerCase();
  const mentionsEdge = /edge.?case|adversarial|boundary|overflow|cap|fractional|rapid/i.test(notes);
  return {
    passed: mentionsEdge,
    detail: mentionsEdge ? 'Mentions edge cases' : 'No mention of edge cases'
  };
});

// CHECK 7: The _refill method is correct (uses consistent units and caps at capacity)
check('refill-implementation-correct', () => {
  const src = fs.readFileSync(path.join(envDir, 'src/rate-limiter.js'), 'utf8');
  // Must have Math.min with capacity (cap check)
  const hasCap = /Math\.min\s*\(\s*this\.capacity/.test(src);
  // Must not divide Date.now() by 1000 when storing
  const noSecondsBug = !/lastRefill\s*=\s*Date\.now\(\)\s*\/\s*1000/.test(src);
  const passed = hasCap && noSecondsBug;
  return {
    passed,
    detail: `Cap check: ${hasCap}, No seconds bug: ${noSecondsBug}`
  };
});

// CHECK 8: API contract preserved — tryConsume returns { allowed, remaining, retryAfter? }
check('api-contract-preserved', () => {
  const src = fs.readFileSync(path.join(envDir, 'src/rate-limiter.js'), 'utf8');
  const hasAllowed = /allowed\s*:/.test(src);
  const hasRemaining = /remaining\s*:/.test(src);
  const hasRetryAfter = /retryAfter\s*:/.test(src);
  const passed = hasAllowed && hasRemaining && hasRetryAfter;
  return {
    passed,
    detail: `allowed: ${hasAllowed}, remaining: ${hasRemaining}, retryAfter: ${hasRetryAfter}`
  };
});

// Tally
const passedCount = results.checks.filter(c => c.passed).length;
const totalChecks = results.checks.length;
results.passed = passedCount >= 6;
results.summary = `${passedCount}/${totalChecks} checks passed (need 6+)`;

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
