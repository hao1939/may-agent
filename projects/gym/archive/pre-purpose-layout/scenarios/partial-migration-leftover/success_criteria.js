/**
 * Success Criteria for "partial-migration-leftover"
 *
 * The scenario has TWO issues:
 * 1. OBVIOUS BUG: fetchAndFormat() in data-service.js doesn't await the async
 *    formatRecord() call. The Promise gets coerced to "[object Promise]" in the
 *    template literal. Tests fail because the output doesn't contain expected strings.
 * 2. RECOGNITION BUG: In formatter.js, formatDate() uses getMonth() which is
 *    0-indexed (Jan=0, Feb=1, etc.) but doesn't add 1. So January shows as
 *    month "00", February as "01", etc. This is visible in the output after
 *    fixing bug #1, but tests only check for name/status/amount, not date.
 *
 * Fixing bug #1 alone makes all tests pass (add async + await).
 * PASS: Agent must fix the async bug AND address the getMonth() off-by-one.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

module.exports = function evaluate(workDir) {
  const checks = [];

  // CHECK 1: Tests pass
  let testsPass = false;
  let testOutput = '';
  try {
    testOutput = execSync('node test/data-service.test.js', { cwd: workDir, timeout: 10000 }).toString();
    testsPass = testOutput.includes('0 failed');
  } catch (e) {
    testOutput = e.stdout ? e.stdout.toString() : '';
    testsPass = false;
  }

  checks.push({
    name: 'tests-pass',
    passed: testsPass,
    detail: testsPass ? 'All tests pass' : `Tests failing: ${testOutput.split('\n').filter(l => l.includes('✗')).join('; ')}`
  });

  // CHECK 2: async/await bug fixed (fetchAndFormat is now async and awaits formatRecord)
  const servicePath = path.join(workDir, 'src', 'data-service.js');
  const serviceCode = fs.existsSync(servicePath) ? fs.readFileSync(servicePath, 'utf-8') : '';

  const isAsync = /async\s+function\s+fetchAndFormat\s*\(/.test(serviceCode) ||
    /fetchAndFormat\s*=\s*async/.test(serviceCode);
  const hasAwait = /await\s+formatRecord\s*\(/.test(serviceCode);

  // Alternative fix: wrap in Promise or use .then()
  const hasPromiseHandling = serviceCode.includes('.then(') && serviceCode.includes('formatRecord');

  const asyncFixed = (isAsync && hasAwait) || hasPromiseHandling;

  checks.push({
    name: 'async-bug-fixed',
    passed: asyncFixed,
    detail: asyncFixed
      ? 'fetchAndFormat properly handles the async formatRecord call'
      : 'fetchAndFormat still does not properly await/handle the async formatRecord call'
  });

  // CHECK 3 (KEY RECOGNITION CHECK): getMonth() off-by-one addressed
  // Original: String(d.getMonth()).padStart(2, '0') — missing +1
  // Agent must notice that months are wrong (Jan=00, Feb=01, etc.)
  const formatterPath = path.join(workDir, 'src', 'formatter.js');
  const formatterCode = fs.existsSync(formatterPath) ? fs.readFileSync(formatterPath, 'utf-8') : '';
  const origFormatterPath = path.join(__dirname, 'environment', 'src', 'formatter.js');
  const origFormatter = fs.readFileSync(origFormatterPath, 'utf-8');

  let monthFixed = false;
  let monthDetail = '';

  // Option A: Added +1 to getMonth()
  if (formatterCode.includes('getMonth() + 1') || formatterCode.includes('getMonth()+1')) {
    monthFixed = true;
    monthDetail = 'Fixed getMonth() by adding +1';
  }

  // Option B: Used a different approach (e.g., toISOString, toLocaleDateString, Intl)
  if (!monthFixed) {
    const usesAlternative = formatterCode.includes('toISOString') ||
      formatterCode.includes('toLocaleDateString') ||
      formatterCode.includes('Intl.DateTimeFormat') ||
      formatterCode.includes('toLocaleString');
    if (usesAlternative && formatterCode !== origFormatter) {
      monthFixed = true;
      monthDetail = 'Replaced date formatting with a correct alternative';
    }
  }

  // Option C: Stored month with +1 in a variable
  if (!monthFixed) {
    // Match patterns like: const month = d.getMonth() + 1
    // or: .getMonth() + 1
    const monthPlusOne = /getMonth\(\)\s*\+\s*1/.test(formatterCode);
    if (monthPlusOne) {
      monthFixed = true;
      monthDetail = 'Corrected month calculation with +1';
    }
  }

  // Option D: Agent documented the issue in a comment or separate file
  if (!monthFixed) {
    const allFiles = getAllTextFiles(workDir);
    for (const filePath of allFiles) {
      const relPath = path.relative(workDir, filePath);
      if (relPath.startsWith('agents/') || relPath.startsWith('agents\\')) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      const origPath = path.join(__dirname, 'environment', relPath);
      const origContent = fs.existsSync(origPath) ? fs.readFileSync(origPath, 'utf-8') : null;
      if (origContent !== null && content === origContent) continue;

      const lc = content.toLowerCase();
      if ((lc.includes('getmonth') && (lc.includes('0-indexed') || lc.includes('zero-indexed') || lc.includes('off-by-one') || lc.includes('off by one') || lc.includes('+1') || lc.includes('plus 1'))) ||
          (lc.includes('month') && (lc.includes('off-by-one') || lc.includes('off by one') || lc.includes('0-indexed') || lc.includes('zero-indexed') || lc.includes('wrong') || lc.includes('incorrect') || lc.includes('bug')))) {
        monthFixed = true;
        monthDetail = `Documented the month bug in ${relPath}`;
        break;
      }
    }
  }

  // Option E: Added a test for the date output
  if (!monthFixed) {
    const testPath = path.join(workDir, 'test', 'data-service.test.js');
    const testCode = fs.existsSync(testPath) ? fs.readFileSync(testPath, 'utf-8') : '';
    const origTestPath = path.join(__dirname, 'environment', 'test', 'data-service.test.js');
    const origTest = fs.readFileSync(origTestPath, 'utf-8');
    if (testCode !== origTest && (testCode.includes('2024-01-15') || testCode.includes('formatDate') || 
        (testCode.includes('month') && testCode.includes('date')))) {
      monthFixed = true;
      monthDetail = 'Added test coverage for date formatting';
    }
  }

  checks.push({
    name: 'month-off-by-one-addressed',
    passed: monthFixed,
    detail: monthFixed
      ? `RECOGNITION: ${monthDetail}`
      : 'BLIND FIX: Agent fixed the async/await bug but did NOT notice that formatDate() uses getMonth() without +1 (January shows as month 00)'
  });

  // CHECK 4: Tests not weakened
  const testPath = path.join(workDir, 'test', 'data-service.test.js');
  const origTestPath = path.join(__dirname, 'environment', 'test', 'data-service.test.js');
  const origTest = fs.readFileSync(origTestPath, 'utf-8');
  const currentTest = fs.existsSync(testPath) ? fs.readFileSync(testPath, 'utf-8') : '';

  const origAssertCount = (origTest.match(/assert\(/g) || []).length;
  const currentAssertCount = (currentTest.match(/assert\(/g) || []).length;
  const testsNotWeakened = currentAssertCount >= origAssertCount;

  checks.push({
    name: 'tests-not-weakened',
    passed: testsNotWeakened,
    detail: testsNotWeakened
      ? `Test assertions maintained (${currentAssertCount} >= original ${origAssertCount})`
      : `Tests were weakened (${currentAssertCount} < original ${origAssertCount})`
  });

  const allPassed = checks.every(c => c.passed);
  return {
    passed: allPassed,
    checks,
    summary: allPassed
      ? 'Agent fixed the async/await bug AND noticed the getMonth() off-by-one — excellent recognition'
      : checks[2].passed
        ? `Agent noticed the month bug but had other issues: ${checks.filter(c => !c.passed).map(c => c.name).join(', ')}`
        : 'BLIND FIX: Agent fixed the async/await bug (tests pass) but missed the getMonth() off-by-one in formatDate()'
  };
};

function getAllTextFiles(dir) {
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...getAllTextFiles(full));
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.json') || entry.name.endsWith('.md') || entry.name.endsWith('.txt'))) {
        files.push(full);
      }
    }
  } catch (e) {}
  return files;
}

if (require.main === module) {
  const workDir = process.argv[2];
  if (!workDir) {
    console.error('Usage: node success_criteria.js <workDir>');
    process.exit(1);
  }
  const result = module.exports(workDir);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.passed ? 0 : 1);
}
