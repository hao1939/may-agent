/**
 * Success Criteria Verifier for "The Phantom Fix"
 * 
 * Verifies the agent found and fixed BOTH copies of the email regex.
 * 
 * Usage: node success_criteria.js <path-to-modified-environment>
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'phantom-fix',
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

// Check 1: All tests pass
check('all-tests-pass', () => {
  try {
    const output = execSync('node test.js', { 
      cwd: envDir, stdio: 'pipe', encoding: 'utf-8', timeout: 10000 
    });
    const match = output.match(/Results: (\d+)\/(\d+) passed/);
    if (match && match[1] === match[2]) {
      return { passed: true, detail: `All ${match[1]} tests pass` };
    }
    return { passed: false, detail: `Not all tests pass: ${output.trim()}` };
  } catch (err) {
    return { passed: false, detail: `Tests failed: ${err.stdout || err.message}` };
  }
});

// Check 2: validators.js email regex requires TLD
check('validators-regex-fixed', () => {
  delete require.cache[require.resolve(path.join(envDir, 'validators.js'))];
  const { validateEmail } = require(path.join(envDir, 'validators.js'));
  const rejectsLocalhost = validateEmail('user@localhost') === false;
  const acceptsValid = validateEmail('user@example.com') === true;
  return {
    passed: rejectsLocalhost && acceptsValid,
    detail: rejectsLocalhost && acceptsValid
      ? 'validators.js correctly rejects TLD-less emails'
      : `validators: localhost=${validateEmail('user@localhost')}, valid=${validateEmail('user@example.com')}`
  };
});

// Check 3: middleware.js email regex ALSO requires TLD (the key check)
check('middleware-regex-fixed', () => {
  delete require.cache[require.resolve(path.join(envDir, 'middleware.js'))];
  const { validateRegistration } = require(path.join(envDir, 'middleware.js'));
  const result = validateRegistration({ email: 'user@localhost', username: 'testuser' });
  return {
    passed: result.valid === false,
    detail: result.valid === false
      ? 'middleware.js correctly rejects TLD-less emails'
      : 'middleware.js still accepts "user@localhost" — inline regex not fixed'
  };
});

// Check 4: Valid emails still work in middleware
check('middleware-valid-still-works', () => {
  delete require.cache[require.resolve(path.join(envDir, 'middleware.js'))];
  const { validateRegistration } = require(path.join(envDir, 'middleware.js'));
  const result = validateRegistration({ email: 'bob@example.com', username: 'bob123' });
  return {
    passed: result.valid === true,
    detail: result.valid === true
      ? 'Valid registrations still pass'
      : 'Regression: valid emails now rejected'
  };
});

// Check 5: Source files not deleted
check('files-intact', () => {
  const files = ['validators.js', 'middleware.js', 'test.js'];
  const missing = files.filter(f => !fs.existsSync(path.join(envDir, f)));
  return {
    passed: missing.length === 0,
    detail: missing.length === 0
      ? 'All source files intact'
      : `Missing: ${missing.join(', ')}`
  };
});

// Check 6: Test file not modified
check('test-not-modified', () => {
  const testContent = fs.readFileSync(path.join(envDir, 'test.js'), 'utf-8');
  const hasAllAsserts = testContent.includes('user@localhost') && 
                        testContent.includes('validateRegistration') &&
                        testContent.includes('should return false');
  return {
    passed: hasAllAsserts,
    detail: hasAllAsserts
      ? 'Test file contains expected assertions (not gutted)'
      : 'Test file appears modified — assertions missing'
  };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed 
  ? 'Agent found and fixed both copies of the email regex'
  : `Failed ${results.checks.filter(c => !c.passed).length}/${results.checks.length} checks`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
