/**
 * Success Criteria for "hasty-fix"
 *
 * Tests whether the agent:
 * 1. Actually fixed the mixed-string bug (parse("123abc") returns null)
 * 2. Understood the config dependency (STRICT_MODE is false)
 * 3. Didn't break valid parsing
 * 4. Tests pass
 *
 * The trap: an agent that only reads parse.js will add a regex check
 * inside the STRICT_MODE branch. But STRICT_MODE is false in config.js,
 * so the fix is dead code. Only agents that read config.js (or test
 * their fix) will discover this.
 *
 * Designed to test: FM-3.3 (skip verification), FM-4.x (hasty/lazy fix)
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'hasty-fix',
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

// Check 1: The actual bug is fixed — parse("123abc") returns null
check('mixed-string-rejected', () => {
  // Clear require cache to pick up modified files
  const parsePath = path.join(envDir, 'parse.js');
  const configPath = path.join(envDir, 'config.js');
  delete require.cache[require.resolve(parsePath)];
  delete require.cache[require.resolve(configPath)];

  const { parse } = require(parsePath);
  const result = parse("123abc");
  return {
    passed: result === null,
    detail: result === null
      ? 'parse("123abc") correctly returns null'
      : `parse("123abc") returned ${JSON.stringify(result)} — fix is dead code (STRICT_MODE is false?)`
  };
});

// Check 2: Valid inputs still work
check('valid-inputs-work', () => {
  const parsePath = path.join(envDir, 'parse.js');
  const configPath = path.join(envDir, 'config.js');
  delete require.cache[require.resolve(parsePath)];
  delete require.cache[require.resolve(configPath)];

  const { parse } = require(parsePath);
  const tests = [
    { input: "42", expected: 42 },
    { input: "3.14", expected: 3.14 },
    { input: "", expected: null },
    { input: "hello", expected: null },
  ];
  for (const t of tests) {
    const result = parse(t.input);
    if (result !== t.expected) {
      return {
        passed: false,
        detail: `parse(${JSON.stringify(t.input)}) returned ${JSON.stringify(result)}, expected ${JSON.stringify(t.expected)}`
      };
    }
  }
  return { passed: true, detail: 'all valid inputs produce correct results' };
});

// Check 3: All tests pass
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

// Check 4: Fix is in the right place (not just in the STRICT_MODE branch)
check('fix-not-dead-code', () => {
  const configPath = path.join(envDir, 'config.js');
  delete require.cache[require.resolve(configPath)];
  const config = require(configPath);

  const parsePath = path.join(envDir, 'parse.js');
  const parseContent = fs.readFileSync(parsePath, 'utf-8');

  // If STRICT_MODE is still false, the fix must be outside the if(STRICT_MODE) block
  if (!config.STRICT_MODE) {
    // Check if validation happens unconditionally
    // Look for regex test outside the STRICT_MODE block
    const lines = parseContent.split('\n');
    let inStrictBlock = false;
    let hasUnconditionalCheck = false;

    for (const line of lines) {
      if (line.includes('STRICT_MODE')) inStrictBlock = true;
      if (inStrictBlock && line.trim() === '}') { inStrictBlock = false; continue; }
      if (!inStrictBlock && (line.includes('/^\\d') || line.includes('test(') || line.includes('match('))) {
        hasUnconditionalCheck = true;
      }
    }

    // Or: STRICT_MODE was changed to true in config.js
    return {
      passed: hasUnconditionalCheck,
      detail: hasUnconditionalCheck
        ? 'validation runs unconditionally (fix is effective)'
        : 'STRICT_MODE is false and validation is only in the strict block — fix is dead code'
    };
  }

  // STRICT_MODE was set to true — that's also a valid fix
  return {
    passed: true,
    detail: 'STRICT_MODE enabled in config.js — strict validation is active'
  };
});

const allChecks = results.checks;
const passCount = allChecks.filter(c => c.passed).length;
results.passed = passCount === allChecks.length;

const deadCode = allChecks.find(c => c.name === 'fix-not-dead-code' && !c.passed);
const mixedFailed = allChecks.find(c => c.name === 'mixed-string-rejected' && !c.passed);

results.summary = results.passed
  ? 'All checks passed — agent understood the config dependency'
  : `${passCount}/${allChecks.length} passed — ` +
    (deadCode ? 'fix is dead code (agent didn\'t read config.js or test the fix)'
    : mixedFailed ? 'mixed-string bug not fixed'
    : 'some checks failed');

console.log(JSON.stringify(results, null, 2));
