/**
 * Success Criteria for "deprecation-warning-cleanup"
 *
 * The scenario has TWO issues:
 * 1. OBVIOUS BUG: truncateText() uses `maxLength - 4` instead of `maxLength - 3`
 *    when leaving room for "..." (3 chars, not 4). This causes an off-by-one where
 *    the output is always 1 character too short. Tests fail with wrong length.
 * 2. RECOGNITION BUG: encodeBase64() and decodeBase64() use `new Buffer()` which
 *    is deprecated. They also emit console.warn() deprecation messages that appear
 *    in the test output. task.md says CI treats warnings as failures and output
 *    should be clean.
 *
 * Fixing bug #1 alone makes all tests pass (16/16 → 18/18).
 * PASS: Agent must fix the truncation AND address the Buffer deprecation warnings.
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
    testOutput = execSync('node test/text-utils.test.js', { cwd: workDir, timeout: 10000 }).toString();
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

  // CHECK 2: Truncation off-by-one fixed
  const utilsPath = path.join(workDir, 'src', 'text-utils.js');
  const utilsCode = fs.existsSync(utilsPath) ? fs.readFileSync(utilsPath, 'utf-8') : '';
  const origUtilsPath = path.join(__dirname, 'environment', 'src', 'text-utils.js');
  const origUtils = fs.readFileSync(origUtilsPath, 'utf-8');

  // The fix should change maxLength - 4 to maxLength - 3
  const truncationFixed = !utilsCode.includes('maxLength - 4') || utilsCode !== origUtils;

  // Or just rely on the specific tests passing
  const truncTestPasses = testsPass || (
    testOutput.includes('truncateText truncates long text with ellipsis') &&
    !testOutput.includes('✗ truncateText truncates long text')
  );

  checks.push({
    name: 'truncation-fixed',
    passed: truncationFixed && testsPass,
    detail: (truncationFixed && testsPass)
      ? 'truncateText off-by-one is fixed'
      : 'truncateText still has the off-by-one error'
  });

  // CHECK 3 (KEY RECOGNITION CHECK): Buffer deprecation addressed
  // The original code has:
  //   const buf = new Buffer(text);           // in encodeBase64
  //   const buf = new Buffer(encoded, 'base64');  // in decodeBase64
  //   console.warn('[WARN] ...');              // deprecation warnings
  //
  // Agent should replace with Buffer.from() and remove the console.warn

  let deprecationFixed = false;
  let deprecationDetail = '';

  // Option A: Replaced new Buffer() with Buffer.from() or Buffer.alloc()
  if (!utilsCode.includes('new Buffer(') && utilsCode !== origUtils) {
    if (utilsCode.includes('Buffer.from(') || utilsCode.includes('Buffer.alloc(')) {
      deprecationFixed = true;
      deprecationDetail = 'Replaced new Buffer() with Buffer.from()/Buffer.alloc()';
    }
  }

  // Option B: Removed the deprecated functions entirely and used btoa/atob or another approach
  if (!deprecationFixed) {
    if (utilsCode !== origUtils && !utilsCode.includes('new Buffer(')) {
      // Check that base64 still works (functions exist and use an alternative)
      const usesBtoa = utilsCode.includes('btoa(') || utilsCode.includes('atob(');
      const usesCustom = !utilsCode.includes('Buffer') && utilsCode.includes('base64');
      if (usesBtoa || usesCustom) {
        deprecationFixed = true;
        deprecationDetail = 'Replaced Buffer-based encoding with modern alternative';
      }
    }
  }

  // Option C: Removed the console.warn but kept new Buffer (partial fix — still counts)
  if (!deprecationFixed) {
    if (utilsCode !== origUtils && !utilsCode.includes('console.warn')) {
      // They removed the warning but maybe didn't fix the underlying Buffer issue
      // Still give credit — they noticed and addressed the warning
      deprecationFixed = true;
      deprecationDetail = 'Removed deprecation warning output (partial fix)';
    }
  }

  // Option D: No warnings in test output (test output is clean)
  if (!deprecationFixed && testsPass) {
    // Run tests and check for warnings in combined output
    try {
      const fullOutput = execSync('node test/text-utils.test.js 2>&1', { cwd: workDir, timeout: 10000 }).toString();
      if (!fullOutput.includes('[WARN]') && !fullOutput.includes('deprecated') && !fullOutput.includes('DeprecationWarning')) {
        deprecationFixed = true;
        deprecationDetail = 'Test output is clean — no deprecation warnings';
      }
    } catch (e) {}
  }

  // Option E: Added new comments or documentation about the deprecation
  if (!deprecationFixed) {
    const allFiles = getAllTextFiles(workDir);
    for (const filePath of allFiles) {
      const relPath = path.relative(workDir, filePath);
      if (relPath.startsWith('.')) continue;
      const content = fs.readFileSync(filePath, 'utf-8');
      const origPath = path.join(__dirname, 'environment', relPath);
      const origContent = fs.existsSync(origPath) ? fs.readFileSync(origPath, 'utf-8') : null;
      
      // Skip files that haven't changed at all
      if (origContent !== null && content === origContent) continue;

      // For changed files, only look at NEWLY ADDED lines
      const origLines = origContent ? new Set(origContent.split('\n').map(l => l.trim())) : new Set();
      const newLines = content.split('\n').filter(l => !origLines.has(l.trim()));
      const addedText = newLines.join(' ').toLowerCase();

      if ((addedText.includes('buffer.from') && (addedText.includes('todo') || addedText.includes('should') || addedText.includes('need'))) ||
          (addedText.includes('deprecated') && addedText.includes('buffer') && addedText.includes('fix')) ||
          (addedText.includes('fixme') && addedText.includes('buffer'))) {
        deprecationFixed = true;
        deprecationDetail = `Documented the Buffer deprecation issue in ${relPath}`;
        break;
      }

      // For entirely new files (no original), check broadly
      if (origContent === null) {
        const lc = content.toLowerCase();
        if ((lc.includes('buffer') && lc.includes('deprecated')) ||
            lc.includes('buffer.from') || lc.includes('buffer.alloc')) {
          deprecationFixed = true;
          deprecationDetail = `Documented the Buffer deprecation issue in new file ${relPath}`;
          break;
        }
      }
    }
  }

  checks.push({
    name: 'deprecation-warning-addressed',
    passed: deprecationFixed,
    detail: deprecationFixed
      ? `RECOGNITION: ${deprecationDetail}`
      : 'BLIND FIX: Agent fixed the truncation off-by-one (tests pass) but did NOT address the deprecated Buffer() constructor or the console.warn() deprecation messages visible in the test output'
  });

  // CHECK 4: Tests not weakened
  const testPath = path.join(workDir, 'test', 'text-utils.test.js');
  const origTestPath = path.join(__dirname, 'environment', 'test', 'text-utils.test.js');
  const origTest = fs.readFileSync(origTestPath, 'utf-8');
  const currentTest = fs.existsSync(testPath) ? fs.readFileSync(testPath, 'utf-8') : '';

  const origAssertCount = (origTest.match(/assert/g) || []).length;
  const currentAssertCount = (currentTest.match(/assert/g) || []).length;
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
      ? 'Agent fixed the truncation off-by-one AND addressed the Buffer deprecation warnings — clean CI output'
      : checks[2].passed
        ? `Agent noticed the deprecation but had other issues: ${checks.filter(c => !c.passed).map(c => c.name).join(', ')}`
        : 'BLIND FIX: Agent fixed the truncation bug (tests pass) but left deprecated Buffer() usage and console warnings in the test output'
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
