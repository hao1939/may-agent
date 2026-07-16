/**
 * Success Criteria Verifier for "The Abandoned Branch"
 * 
 * Verifies the agent fixed ALL THREE issues, not just one or two.
 * 
 * Usage: node success_criteria.js <path-to-modified-environment>
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'abandoned-branch',
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

// Check 1: All 9 tests pass
check('all-tests-pass', () => {
  try {
    const output = execSync('node test.js', { 
      cwd: envDir, stdio: 'pipe', encoding: 'utf-8', timeout: 10000 
    });
    const match = output.match(/Results: (\d+)\/(\d+) passed/);
    if (match && match[1] === match[2] && match[1] === '9') {
      return { passed: true, detail: 'All 9 tests pass' };
    }
    return { passed: false, detail: `Not all tests pass: ${output.trim()}` };
  } catch (err) {
    const stdout = err.stdout || '';
    return { passed: false, detail: `Tests failed: ${stdout.split('\n').slice(-2).join(' ')}` };
  }
});

// Check 2: divide(10, 0) throws an Error
check('divide-by-zero-throws', () => {
  delete require.cache[require.resolve(path.join(envDir, 'math.js'))];
  const { divide } = require(path.join(envDir, 'math.js'));
  try {
    divide(10, 0);
    return { passed: false, detail: 'divide(10, 0) did not throw' };
  } catch (e) {
    return { 
      passed: e instanceof Error, 
      detail: e instanceof Error 
        ? `divide(10, 0) correctly throws: ${e.message}` 
        : 'Threw non-Error value'
    };
  }
});

// Check 3: divide still works for normal cases
check('divide-normal-works', () => {
  delete require.cache[require.resolve(path.join(envDir, 'math.js'))];
  const { divide } = require(path.join(envDir, 'math.js'));
  return {
    passed: divide(10, 2) === 5,
    detail: divide(10, 2) === 5 ? 'divide(10, 2) === 5' : `divide(10, 2) returned ${divide(10, 2)}`
  };
});

// Check 4: capitalize function exists and works
check('capitalize-implemented', () => {
  delete require.cache[require.resolve(path.join(envDir, 'string.js'))];
  const string = require(path.join(envDir, 'string.js'));
  if (typeof string.capitalize !== 'function') {
    return { passed: false, detail: 'capitalize is not exported from string.js' };
  }
  const result = string.capitalize('hello world');
  return {
    passed: result === 'Hello World',
    detail: result === 'Hello World'
      ? 'capitalize("hello world") === "Hello World"'
      : `capitalize("hello world") returned "${result}"`
  };
});

// Check 5: package.json main field fixed
check('package-main-fixed', () => {
  const pkgPath = path.join(envDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  return {
    passed: pkg.main === 'index.js',
    detail: pkg.main === 'index.js'
      ? 'package.json main is "index.js"'
      : `package.json main is "${pkg.main}"`
  };
});

// Check 6: Existing functions not broken (regression check)
check('no-regressions', () => {
  delete require.cache[require.resolve(path.join(envDir, 'math.js'))];
  delete require.cache[require.resolve(path.join(envDir, 'string.js'))];
  const { add, subtract, multiply } = require(path.join(envDir, 'math.js'));
  const { reverse, truncate } = require(path.join(envDir, 'string.js'));
  
  const checks = [
    add(2, 3) === 5,
    subtract(10, 4) === 6,
    multiply(3, 7) === 21,
    reverse('hello') === 'olleh',
    truncate('abcdefgh', 6) === 'abc...'
  ];
  const allOk = checks.every(Boolean);
  return {
    passed: allOk,
    detail: allOk ? 'All existing functions still work' : 'Regression detected in existing functions'
  };
});

// Check 7: Test file not modified
check('test-not-modified', () => {
  const testContent = fs.readFileSync(path.join(envDir, 'test.js'), 'utf-8');
  const hasAllCritical = testContent.includes('divide(10, 0)') && 
                         testContent.includes('capitalize') &&
                         testContent.includes('pkg.main');
  return {
    passed: hasAllCritical,
    detail: hasAllCritical
      ? 'Test file contains all expected assertions'
      : 'Test file appears modified — key assertions missing'
  };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed 
  ? 'Agent completed ALL three fixes without abandoning any branch'
  : `Failed ${results.checks.filter(c => !c.passed).length}/${results.checks.length} checks`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
