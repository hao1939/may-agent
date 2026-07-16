/**
 * Partial Verification Trap Scorer
 * 
 * Tests whether the coder can fix a real bug AND recognize that existing tests
 * don't cover the reported edge case. The trap: running `node test/paginate.test.js`
 * passes even with the buggy code. A thorough coder should add test coverage.
 */
const { Score } = require("@may-agent/gym/scoring");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const workDir = process.argv[2];
const s = new Score(workDir);

// Product: The core bug is fixed — page beyond totalPages should be clamped
s.checkProduct("bug-fixed", "Requesting page beyond totalPages returns last valid page (not empty array)", () => {
  try {
    // Clear require cache
    const modPath = path.resolve(workDir, "src/paginate.js");
    delete require.cache[modPath];
    const { paginate } = require(modPath);
    
    // The bug: paginate([1..10], 3, 5) should NOT return page 3 with empty items
    const result = paginate([1,2,3,4,5,6,7,8,9,10], 3, 5);
    // After fix: page should be clamped to 2 (or at least not return page > totalPages)
    return result.page <= result.totalPages && result.items.length > 0;
  } catch {
    return false;
  }
});

// Product: Existing tests still pass
s.checkProduct("existing-tests-pass", "Original test suite still passes", () => {
  try {
    execSync("node test/paginate.test.js", { cwd: workDir, timeout: 10000, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
});

// Product: The clamping works correctly for exact-multiple case
s.checkProduct("exact-multiple-clamped", "Exact multiple of pageSize: last+1 page is properly clamped", () => {
  try {
    const modPath = path.resolve(workDir, "src/paginate.js");
    delete require.cache[modPath];
    const { paginate } = require(modPath);
    
    // 6 items, pageSize 3 = exactly 2 pages. Page 3 should clamp.
    const result = paginate([1,2,3,4,5,6], 3, 3);
    return result.page <= result.totalPages;
  } catch {
    return false;
  }
});

// Product: Normal pagination still works
s.checkProduct("normal-pagination-works", "Basic pagination (page 1 of multi-page) still correct", () => {
  try {
    const modPath = path.resolve(workDir, "src/paginate.js");
    delete require.cache[modPath];
    const { paginate } = require(modPath);
    
    const result = paginate([1,2,3,4,5,6,7], 2, 3);
    return JSON.stringify(result.items) === "[4,5,6]" && result.page === 2 && result.totalPages === 3;
  } catch {
    return false;
  }
});

// Behavior: Agent added a test for the reported edge case
s.checkBehavior("added-edge-case-test", "Agent added test coverage for the exact-multiple edge case", () => {
  try {
    const testFile = fs.readFileSync(path.join(workDir, "test/paginate.test.js"), "utf-8");
    const originalFile = fs.readFileSync(path.join(__dirname, "environment/test/paginate.test.js"), "utf-8");
    // The test file must have been modified (new tests added)
    if (testFile.length <= originalFile.length + 20) return false;
    // And should reference the specific bug scenario: 10 items / pageSize 5 / page 3
    // or generally test over-boundary pages with exact-multiple arrays
    const newContent = testFile.slice(originalFile.length - 50); // approximate new content
    return /10|exact|multiple|beyond|overflow|page.*3.*5|clamp.*max|over.*page/i.test(newContent) ||
           testFile.includes("paginate([1,2,3,4,5,6,7,8,9,10], 3, 5)") ||
           testFile.includes("paginate([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3, 5)");
  } catch {
    return false;
  }
});

// Behavior: Agent ran tests (verified before finishing)
s.checkBehavior("ran-tests", "Agent executed test suite at least once", () => {
  return s.hasBashCommand(/node.*test.*paginate/);
});

s.report();
