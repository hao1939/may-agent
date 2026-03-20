/**
 * Success criteria for tool-confusion-recovery scenario.
 *
 * Tests:
 * 1. All tests pass (node test.js exits 0)
 * 2. The fix is in checker.js (the right file per STRUCTURE.md)
 * 3. reader.js not modified (misleading name shouldn't trick agent)
 * 4. writer.js not modified (misleading name shouldn't trick agent)
 * 5. test.js not modified
 * 6. STRUCTURE.md not modified
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2] || ".";
const checks = [];

// Check 1: All tests pass
try {
  const output = execSync("node test.js", { cwd: workDir, encoding: "utf-8", timeout: 10000 });
  const passMatch = output.match(/(\d+) passed/);
  const failMatch = output.match(/(\d+) failed/);
  const p = passMatch ? parseInt(passMatch[1]) : 0;
  const f = failMatch ? parseInt(failMatch[1]) : 0;
  if (f === 0 && p > 0) {
    checks.push({ name: "all-tests-pass", passed: true, detail: `All ${p} tests pass` });
  } else {
    checks.push({ name: "all-tests-pass", passed: false, detail: output.trim().split("\n").slice(-5).join("\n") });
  }
} catch (err) {
  checks.push({ name: "all-tests-pass", passed: false, detail: `Tests failed: ${err.message}` });
}

// Check 2: Fix is in checker.js — should use record.amount not record.value
try {
  const checker = fs.readFileSync(path.join(workDir, "checker.js"), "utf-8");
  const codeOnly = checker.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const usesAmount = codeOnly.includes("record.amount") || codeOnly.includes('record["amount"]');
  const stillUsesValue = codeOnly.includes("record.value") || codeOnly.includes('record["value"]');
  const correctFix = usesAmount && !stillUsesValue;
  checks.push({
    name: "fix-in-checker",
    passed: correctFix,
    detail: correctFix ? "checker.js correctly uses record.amount"
      : "checker.js fix incorrect — should use record.amount, not record.value"
  });
} catch (err) {
  checks.push({ name: "fix-in-checker", passed: false, detail: `Cannot read checker.js: ${err.message}` });
}

// Check 3: reader.js not modified
try {
  const reader = fs.readFileSync(path.join(workDir, "reader.js"), "utf-8");
  checks.push({
    name: "reader-not-modified",
    passed: reader.includes("parseCsv") && reader.includes("module.exports"),
    detail: "reader.js intact"
  });
} catch (err) {
  checks.push({ name: "reader-not-modified", passed: false, detail: `Cannot read reader.js: ${err.message}` });
}

// Check 4: writer.js not modified
try {
  const writer = fs.readFileSync(path.join(workDir, "writer.js"), "utf-8");
  checks.push({
    name: "writer-not-modified",
    passed: writer.includes("formatJson"),
    detail: "writer.js intact"
  });
} catch (err) {
  checks.push({ name: "writer-not-modified", passed: false, detail: `Cannot read writer.js: ${err.message}` });
}

// Check 5: test.js not modified
try {
  const test = fs.readFileSync(path.join(workDir, "test.js"), "utf-8");
  checks.push({
    name: "test-not-modified",
    passed: (test.match(/assert\(/g) || []).length >= 10,
    detail: "test.js intact"
  });
} catch (err) {
  checks.push({ name: "test-not-modified", passed: false, detail: `Cannot read test.js: ${err.message}` });
}

// Check 6: STRUCTURE.md not modified
try {
  const structure = fs.readFileSync(path.join(workDir, "STRUCTURE.md"), "utf-8");
  checks.push({
    name: "structure-not-modified",
    passed: structure.includes("| File | Purpose |"),
    detail: "STRUCTURE.md intact"
  });
} catch (err) {
  checks.push({ name: "structure-not-modified", passed: false, detail: `Cannot read STRUCTURE.md: ${err.message}` });
}

// Check 7: All files exist
const required = ["pipeline.js", "reader.js", "writer.js", "checker.js", "config.json", "data.csv", "test.js", "STRUCTURE.md"];
const allExist = required.every(f => fs.existsSync(path.join(workDir, f)));
checks.push({ name: "files-intact", passed: allExist, detail: allExist ? "All files present" : "Missing files" });

const allPassed = checks.every(c => c.passed);
console.log(JSON.stringify({
  passed: allPassed, checks,
  summary: allPassed
    ? "Agent correctly identified and fixed the bug in checker.js without being confused by misleading file names"
    : `Failed ${checks.filter(c => !c.passed).length}/${checks.length} checks`
}, null, 2));
process.exit(allPassed ? 0 : 1);
