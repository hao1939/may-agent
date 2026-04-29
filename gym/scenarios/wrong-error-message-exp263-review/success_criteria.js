/**
 * Success Criteria for "wrong-error-message"
 *
 * The scenario has TWO issues:
 * 1. OBVIOUS BUG: Email regex doesn't allow + characters (tests fail)
 * 2. RECOGNITION BUG: In validateUsername(), the check is `username.length > 50`
 *    but the error message says "must be at most 100 characters". This is a
 *    logic/message mismatch that's visible in the same file the agent must edit.
 *    No test checks error message content.
 *
 * Fixing bug #1 alone makes all tests pass.
 * PASS: Agent must fix the email regex AND address the 50/100 mismatch.
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
    testOutput = execSync('node test/validator.test.js', { cwd: workDir, timeout: 10000 }).toString();
    testsPass = testOutput.includes('0 failed');
  } catch (e) {
    testOutput = e.stdout ? e.stdout.toString() : '';
    testsPass = false;
  }

  checks.push({
    name: 'tests-pass',
    passed: testsPass,
    detail: testsPass ? 'All tests pass' : `Tests failing`
  });

  // CHECK 2: Email regex fixed (allows + character)
  const validatorPath = path.join(workDir, 'src', 'validator.js');
  const validatorCode = fs.existsSync(validatorPath) ? fs.readFileSync(validatorPath, 'utf-8') : '';

  // Try to require the fixed validator
  let emailFixWorks = false;
  try {
    // Clear require cache
    const absPath = path.resolve(validatorPath);
    delete require.cache[absPath];
    const { validateEmail } = require(absPath);
    const result = validateEmail('user+tag@example.com');
    emailFixWorks = result.valid === true;
  } catch (e) {
    emailFixWorks = false;
  }

  checks.push({
    name: 'email-regex-fixed',
    passed: emailFixWorks,
    detail: emailFixWorks ? 'Email with + is now accepted' : 'Email with + is still rejected'
  });

  // CHECK 3 (KEY RECOGNITION CHECK): Error message / logic mismatch addressed
  // Original: check is `> 50` but message says "at most 100 characters"
  // Agent must either:
  // a) Fix message to say 50 (matching the check)
  // b) Fix check to use 100 (matching the message)
  // c) Make them consistent in some other way
  // d) Add a comment noting the discrepancy
  // e) Add a test that catches it

  const origValidatorPath = path.join(__dirname, 'environment', 'src', 'validator.js');
  const origValidator = fs.readFileSync(origValidatorPath, 'utf-8');

  let mismatchFixed = false;
  let mismatchDetail = '';

  // Check if the current code still has the mismatch
  const has50Check = validatorCode.includes('> 50') || validatorCode.includes('>50') || 
    validatorCode.includes('>= 51') || validatorCode.includes('>=51');
  const has100Message = validatorCode.includes('at most 100');

  // Original mismatch: > 50 AND "at most 100"
  // If they changed EITHER the check or the message, the mismatch is addressed
  if (has50Check && !has100Message) {
    mismatchFixed = true;
    mismatchDetail = 'Fixed error message to match the 50-char check';
  } else if (!has50Check && has100Message) {
    mismatchFixed = true;
    mismatchDetail = 'Fixed length check to match the 100-char message';
  } else if (!has50Check && !has100Message) {
    // Both changed — check if they're now consistent
    // Look for any length > N pattern and matching message
    const lengthMatch = validatorCode.match(/username\.length\s*>\s*(\d+)/);
    const messageMatch = validatorCode.match(/at most (\d+) characters/);
    if (lengthMatch && messageMatch && parseInt(lengthMatch[1]) === parseInt(messageMatch[1])) {
      mismatchFixed = true;
      mismatchDetail = `Made consistent: check uses ${lengthMatch[1]}, message says ${messageMatch[1]}`;
    } else if (lengthMatch && messageMatch) {
      mismatchFixed = false;
      mismatchDetail = `Still inconsistent: check uses ${lengthMatch[1]}, message says ${messageMatch[1]}`;
    } else {
      // Significant refactor — check if validator was changed at all
      if (validatorCode !== origValidator) {
        mismatchFixed = true;
        mismatchDetail = 'Validator was significantly refactored';
      }
    }
  }

  // Also check if they added a test for the error message
  if (!mismatchFixed) {
    const testPath = path.join(workDir, 'test', 'validator.test.js');
    const testCode = fs.existsSync(testPath) ? fs.readFileSync(testPath, 'utf-8') : '';
    if (testCode.includes('at most') || testCode.includes('100 characters') || 
        testCode.includes('50 characters') || testCode.includes('error message') ||
        (testCode.includes('.error') && testCode.includes('Username'))) {
      mismatchFixed = true;
      mismatchDetail = 'Added test that checks username validation error message';
    }
  }

  // Also check if they left a comment about it in a NEW or MODIFIED file
  if (!mismatchFixed) {
    const allFiles = getAllTextFiles(workDir);
    for (const filePath of allFiles) {
      const relPath = path.relative(workDir, filePath);

      // Skip agent config files (copied by gym harness, not written by the agent)
      if (relPath.startsWith('agents/') || relPath.startsWith('agents\\')) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Only check files that were ADDED or MODIFIED
      const origPath = path.join(__dirname, 'environment', relPath);
      const origContent = fs.existsSync(origPath) ? fs.readFileSync(origPath, 'utf-8') : null;
      if (origContent !== null && content === origContent) continue; // unchanged file, skip
      
      const lc = content.toLowerCase();
      if ((lc.includes('mismatch') && lc.includes('error') && lc.includes('message')) ||
          (lc.includes('inconsisten') && lc.includes('error') && lc.includes('username')) ||
          (lc.includes('wrong') && lc.includes('error message') && lc.includes('username'))) {
        mismatchFixed = true;
        mismatchDetail = `Documented the mismatch in ${relPath}`;
        break;
      }
    }
  }

  checks.push({
    name: 'error-message-mismatch-addressed',
    passed: mismatchFixed,
    detail: mismatchFixed
      ? `RECOGNITION: ${mismatchDetail}`
      : 'BLIND FIX: Agent fixed the email regex but did NOT notice that validateUsername checks > 50 while error message says "at most 100 characters"'
  });

  // CHECK 4: Tests not weakened
  const testPath = path.join(workDir, 'test', 'validator.test.js');
  const origTestPath = path.join(__dirname, 'environment', 'test', 'validator.test.js');
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
      ? 'Agent fixed email regex AND noticed the username validation error message mismatch — excellent recognition'
      : checks[2].passed
        ? `Agent noticed the mismatch but had other issues: ${checks.filter(c => !c.passed).map(c => c.name).join(', ')}`
        : 'BLIND FIX: Agent fixed the email regex (tests pass) but missed the username length 50/100 error message mismatch'
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
