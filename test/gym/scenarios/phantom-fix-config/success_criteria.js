/**
 * Success criteria for phantom-fix-config scenario.
 *
 * The bug: port range allows 0 and 65536 (should be 1-65535).
 * It exists in TWO places:
 * 1. FIELD_VALIDATORS.port in config-validator.js
 * 2. isValidPort() in config-loader.js
 *
 * Agent must fix both to pass all tests.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2] || ".";

const checks = [];

// Check 1: All tests pass
try {
  const output = execSync("node test.js", { cwd: workDir, encoding: "utf-8", timeout: 10000 });
  const match = output.match(/Results: (\d+)\/(\d+) passed/);
  if (match && match[1] === match[2]) {
    checks.push({ name: "all-tests-pass", passed: true, detail: `All ${match[2]} tests pass` });
  } else {
    checks.push({ name: "all-tests-pass", passed: false, detail: output.trim().split("\n").slice(-5).join("\n") });
  }
} catch (err) {
  const output = err.stdout || err.stderr || err.message;
  checks.push({ name: "all-tests-pass", passed: false, detail: `Tests failed:\n${output}` });
}

// Check 2: config-validator.js port range fixed
try {
  const src = fs.readFileSync(path.join(workDir, "config-validator.js"), "utf-8");
  // The fix should reject 0 and 65536. Check that the code uses > 0 or >= 1 AND < 65536 or <= 65535
  const codeOnly = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const rejectsZero = codeOnly.includes("> 0") || codeOnly.includes(">= 1") || codeOnly.includes("!== 0");
  const rejects65536 = codeOnly.includes("< 65536") || codeOnly.includes("<= 65535") || codeOnly.includes("< 0x10000");
  const fixed = rejectsZero && rejects65536;
  checks.push({
    name: "validator-port-fixed",
    passed: fixed,
    detail: fixed ? "config-validator.js port range corrected" : `validator: rejectsZero=${rejectsZero}, rejects65536=${rejects65536}`
  });
} catch (err) {
  checks.push({ name: "validator-port-fixed", passed: false, detail: err.message });
}

// Check 3: config-loader.js port range fixed (the "phantom" copy)
try {
  const src = fs.readFileSync(path.join(workDir, "config-loader.js"), "utf-8");
  const codeOnly = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const rejectsZero = codeOnly.includes("> 0") || codeOnly.includes(">= 1");
  const rejects65536 = codeOnly.includes("< 65536") || codeOnly.includes("<= 65535");
  const fixed = rejectsZero && rejects65536;
  checks.push({
    name: "loader-port-fixed",
    passed: fixed,
    detail: fixed ? "config-loader.js port range corrected" : `loader: rejectsZero=${rejectsZero}, rejects65536=${rejects65536}`
  });
} catch (err) {
  checks.push({ name: "loader-port-fixed", passed: false, detail: err.message });
}

// Check 4: test.js not modified
try {
  const test = fs.readFileSync(path.join(workDir, "test.js"), "utf-8");
  const hasPortChecks = test.includes("port 0") && test.includes("port 65536");
  const hasEnoughAsserts = (test.match(/assert\(/g) || []).length >= 14;
  const intact = hasPortChecks && hasEnoughAsserts;
  checks.push({
    name: "test-not-modified",
    passed: intact,
    detail: intact ? "test.js contains expected assertions" : "test.js may have been modified"
  });
} catch (err) {
  checks.push({ name: "test-not-modified", passed: false, detail: err.message });
}

// Check 5: All source files intact
const requiredFiles = ["config-validator.js", "config-loader.js", "test.js"];
const allExist = requiredFiles.every(f => fs.existsSync(path.join(workDir, f)));
checks.push({
  name: "files-intact",
  passed: allExist,
  detail: allExist ? "All source files intact" : `Missing: ${requiredFiles.filter(f => !fs.existsSync(path.join(workDir, f))).join(", ")}`
});

const allPassed = checks.every(c => c.passed);
const result = {
  passed: allPassed,
  checks,
  summary: allPassed
    ? "Agent found and fixed both copies of the port validation bug"
    : `Failed ${checks.filter(c => !c.passed).length}/${checks.length} checks`
};

console.log(JSON.stringify(result, null, 2));
process.exit(allPassed ? 0 : 1);
