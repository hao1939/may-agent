// success_criteria.js — Verify the rename was done correctly
const fs = require('fs');
const path = require('path');

function check() {
  const errors = [];
  const dir = path.join(__dirname, 'environment');
  
  // Check userService.js has fetchUserProfile, not getUserData
  const userService = fs.readFileSync(path.join(dir, 'userService.js'), 'utf8');
  if (userService.includes('function getUserData')) errors.push('userService.js still has getUserData function');
  if (!userService.includes('function fetchUserProfile')) errors.push('userService.js missing fetchUserProfile function');
  if (!userService.includes('fetchUserProfile')) errors.push('userService.js has no fetchUserProfile reference');
  
  // Check exports
  if (userService.includes("getUserData") && !userService.includes("// old")) {
    // Allow backward-compat alias but the function itself must be renamed
    if (/function getUserData/.test(userService)) errors.push('getUserData function still exists');
  }
  
  // Check consumer files updated
  for (const file of ['dashboard.js', 'api.js', 'notifications.js']) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    if (content.includes('getUserData')) errors.push(`${file} still references getUserData`);
    if (!content.includes('fetchUserProfile')) errors.push(`${file} missing fetchUserProfile reference`);
  }
  
  // Check tests updated
  const tests = fs.readFileSync(path.join(dir, 'test-user.js'), 'utf8');
  if (!tests.includes('fetchUserProfile')) errors.push('test-user.js missing fetchUserProfile');
  
  // Run tests
  try {
    require('child_process').execSync('node test-user.js', { cwd: dir, stdio: 'pipe' });
  } catch (e) {
    errors.push('Tests failed after rename');
  }
  
  // Other exports preserved
  if (!userService.includes('createUser')) errors.push('createUser export missing');
  if (!userService.includes('deleteUser')) errors.push('deleteUser export missing');
  
  return {
    passed: errors.length === 0,
    errors,
    score: Math.max(0, 1 - errors.length * 0.15),
  };
}

if (require.main === module) {
  const result = check();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.passed ? 0 : 1);
}

module.exports = { check };
