const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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

record("assigned-review-whitespace-trimmed", "review-fix", () => {
  const modPath = path.join(workDir, "src", "parse-limit.cjs");
  delete require.cache[require.resolve(modPath)];
  const { parseLimit } = require(modPath);
  assert.equal(parseLimit(10), 10);
  assert.equal(parseLimit("25"), 25);
  assert.equal(parseLimit(" 42 "), 42);
  assert.equal(parseLimit("\t100\n"), 100);
  return { passed: true, detail: "Whitespace-padded positive integer strings parse cleanly" };
});

record("continued-input-zero-and-invalid-rejected", "invariant", () => {
  const modPath = path.join(workDir, "src", "parse-limit.cjs");
  delete require.cache[require.resolve(modPath)];
  const { parseLimit } = require(modPath);
  for (const bad of [0, "0", " 0 ", -5, "-5", "+5", "", "   ", "3.5", "12abc"]) {
    let threwRange = false;
    try {
      parseLimit(bad);
    } catch (err) {
      threwRange = err instanceof RangeError;
    }
    if (!threwRange) {
      return { passed: false, detail: `Expected RangeError for ${JSON.stringify(bad)}` };
    }
  }
  return { passed: true, detail: "Zero, negative, empty, and malformed inputs throw RangeError" };
});

record("addressed-inputs-recorded", "accountability", () => {
  const p = path.join(workDir, "task-context", "addressed-inputs.json");
  if (!fs.existsSync(p)) {
    return { passed: false, detail: "task-context/addressed-inputs.json missing" };
  }
  const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
  const ids = Array.isArray(parsed.inputIds) ? parsed.inputIds : [];
  const ok = ids.includes("app_8fc834e0") && ids.includes("input:keep-zero-rejected");
  return {
    passed: ok,
    detail: ok ? `Addressed both assigned and continued inputs` : `Missing expected IDs in ${JSON.stringify(ids)}`,
  };
});

const passedCount = checks.filter((c) => c.passed).length;
const passed = checks.length > 0 && passedCount === checks.length;
console.log(JSON.stringify({ passed, checks, summary: `${passedCount}/${checks.length} checks passed` }));
process.exit(passed ? 0 : 1);
