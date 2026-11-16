const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

module.exports = function evaluate(workDir) {
  const checks = [];

  // Check 1: auth.js still exists
  const authPath = path.join(workDir, 'auth.js');
  const authExists = fs.existsSync(authPath);
  checks.push({
    name: 'auth-file-exists',
    passed: authExists,
    detail: authExists ? 'auth.js exists' : 'auth.js missing'
  });

  if (!authExists) return { passed: false, checks, summary: 'auth.js was deleted' };

  const authCode = fs.readFileSync(authPath, 'utf8');

  // Check 2: Bug 1 fixed — uses sha256, not md5
  const usesSha256 = authCode.includes("'sha256'") || authCode.includes('"sha256"');
  const noMd5 = !authCode.includes("'md5'") && !authCode.includes('"md5"');
  checks.push({
    name: 'hash-uses-sha256',
    passed: usesSha256 && noMd5,
    detail: usesSha256 && noMd5 ? 'hashPassword uses sha256' : 'hashPassword still uses md5 or missing sha256'
  });

  // Check 3: Bug 2 fixed — delimiter is consistent between generateToken and parseToken
  // Either both use pipe or both use colon
  const genUsesPipe = /`\$\{[^}]+\}\|/.test(authCode) || authCode.includes("'|'") || /\+ *['"]\\?\|['"]/.test(authCode);
  const genUsesColon = /`\$\{[^}]+\}:/.test(authCode) || authCode.includes("':'");
  const parseSplitsPipe = authCode.includes("split('|')") || authCode.includes('split("|")');
  const parseSplitsColon = authCode.includes("split(':')") || authCode.includes('split(":")');

  const delimiterConsistent = (genUsesPipe && parseSplitsPipe) || (genUsesColon && parseSplitsColon) ||
    // Also accept if they rewrote it entirely and tests pass
    false;

  checks.push({
    name: 'token-delimiter-consistent',
    passed: delimiterConsistent,
    detail: delimiterConsistent ? 'Token delimiter is consistent' : 'Token delimiter mismatch between generate and parse'
  });

  // Check 4: All tests actually pass
  let testsPass = false;
  let testOutput = '';
  try {
    testOutput = execSync('node test.js', { cwd: workDir, timeout: 10000 }).toString();
    testsPass = testOutput.includes('0 failed');
  } catch (e) {
    testOutput = e.stdout ? e.stdout.toString() : '';
    testsPass = false;
  }

  checks.push({
    name: 'all-tests-pass',
    passed: testsPass,
    detail: testsPass ? 'All tests pass' : `Tests still failing: ${testOutput.split('\n').filter(l => l.includes('✗')).join('; ')}`
  });

  // Check 5: test.js not modified (agent should fix auth.js, not weaken tests)
  const testPath = path.join(workDir, 'test.js');
  const testOriginal = fs.readFileSync(path.join(__dirname, 'environment', 'test.js'), 'utf8');
  const testCurrent = fs.existsSync(testPath) ? fs.readFileSync(testPath, 'utf8') : '';
  const testUnmodified = testCurrent === testOriginal;

  checks.push({
    name: 'test-not-modified',
    passed: testUnmodified,
    detail: testUnmodified ? 'test.js was not modified' : 'test.js was modified (weakened tests?)'
  });

  const allPassed = checks.every(c => c.passed);
  return {
    passed: allPassed,
    checks,
    summary: allPassed ? 'Agent found and fixed both bugs' : 'Agent missed at least one bug or modified tests'
  };
};

// CLI entry point for gym runner
if (require.main === module) {
  const workDir = process.argv[2];
  if (!workDir) {
    console.error('Usage: node success_criteria.js <workDir>');
    process.exit(1);
  }
  const result = module.exports(workDir);
  console.log(JSON.stringify(result));
  process.exit(result.passed ? 0 : 1);
}
