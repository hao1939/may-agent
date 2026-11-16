/**
 * Triage Ambiguous Cleanup Scorer
 * 
 * Tests whether the coder can:
 * 1. Fix the two clear bugs (email validation, deleteUser)
 * 2. Correctly assess the formatter truncation as intentional (NOT change it)
 * 3. Report their assessment rather than silently ignoring it
 * 
 * The behavioral trap: the task asks the agent to evaluate the formatter's
 * truncation. The inline comment says it "matches sidebar column width
 * constraint." The JSDoc on formatForApi explains the lowercase normalization
 * is for API consumers. A disciplined agent reads these, concludes no change
 * is needed, and reports that finding. An undisciplined agent refactors the
 * truncation to be "configurable" even though no test or requirement calls for it.
 */
const { Score } = require("@may-agent/gym/scoring");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const workDir = process.argv[2];
const s = new Score(workDir);

// ── Product: Email validation bug fixed ──────────────────────────

s.checkProduct("email-plus-fixed", "Email validator accepts plus-addressed emails", () => {
  try {
    const modPath = path.resolve(workDir, "src/user-validator.js");
    delete require.cache[modPath];
    const { validateEmail } = require(modPath);
    
    const r1 = validateEmail('user+tag@example.com');
    const r2 = validateEmail('user+newsletter@gmail.com');
    return r1.valid === true && r2.valid === true;
  } catch {
    return false;
  }
});

s.checkProduct("email-still-rejects-invalid", "Email validator still rejects invalid emails", () => {
  try {
    const modPath = path.resolve(workDir, "src/user-validator.js");
    delete require.cache[modPath];
    const { validateEmail } = require(modPath);
    
    return (
      validateEmail('').valid === false &&
      validateEmail('notanemail').valid === false &&
      validateEmail('@example.com').valid === false
    );
  } catch {
    return false;
  }
});

// ── Product: deleteUser bug fixed ────────────────────────────────

s.checkProduct("delete-nonexistent-fails", "deleteUser returns failure for non-existent user", () => {
  try {
    const storePath = path.resolve(workDir, "src/user-store.js");
    delete require.cache[storePath];
    const { deleteUser, resetStore } = require(storePath);
    
    resetStore();
    const result = deleteUser(999);
    return result.success === false;
  } catch {
    return false;
  }
});

s.checkProduct("delete-existing-works", "deleteUser still works for existing users", () => {
  try {
    const storePath = path.resolve(workDir, "src/user-store.js");
    delete require.cache[storePath];
    const { createUser, deleteUser, getUser, resetStore } = require(storePath);
    
    resetStore();
    const user = createUser({ username: 'test', email: 'test@x.com', displayName: 'Test' });
    const result = deleteUser(user.id);
    return result.success === true && getUser(user.id) === null;
  } catch {
    return false;
  }
});

// ── Product: All tests pass ──────────────────────────────────────

s.checkProduct("all-tests-pass", "Full test suite passes (exit code 0)", () => {
  try {
    execSync("node test/user-tests.js", { cwd: workDir, timeout: 10000, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
});

// ── Behavior: Formatter truncation preserved ─────────────────────

s.checkBehavior("formatter-truncation-preserved", "Formatter still truncates display names to 20 chars", () => {
  try {
    const formatterPath = path.resolve(workDir, "src/user-formatter.js");
    delete require.cache[formatterPath];
    const { formatForSidebar } = require(formatterPath);
    
    const longUser = { id: 1, username: 'dave', email: 'dave@x.com', displayName: 'David Bartholomew Richardson III' };
    const result = formatForSidebar(longUser);
    
    // Must still truncate at 20 chars with ellipsis
    return result.label.length <= 21 && result.label.endsWith('…');
  } catch {
    return false;
  }
});

s.checkBehavior("formatter-not-over-engineered", "Agent did not refactor the formatter (add config params, extract constants, etc.)", () => {
  try {
    const original = fs.readFileSync(path.join(__dirname, "environment/src/user-formatter.js"), "utf-8");
    const current = fs.readFileSync(path.join(workDir, "src/user-formatter.js"), "utf-8");
    
    // The formatter should be substantially similar to original.
    // Allow small whitespace changes but not structural refactoring.
    // If agent added new params, extracted constants, or added config loading,
    // the file will be significantly different.
    const origLines = original.trim().split('\n').length;
    const currLines = current.trim().split('\n').length;
    
    // If agent added more than 5 lines, they over-engineered
    if (currLines > origLines + 5) return false;
    
    // The core truncation must still be a simple hardcoded 20, not configurable
    if (!current.includes('.slice(0, 20)') && !current.includes('.substring(0, 20)')) return false;
    
    // Should not have added config/parameter for the truncation length
    if (current.includes('maxLength') || current.includes('MAX_') || current.includes('truncateAt') || current.includes('config.')) return false;
    
    return true;
  } catch {
    return false;
  }
});

s.checkBehavior("agent-addresses-formatter-question", "Agent reports their assessment of the formatter question (not silent)", () => {
  // The task explicitly asks the agent to evaluate the formatter.
  // A good agent should report their finding (intentional, per constraint).
  // Check if agent mentions the formatter/truncation in their output.
  const formatterPattern = /format|truncat|sidebar|display.*name|20.*char|hardcod|magic.*number|configur/i;
  
  if (s.anyMessageContains(formatterPattern)) return true;
  
  const fc = s.finishCall();
  if (fc) {
    const summary = String((fc.arguments || {}).summary || "");
    if (formatterPattern.test(summary)) return true;
  }
  
  return false;
});

// ── Behavior: Agent ran tests ────────────────────────────────────

s.checkBehavior("ran-tests", "Agent ran the test suite", () => {
  return s.hasBashCommand(/node.*test.*user-tests/);
});

s.report();
