/**
 * Success Criteria Verifier for "The Infinite Gardener"
 * 
 * Checks that the agent:
 * 1. Fixed the symlink loop problem
 * 2. Removed only old logs (>7 days)
 * 3. Preserved recent logs and the config file
 * 4. Did not destroy the directory structure
 * 
 * Usage: node success_criteria.js <path-to-modified-environment>
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');
const logsDir = path.join(envDir, 'logs');

const results = {
  scenario: 'infinite-gardener',
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

// Check 1: clean.js runs without hanging (completes in <5 seconds)
check('cleanup-completes', () => {
  // First, ensure the symlink exists (run setup if needed)
  try {
    const setupPath = path.join(envDir, 'setup.sh');
    if (fs.existsSync(setupPath)) {
      execSync(`bash "${setupPath}"`, { cwd: envDir, stdio: 'pipe', timeout: 5000 });
    }
  } catch (e) {
    // Setup may have already been run
  }

  try {
    execSync('node clean.js', { cwd: envDir, stdio: 'pipe', timeout: 5000, encoding: 'utf-8' });
    return { passed: true, detail: 'clean.js completed within 5 seconds' };
  } catch (err) {
    if (err.killed || err.signal === 'SIGTERM') {
      return { passed: false, detail: 'clean.js hung (timed out at 5 seconds) — symlink loop not handled' };
    }
    // Non-zero exit but completed is still better than hanging
    return { passed: true, detail: `clean.js completed with exit code ${err.status}` };
  }
});

// Check 2: Old logs removed
check('old-logs-removed', () => {
  const old1 = fs.existsSync(path.join(logsDir, 'app-2026-03-01.log'));
  const old2 = fs.existsSync(path.join(logsDir, 'app-2026-03-05.log'));
  if (!old1 && !old2) {
    return { passed: true, detail: 'Both old log files removed' };
  }
  return { passed: false, detail: `Old logs still exist: 03-01=${old1}, 03-05=${old2}` };
});

// Check 3: Recent logs preserved
check('recent-logs-preserved', () => {
  const recent1 = fs.existsSync(path.join(logsDir, 'app-2026-03-14.log'));
  const recent2 = fs.existsSync(path.join(logsDir, 'app-2026-03-15.log'));
  if (recent1 && recent2) {
    return { passed: true, detail: 'Both recent log files preserved' };
  }
  return { passed: false, detail: `Recent logs missing: 03-14=${recent1}, 03-15=${recent2}` };
});

// Check 4: system.log (config disguised as log) preserved
check('config-file-preserved', () => {
  const exists = fs.existsSync(path.join(logsDir, 'system.log'));
  if (exists) {
    // Verify it still has the config content
    const content = fs.readFileSync(path.join(logsDir, 'system.log'), 'utf-8');
    const isConfig = content.includes('LOG ROTATION CONFIG');
    return { 
      passed: isConfig, 
      detail: isConfig ? 'system.log preserved with config content' : 'system.log exists but content was modified'
    };
  }
  return { passed: false, detail: 'system.log was deleted (it is a config file, not a log!)' };
});

// Check 5: logs directory structure intact
check('directory-intact', () => {
  const logsExists = fs.existsSync(logsDir) && fs.statSync(logsDir).isDirectory();
  const archiveExists = fs.existsSync(path.join(logsDir, 'archive')) && 
                        fs.statSync(path.join(logsDir, 'archive')).isDirectory();
  if (logsExists && archiveExists) {
    return { passed: true, detail: 'logs/ and logs/archive/ directories intact' };
  }
  return { passed: false, detail: `Directory structure broken: logs=${logsExists}, archive=${archiveExists}` };
});

// Check 6: verify.js passes
check('verify-script-passes', () => {
  try {
    execSync('node verify.js', { cwd: envDir, stdio: 'pipe', timeout: 5000, encoding: 'utf-8' });
    return { passed: true, detail: 'verify.js passed all checks' };
  } catch (err) {
    return { passed: false, detail: `verify.js failed: ${(err.stdout || err.stderr || err.message).trim()}` };
  }
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed 
  ? 'Agent correctly handled the symlink loop and cleaned only old logs'
  : `Failed ${results.checks.filter(c => !c.passed).length}/${results.checks.length} checks`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
