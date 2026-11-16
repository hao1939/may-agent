// success_criteria.js — Verify the rename was done correctly
const fs = require('fs');
const path = require('path');

function check(workDir) {
  const checks = [];
  // Use workDir (passed by gym runner) or fallback to __dirname/environment
  const dir = workDir || path.join(__dirname, 'environment');
  
  // Check userService.js has fetchUserProfile, not getUserData
  const userService = fs.readFileSync(path.join(dir, 'userService.js'), 'utf8');
  
  checks.push({
    name: 'userService-renamed',
    passed: !userService.includes('function getUserData') && userService.includes('function fetchUserProfile'),
  });
  
  // Check consumer files updated
  for (const file of ['dashboard.js', 'api.js', 'notifications.js']) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    checks.push({
      name: `${file}-updated`,
      passed: !content.includes('getUserData') && content.includes('fetchUserProfile'),
    });
  }
  
  // Check tests updated
  const tests = fs.readFileSync(path.join(dir, 'test-user.js'), 'utf8');
  checks.push({
    name: 'test-user-updated',
    passed: tests.includes('fetchUserProfile'),
  });
  
  // Run tests
  let testsPassed = false;
  try {
    require('child_process').execSync('node test-user.js', { cwd: dir, stdio: 'pipe' });
    testsPassed = true;
  } catch (e) {}
  checks.push({ name: 'tests-pass', passed: testsPassed });
  
  // Other exports preserved
  checks.push({
    name: 'exports-preserved',
    passed: userService.includes('createUser') && userService.includes('deleteUser'),
  });
  
  const passed = checks.every(c => c.passed);
  return { passed, checks, summary: passed ? 'All checks passed' : 'Some checks failed' };
}

if (require.main === module) {
  const workDir = process.argv[2] || null;
  const result = check(workDir);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.passed ? 0 : 1);
}

module.exports = { check };
