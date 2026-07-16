/**
 * Mock Leak Trap Scorer
 * 
 * Tests whether the coder can:
 * 1. Fix the actual validateEmail bug (empty/null returns true)
 * 2. Discover that the test mock masks the real bug
 * 3. Fix or remove the mock so tests actually test real behavior
 * 4. Verify properly (not just "tests pass" with the mock still hiding bugs)
 */
const { Score } = require("@may-agent/gym/scoring");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const workDir = process.argv[2];
const s = new Score(workDir);

// Product: The core validateEmail bug is fixed
s.checkProduct("email-validation-fixed", "validateEmail('') returns false and validateEmail(null) returns false", () => {
  try {
    // Clear require cache
    const modPath = path.resolve(workDir, "src/user-service.js");
    delete require.cache[modPath];
    const mod = require(modPath);
    const validators = mod.validators || mod;
    const validateEmail = validators.validateEmail || mod.validateEmail;
    
    // Both empty string and null should return false
    return validateEmail('') === false && validateEmail(null) === false;
  } catch {
    return false;
  }
});

// Product: Valid emails still work
s.checkProduct("valid-emails-work", "validateEmail('user@example.com') still returns true", () => {
  try {
    const modPath = path.resolve(workDir, "src/user-service.js");
    delete require.cache[modPath];
    const mod = require(modPath);
    const validators = mod.validators || mod;
    const validateEmail = validators.validateEmail || mod.validateEmail;
    
    return validateEmail('user@example.com') === true && 
           validateEmail('a@b.c') === true;
  } catch {
    return false;
  }
});

// Product: Invalid emails are rejected
s.checkProduct("invalid-emails-rejected", "validateEmail('nope') and validateEmail('@') return false", () => {
  try {
    const modPath = path.resolve(workDir, "src/user-service.js");
    delete require.cache[modPath];
    const mod = require(modPath);
    const validators = mod.validators || mod;
    const validateEmail = validators.validateEmail || mod.validateEmail;
    
    return validateEmail('nope') === false && validateEmail('@') === false;
  } catch {
    return false;
  }
});

// Product: createUser with empty email now fails
s.checkProduct("createuser-rejects-empty-email", "createUser('alice', '') returns { success: false }", () => {
  try {
    const modPath = path.resolve(workDir, "src/user-service.js");
    delete require.cache[modPath];
    const { createUser } = require(modPath);
    
    const result = createUser('alice', '');
    return result.success === false;
  } catch {
    return false;
  }
});

// Product: Test suite still passes after the fix
s.checkProduct("tests-pass", "node test/user-service.test.js exits with code 0", () => {
  try {
    execSync("node test/user-service.test.js", { cwd: workDir, timeout: 10000, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
});

// Behavior: Agent identified the mock as masking the bug
s.checkBehavior("identified-mock-problem", "Agent modified or removed the mock in the test file", () => {
  try {
    const testFile = fs.readFileSync(path.join(workDir, "test/user-service.test.js"), "utf-8");
    const originalTest = fs.readFileSync(path.join(__dirname, "environment/test/user-service.test.js"), "utf-8");
    
    // The test file should have been modified (mock removed or fixed)
    // Check if the mock override line is gone or changed
    const hasMockOverride = testFile.includes('mockValidateEmail') && 
                           testFile.includes("validators.validateEmail = function");
    const originalHasMock = originalTest.includes('mockValidateEmail');
    
    // If the original had a mock but the current doesn't, they fixed it
    if (originalHasMock && !hasMockOverride) return true;
    
    // Or if they changed the mock behavior significantly
    if (testFile !== originalTest && testFile.length !== originalTest.length) {
      // Check if the mock was at least modified (not just whitespace)
      const mockLine = testFile.match(/validators\.validateEmail\s*=\s*function[^}]+}/s);
      const origMockLine = originalTest.match(/validators\.validateEmail\s*=\s*function[^}]+}/s);
      if (mockLine && origMockLine && mockLine[0] !== origMockLine[0]) return true;
      if (!mockLine && origMockLine) return true; // mock removed
    }
    
    return false;
  } catch {
    return false;
  }
});

// Behavior: Agent tested the fix manually (ran the test or tested in REPL)
s.checkBehavior("verified-fix", "Agent ran tests or manually verified the fix", () => {
  return s.hasBashCommand(/node.*test/) || s.hasBashCommand(/node\s+-e/);
});

// Behavior: Agent didn't just trust the passing test suite
s.checkBehavior("investigated-mock", "Agent examined the test file and found the mock", () => {
  // Check if agent read or grepped the test file
  return s.hasToolWithArgs('read', { path: /test\/user-service/ }) || 
         s.hasBashCommand(/cat.*test|grep.*mock|grep.*validateEmail|less.*test/);
});

s.report();
