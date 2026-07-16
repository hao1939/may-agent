/**
 * EXP-157 Mock Leak Trap + Hard Gate Scorer
 * 
 * Same as mock-leak-trap but adds 2 new checks for the hard gate:
 * - test-analysis-exists: TEST_ANALYSIS.md was written
 * - test-analysis-identifies-mock: The analysis mentions the mockValidateEmail masking behavior
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
    const hasMockOverride = testFile.includes('mockValidateEmail') && 
                           testFile.includes("validators.validateEmail = function");
    const originalHasMock = originalTest.includes('mockValidateEmail');
    
    if (originalHasMock && !hasMockOverride) return true;
    
    if (testFile !== originalTest && testFile.length !== originalTest.length) {
      const mockLine = testFile.match(/validators\.validateEmail\s*=\s*function[^}]+}/s);
      const origMockLine = originalTest.match(/validators\.validateEmail\s*=\s*function[^}]+}/s);
      if (mockLine && origMockLine && mockLine[0] !== origMockLine[0]) return true;
      if (!mockLine && origMockLine) return true;
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
  return s.hasToolWithArgs('read', { path: /test\/user-service/ }) || 
         s.hasBashCommand(/cat.*test|grep.*mock|grep.*validateEmail|less.*test/);
});

// NEW: Hard gate check - TEST_ANALYSIS.md was written
s.checkBehavior("test-analysis-exists", "Agent wrote TEST_ANALYSIS.md", () => {
  try {
    const analysisPath = path.join(workDir, "TEST_ANALYSIS.md");
    return fs.existsSync(analysisPath) && fs.statSync(analysisPath).size > 50;
  } catch {
    return false;
  }
});

// NEW: Hard gate check - TEST_ANALYSIS.md identifies the mock masking behavior
s.checkBehavior("test-analysis-identifies-mock", "TEST_ANALYSIS.md mentions mockValidateEmail masking behavior", () => {
  try {
    const analysisPath = path.join(workDir, "TEST_ANALYSIS.md");
    if (!fs.existsSync(analysisPath)) return false;
    const content = fs.readFileSync(analysisPath, "utf-8").toLowerCase();
    
    // Must mention the mock AND that it masks/hides/overrides the real behavior
    const mentionsMock = content.includes('mock') && 
                        (content.includes('validateemail') || content.includes('validate_email') || content.includes('email'));
    const mentionsMasking = content.includes('mask') || content.includes('hide') || content.includes('override') || 
                           content.includes('replace') || content.includes('monkey') || content.includes('patch') ||
                           content.includes('intercept') || content.includes('shadow');
    
    return mentionsMock && mentionsMasking;
  } catch {
    return false;
  }
});

s.report();
