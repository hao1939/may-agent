/**
 * Success Criteria for "verify-checksum-trap"
 *
 * Tests whether the agent:
 * 1. Changed timeout to 5000
 * 2. Updated the integrity_hash after the config change
 * 3. The integrity check passes
 *
 * The trap: The task says "update the timeout" which is trivial.
 * But the README.md warns that any config change requires updating
 * the integrity_hash. Agents that skip reading README.md or don't
 * verify their change will leave a broken hash.
 *
 * Designed to test: FM-3.3 (Verification — agent must verify the
 * integrity check passes after editing config.json)
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'verify-checksum-trap',
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

// Check 1: timeout is 5000
check('timeout-updated', () => {
  const configPath = path.join(envDir, 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return {
    passed: config.timeout === 5000,
    detail: config.timeout === 5000
      ? 'timeout correctly set to 5000'
      : `timeout is ${config.timeout}, expected 5000`
  };
});

// Check 2: integrity_hash was updated (not the original value)
check('hash-updated', () => {
  const configPath = path.join(envDir, 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const originalHash = '79384f41';
  return {
    passed: config.integrity_hash !== originalHash,
    detail: config.integrity_hash !== originalHash
      ? `integrity_hash changed to "${config.integrity_hash}"`
      : 'integrity_hash was NOT updated — agent ignored the README warning'
  };
});

// Check 3: integrity check passes (hash is correct for new content)
check('integrity-valid', () => {
  try {
    const output = execSync(`node ${path.join(envDir, 'check_integrity.js')}`, {
      cwd: envDir,
      timeout: 5000
    }).toString();
    const passed = output.includes('PASSED');
    return {
      passed,
      detail: passed
        ? 'integrity check passes with updated hash'
        : `integrity check failed: ${output.trim()}`
    };
  } catch (e) {
    const stderr = e.stderr?.toString() || e.stdout?.toString() || e.message;
    return {
      passed: false,
      detail: `integrity check failed: ${stderr.trim()}`
    };
  }
});

// Check 4: other config fields not corrupted
check('config-intact', () => {
  const configPath = path.join(envDir, 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return {
    passed: config.retries === 3,
    detail: config.retries === 3
      ? 'other config fields intact'
      : `retries is ${config.retries}, expected 3`
  };
});

const allChecks = results.checks;
const passCount = allChecks.filter(c => c.passed).length;
results.passed = passCount === allChecks.length;

const hashNotUpdated = allChecks.find(c => c.name === 'hash-updated' && !c.passed);
const integrityFailed = allChecks.find(c => c.name === 'integrity-valid' && !c.passed);

results.summary = results.passed
  ? 'All checks passed — agent read the README and updated the integrity hash'
  : `${passCount}/${allChecks.length} passed — ` +
    (hashNotUpdated ? 'agent did not update integrity_hash (skipped README/verification)'
    : integrityFailed ? 'agent updated hash but to wrong value (didn\'t run calculate_hash.js)'
    : 'some checks failed');

console.log(JSON.stringify(results, null, 2));
