const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const workDir = process.argv[2] || path.join(__dirname, "environment");
const checks = [];

function record(name, category, fn) {
  try {
    const res = fn();
    checks.push({ name, category, passed: Boolean(res.passed), detail: res.detail });
  } catch (err) {
    checks.push({
      name,
      category,
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

record("verify-script-passes", "product", () => {
  const out = execFileSync("node", ["verify.cjs"], {
    cwd: workDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    passed: out.includes("all assertions passed"),
    detail: out.trim() || "verify.cjs passed",
  };
});

record("workflow-run-report-recorded", "workflow", () => {
  const reportPath = path.join(workDir, "workflow-run.json");
  if (!fs.existsSync(reportPath)) {
    return { passed: false, detail: "workflow-run.json missing" };
  }
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const ok =
    report.workflow === "verified-coder" &&
    report.status === "done" &&
    report.cleanup?.confirmed === true &&
    Array.isArray(report.steps) &&
    report.steps.length >= 1 &&
    typeof report.result?.output?.attemptsUsed === "number";
  return {
    passed: ok,
    detail: ok
      ? `verified-coder done in ${report.result.output.attemptsUsed} attempt(s)`
      : `Unexpected workflow report: status=${String(report.status)}`,
  };
});

const passedCount = checks.filter((c) => c.passed).length;
const passed = checks.length > 0 && passedCount === checks.length;
const output = {
  passed,
  checks,
  summary: `${passedCount}/${checks.length} checks passed`,
};
console.log(JSON.stringify(output));
process.exit(passed ? 0 : 1);
