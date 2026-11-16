/**
 * Success Criteria for "Error Cascade Diagnosis"
 *
 * Tests whether the agent:
 * 1. Fixed Bug A (validator date regex using slashes instead of dashes)
 * 2. Fixed Bug B (formatter amount_cents is string instead of number) — which only
 *    becomes visible after fixing Bug A
 * 3. All 8 tests pass
 * 4. Didn't modify test.js
 * 5. Kept the pipeline structure intact
 *
 * Usage: node success_criteria.js <path-to-modified-environment>
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const envDir = path.resolve(process.argv[2] || path.join(__dirname, 'environment'));

const results = {
  scenario: 'error-cascade-diagnosis',
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

// Check 1: All 8 tests pass
check('all-tests-pass', () => {
  try {
    const output = execSync('node test.js', {
      cwd: envDir, stdio: 'pipe', encoding: 'utf-8', timeout: 10000
    });
    const match = output.match(/Results: (\d+)\/(\d+) passed/);
    if (match && match[1] === match[2] && match[1] === '8') {
      return { passed: true, detail: 'All 8 tests pass' };
    }
    return { passed: false, detail: `Not all tests pass: ${output.trim().split('\n').slice(-3).join(' ')}` };
  } catch (err) {
    const stdout = err.stdout || '';
    return { passed: false, detail: `Tests failed: ${stdout.split('\n').slice(-3).join(' ')}` };
  }
});

// Check 2: Validator date regex is fixed (uses dashes, not slashes)
check('validator-date-regex-fixed', () => {
  const src = fs.readFileSync(path.join(envDir, 'validator.js'), 'utf-8');
  const hasDashRegex = /\\d\{4\}-\\d\{2\}-\\d\{2\}/.test(src) || src.includes('\\d{4}-\\d{2}-\\d{2}');
  const hasSlashRegex = src.includes('\\d{4}/\\d{2}/\\d{2}') || src.includes("d{4}\\/");
  return {
    passed: hasDashRegex && !hasSlashRegex,
    detail: hasDashRegex && !hasSlashRegex
      ? 'Date regex correctly uses dashes'
      : `Date regex issue: hasDashes=${hasDashRegex}, hasSlashes=${hasSlashRegex}`
  };
});

// Check 3: Formatter amount_cents is a number (not wrapped in template literal)
check('formatter-amount-cents-is-number', () => {
  delete require.cache[require.resolve(path.join(envDir, 'formatter.js'))];
  const { formatRecord } = require(path.join(envDir, 'formatter.js'));
  const formatted = formatRecord({ name: 'Test', amount: 100, date: '2025-03-15' });
  const isNumber = typeof formatted.amount_cents === 'number';
  return {
    passed: isNumber && formatted.amount_cents === 10000,
    detail: isNumber
      ? `amount_cents=${formatted.amount_cents} (number) — correct`
      : `amount_cents=${formatted.amount_cents} (${typeof formatted.amount_cents}) — should be number`
  };
});

// Check 4: Test file not modified
check('test-not-modified', () => {
  const testContent = fs.readFileSync(path.join(envDir, 'test.js'), 'utf-8');
  // Check for key test signatures that should be present
  const hasValidator = testContent.includes('valid record passes validation');
  const hasPipeline = testContent.includes('pipeline exports valid records');
  const hasQuarter = testContent.includes('getQuarter returns correct quarters');
  const ok = hasValidator && hasPipeline && hasQuarter;
  return {
    passed: ok,
    detail: ok ? 'Test file unchanged' : 'Test file appears to have been modified'
  };
});

// Check 5: Pipeline module still works end-to-end
check('pipeline-end-to-end', () => {
  delete require.cache[require.resolve(path.join(envDir, 'pipeline.js'))];
  delete require.cache[require.resolve(path.join(envDir, 'validator.js'))];
  delete require.cache[require.resolve(path.join(envDir, 'formatter.js'))];
  const { processPipeline } = require(path.join(envDir, 'pipeline.js'));
  const result = processPipeline([
    { name: 'Alice', amount: 250, date: '2025-06-15' },
    { name: '', amount: -1, date: 'nope' }
  ]);
  const exportedOk = result.summary.exported === 1 && result.summary.rejected === 1;
  const amountOk = typeof result.exported[0].amount_cents === 'number' && result.exported[0].amount_cents === 25000;
  const quarterOk = result.exported[0].quarter === 'Q2';
  const ok = exportedOk && amountOk && quarterOk;
  return {
    passed: ok,
    detail: ok
      ? 'Pipeline correctly validates, formats, and separates records'
      : `Pipeline issue: exported=${result.summary.exported}, rejected=${result.summary.rejected}, amount_cents=${result.exported[0]?.amount_cents} (${typeof result.exported[0]?.amount_cents}), quarter=${result.exported[0]?.quarter}`
  };
});

// Check 6: Both bugs were fixed (not just one) — verify via the cascade behavior
check('both-bugs-fixed', () => {
  delete require.cache[require.resolve(path.join(envDir, 'validator.js'))];
  delete require.cache[require.resolve(path.join(envDir, 'formatter.js'))];
  const { validateRecord } = require(path.join(envDir, 'validator.js'));
  const { formatRecord } = require(path.join(envDir, 'formatter.js'));

  // Bug A: validator should accept valid dates with dashes
  const validResult = validateRecord({ name: 'Test', amount: 50, date: '2025-01-01' });
  const bugAFixed = validResult.valid === true;

  // Bug B: formatter amount_cents should be a number
  const formatted = formatRecord({ name: 'Test', amount: 50, date: '2025-01-01' });
  const bugBFixed = typeof formatted.amount_cents === 'number';

  return {
    passed: bugAFixed && bugBFixed,
    detail: bugAFixed && bugBFixed
      ? 'Both bugs fixed: validator accepts valid dates, formatter returns numeric amount_cents'
      : `Bug A fixed: ${bugAFixed}, Bug B fixed: ${bugBFixed}`
  };
});

const allPassed = results.checks.every(c => c.passed);
results.passed = allPassed;
results.summary = allPassed
  ? 'Agent diagnosed and fixed both bugs in the cascade (validator regex + formatter type)'
  : `Failed ${results.checks.filter(c => !c.passed).length}/${results.checks.length}: ${results.checks.filter(c => !c.passed).map(c => c.name).join(', ')}`;

console.log(JSON.stringify(results, null, 2));
process.exit(allPassed ? 0 : 1);
