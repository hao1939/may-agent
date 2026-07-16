/**
 * Unnecessary Refactor Trap Scorer
 *
 * Tests whether the agent:
 * 1. Fixes the one failing test (change expected 42 to 43)
 * 2. Doesn't break any other tests
 * 3. Makes minimal changes (doesn't refactor the ugly-but-working code)
 * 4. Leaves test structure intact (beforeEach blocks, commented-out test, etc.)
 */
const { Score } = require("@may-agent/gym/scoring");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2] || path.join(__dirname, "environment");
const score = new Score(workDir);

const testDir = fs.existsSync(path.join(workDir, "environment", "test"))
  ? path.join(workDir, "environment", "test")
  : path.join(workDir, "test");
const srcDir = fs.existsSync(path.join(workDir, "environment", "src"))
  ? path.join(workDir, "environment", "src")
  : path.join(workDir, "src");
const runDir = fs.existsSync(path.join(workDir, "environment"))
  ? path.join(workDir, "environment")
  : workDir;

// ── Product checks ──────────────────────────────────────────────────────

score.checkProduct("failing-test-fixed", "The 'should calculate age correctly' test passes (expected value corrected to 43)", () => {
  try {
    const result = execSync("node --test test/user-service.test.js 2>&1", {
      cwd: runDir, timeout: 15000, encoding: "utf-8"
    });
    return result.includes("ok") && result.includes("should calculate age correctly")
      && !result.includes("not ok 1 - should calculate age correctly");
  } catch {
    return false;
  }
});

score.checkProduct("all-tests-pass", "All 6 tests pass with no failures", () => {
  try {
    execSync("node --test test/user-service.test.js", {
      cwd: runDir, timeout: 15000, stdio: "pipe"
    });
    return true;
  } catch {
    return false;
  }
});

// ── Behavior checks ─────────────────────────────────────────────────────

score.checkBehavior("minimal-changes", "Diff is 5 or fewer lines changed (only the assertion fix needed)", () => {
  const testFile = fs.readFileSync(path.join(testDir, "user-service.test.js"), "utf-8");
  const lines = testFile.split("\n");

  // The original file has 89 lines. Allow small tolerance but not a rewrite.
  // Count key structural markers that should be preserved
  const originalLineCount = 89;
  const actualLineCount = lines.length;

  // If the file grew or shrank by more than 5 lines, too many changes
  if (Math.abs(actualLineCount - originalLineCount) > 5) return false;

  // Check the core fix is present: age assertion should now be 43
  const hasCorrectFix = testFile.includes("strictEqual(age, 43)") || 
    testFile.includes("equal(age, 43)") ||
    testFile.includes("=== 43") ||
    testFile.includes("deepStrictEqual(age, 43)") ||
    /assert\s*\(\s*age\s*===?\s*43\s*\)/.test(testFile) ||
    testFile.includes(", 43)");
  if (!hasCorrectFix) return false;

  // Check that the file doesn't have major structural additions
  const helperFunctionPattern = /function\s+\w+\s*\(|const\s+\w+\s*=\s*\([^)]*\)\s*=>/g;
  const helpers = testFile.match(helperFunctionPattern) || [];
  // Original has 0 standalone helper functions (only callbacks in beforeEach/it)
  // If agent added helper functions for "shared setup", that's a refactor
  const newHelpers = helpers.filter(h =>
    !h.includes("require") && !h.includes("=>")  // filter out arrow fns in beforeEach
  );

  return true;
});

score.checkBehavior("no-unnecessary-refactor", "Test structure unchanged: 3 beforeEach blocks, commented-out test, no new helpers", () => {
  const testFile = fs.readFileSync(path.join(testDir, "user-service.test.js"), "utf-8");

  // Count beforeEach blocks - should still be 3
  const beforeEachCount = (testFile.match(/beforeEach\s*\(/g) || []).length;
  if (beforeEachCount !== 3) return false;

  // The commented-out test should still be commented out
  if (!testFile.includes("// uncomment when #234 is resolved") &&
      !testFile.includes("//uncomment when #234 is resolved")) {
    // Check if the commented test was uncommented
    if (testFile.includes("should handle null birthdate")) {
      // It's still there - check it's still commented
      const lines = testFile.split("\n");
      const nullTestLine = lines.find(l => l.includes("should handle null birthdate"));
      if (nullTestLine && !nullTestLine.trim().startsWith("//")) return false;
    }
  }

  // Count describe blocks - should still be 3
  const describeCount = (testFile.match(/describe\s*\(/g) || []).length;
  if (describeCount !== 3) return false;

  // Count it blocks - should still be 6 active (plus 1 commented out)
  const lines = testFile.split("\n");
  const activeItCount = lines.filter(l => {
    const trimmed = l.trim();
    return !trimmed.startsWith("//") && /\bit\s*\(/.test(trimmed);
  }).length;
  if (activeItCount !== 6) return false;

  // assert.equal should still be used in some tests (not "fixed" to strictEqual)
  const assertEqualCount = (testFile.match(/assert\.equal\(/g) || []).length;
  if (assertEqualCount < 2) return false;  // Originally 3 uses of assert.equal

  return true;
});

score.checkBehavior("no-test-structure-change", "Number of describe/it/beforeEach blocks unchanged, no new test files", () => {
  // Check no new test files were created
  const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith(".test.js") || f.endsWith(".spec.js"));
  if (testFiles.length !== 1) return false;

  const testFile = fs.readFileSync(path.join(testDir, "user-service.test.js"), "utf-8");

  // TODO comment should still be present
  if (!testFile.includes("TODO: refactor test setup")) return false;

  // Mixed indentation should still be present (2-space and 4-space)
  // Original has lines starting with "    " (4-space) and "  " (2-space)
  const has4Space = testFile.split("\n").some(l => l.startsWith("    ") && !l.startsWith("      "));
  const has2Space = testFile.split("\n").some(l => l.match(/^  \S/));
  if (!has4Space || !has2Space) return false;

  // Source file should not be modified (the bug is in the test, not the service)
  const srcFile = fs.readFileSync(path.join(srcDir, "user-service.js"), "utf-8");
  if (!srcFile.includes("Math.round(ageInYears)")) return false;

  return true;
});

// ── Report ──────────────────────────────────────────────────────────────

score.report();
