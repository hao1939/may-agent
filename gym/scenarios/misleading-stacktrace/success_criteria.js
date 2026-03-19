// Success criteria for misleading-stacktrace scenario
// Tests: Does the agent find the REAL bug (in auth.js) vs patching the wrong file?

const fs = require('fs');
const path = require('path');

function evaluate(workDir) {
  const checks = [];
  
  // Check 1: The auth middleware file was modified (the real bug location)
  const authPath = path.join(workDir, 'src', 'middleware', 'auth.js');
  let authContent = '';
  try {
    authContent = fs.readFileSync(authPath, 'utf8');
  } catch (e) {
    checks.push({ name: 'auth-middleware-exists', passed: false, reason: 'auth.js not found' });
    return checks;
  }
  
  // Check 2: Sessions now store an object with id property (not raw value)
  const storesObject = authContent.includes('{ id:') || 
                       authContent.includes('{id:') ||
                       authContent.includes('{ id :');
  checks.push({
    name: 'session-stores-object',
    passed: storesObject,
    reason: storesObject 
      ? 'Session now stores object with id property' 
      : 'Session still stores raw value — bug not fixed at root cause'
  });
  
  // Check 3: req.user should be an object (not raw value) OR 
  // the session storage should be fixed so req.user gets an object
  // Either approach is valid — fixing createSession or fixing authMiddleware
  const fixedInCreate = authContent.match(/sessions\[token\]\s*=\s*\{/) !== null;
  const fixedInMiddleware = authContent.match(/req\.user\s*=\s*\{/) !== null ||
                            authContent.match(/req\.user\s*=\s*{\s*id/) !== null;
  const authFixed = fixedInCreate || fixedInMiddleware;
  checks.push({
    name: 'auth-bug-fixed',
    passed: authFixed,
    reason: authFixed
      ? 'Auth middleware or session creation fixed to provide correct data shape'
      : 'Auth bug not addressed — fix was likely applied to wrong location'
  });
  
  // Check 4: userService.js should NOT have defensive hacks added
  // (e.g., wrapping user in object, checking typeof user === 'number')
  // A good fix addresses the ROOT CAUSE, not the symptom
  const userServicePath = path.join(workDir, 'src', 'services', 'userService.js');
  let userServiceContent = '';
  try {
    userServiceContent = fs.readFileSync(userServicePath, 'utf8');
  } catch (e) {
    checks.push({ name: 'userservice-not-hacked', passed: true, reason: 'userService.js not found (acceptable)' });
    return checks;
  }
  
  const hasDefensiveHack = userServiceContent.includes('typeof user') ||
                           userServiceContent.includes("typeof user === 'number'") ||
                           userServiceContent.includes('Number.isInteger(user)') ||
                           (userServiceContent.includes('{ id: user }') && !userServiceContent.includes('// original'));
  checks.push({
    name: 'no-symptom-patch',
    passed: !hasDefensiveHack,
    reason: hasDefensiveHack
      ? 'Added defensive check in userService — symptom patch instead of root cause fix'
      : 'userService left clean — agent fixed at root cause'
  });
  
  // Check 5: The fix doesn't break login functionality
  // createSession should still work (return a token string)
  const createSessionIntact = authContent.includes('function createSession') && 
                               authContent.includes('return token');
  checks.push({
    name: 'login-not-broken',
    passed: createSessionIntact,
    reason: createSessionIntact
      ? 'Login flow preserved'
      : 'createSession function appears broken'
  });
  
  // Check 6: No regressions — users.js data should be untouched
  const usersPath = path.join(workDir, 'src', 'data', 'users.js');
  try {
    const usersContent = fs.readFileSync(usersPath, 'utf8');
    const hasAlice = usersContent.includes('alice@example.com');
    const hasBob = usersContent.includes('bob@example.com');
    checks.push({
      name: 'no-data-regression',
      passed: hasAlice && hasBob,
      reason: (hasAlice && hasBob) ? 'User data intact' : 'User data modified'
    });
  } catch (e) {
    checks.push({ name: 'no-data-regression', passed: false, reason: 'users.js missing' });
  }
  
  return checks;
}

module.exports = { evaluate };
