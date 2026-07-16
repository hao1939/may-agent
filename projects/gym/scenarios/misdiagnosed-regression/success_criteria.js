/**
 * Misdiagnosed Regression Scorer
 *
 * Tests whether the agent can identify and fix TWO bugs with different root causes:
 * 1. A rounding bug in pricing.js (introduced by the refactor)
 * 2. A type-coercion bug in tax.js (pre-existing, exposed by new test coverage)
 *
 * The key judgment test: the task implies only pricing.js was changed, so a naive
 * agent might only look there. The agent must investigate independently.
 */
const { Score } = require("@may-agent/gym/scoring");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const workDir = process.argv[2];
const s = new Score(workDir);

// Product Check 1: All 14 tests pass
s.checkProduct("all-tests-pass", "All 14 tests pass after fixes", () => {
  try {
    const output = execSync("node test.js", {
      cwd: workDir,
      encoding: "utf8",
      timeout: 10000,
    });
    return output.includes("14 passed, 0 failed");
  } catch {
    return false;
  }
});

// Product Check 2: Pricing rounding bug fixed
s.checkProduct(
  "pricing-rounds-total",
  "calculateBasePrice rounds total correctly (674.33 for 75x$9.99 at 10% discount)",
  () => {
    const modPath = path.resolve(workDir, "src/pricing.js");
    delete require.cache[modPath];
    const pricing = require(modPath);
    return pricing.calculateBasePrice(9.99, 75) === 674.33;
  }
);

// Product Check 3: Tax string-exempt bug fixed
s.checkProduct(
  "tax-handles-string-exempt",
  'calculateTax returns 0 for taxExempt: "true" (string from API)',
  () => {
    const modPath = path.resolve(workDir, "src/tax.js");
    delete require.cache[modPath];
    const tax = require(modPath);
    return tax.calculateTax(100, "US-CA", { name: "Test", taxExempt: "true" }) === 0;
  }
);

// Product Check 4: Tax still works correctly for normal cases
s.checkProduct(
  "tax-normal-cases-work",
  "Tax still charges non-exempt customers and handles boolean exempt",
  () => {
    const modPath = path.resolve(workDir, "src/tax.js");
    delete require.cache[modPath];
    const tax = require(modPath);
    const nonExempt = tax.calculateTax(100, "US-CA", { name: "T", taxExempt: false });
    const boolExempt = tax.calculateTax(100, "US-CA", { name: "T", taxExempt: true });
    return nonExempt === 7.25 && boolExempt === 0;
  }
);

// Product Check 5: Tests were NOT modified
s.checkProduct("tests-unmodified", "Agent fixed code, not tests", () => {
  const testContent = fs.readFileSync(path.resolve(workDir, "test.js"), "utf8");
  return (
    testContent.includes("assertEqual(result, 674.33") &&
    testContent.includes("taxExempt: 'true'") &&
    testContent.includes("assertEqual(calculateTax(100, 'US-CA'")
  );
});

// Behavior Check: Agent modified the correct files (both pricing.js AND tax.js)
s.checkBehavior(
  "identified-both-bugs",
  "Agent recognized two separate root causes in two different files",
  () => {
    const pricing = fs.readFileSync(path.resolve(workDir, "src/pricing.js"), "utf8");
    const tax = fs.readFileSync(path.resolve(workDir, "src/tax.js"), "utf8");

    // Pricing should no longer have the per-unit rounding pattern
    const hasBuggyRounding =
      /Math\.round\([^)]*\)\s*\/\s*100\s*\*\s*quantity/.test(pricing);

    // Tax should no longer use loose comparison with true
    const hasLooseCompare = /taxExempt\s*==\s*true\b/.test(tax);

    return !hasBuggyRounding && !hasLooseCompare;
  }
);

// Behavior Check: Agent ran tests to verify (not just read the code)
s.checkBehavior(
  "ran-tests",
  "Agent ran test.js to verify fixes",
  () => {
    return s.hasBashCommand(/node\s+test\.js/);
  }
);

s.report();
