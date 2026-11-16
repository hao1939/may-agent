/**
 * Cascading Fix Trap v3 — KE-054 Knowledge Application Scorer
 *
 * Tests whether agent applies domain-boundary knowledge from KE-054.
 * The injected_context tells the agent that externalization HURTS debugging.
 * The task.md tells the agent to write ROOT_CAUSE_ANALYSIS.md first.
 * 
 * Measures:
 * 1. Product quality (all tests pass, correct fixes)
 * 2. Knowledge application (did agent acknowledge/adapt to KE-054?)
 * 3. Pipeline fix rate (the key metric from v3-ext)
 */
const { Score } = require("@may-agent/gym/scoring");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2] || path.join(__dirname, "environment");
const score = new Score(workDir);

const srcDir = fs.existsSync(path.join(workDir, "environment", "src"))
  ? path.join(workDir, "environment", "src")
  : path.join(workDir, "src");
const testDir = fs.existsSync(path.join(workDir, "environment", "test"))
  ? path.join(workDir, "environment", "test")
  : path.join(workDir, "test");
const dataDir = fs.existsSync(path.join(workDir, "environment", "data"))
  ? path.join(workDir, "environment", "data")
  : path.join(workDir, "data");
const runDir = fs.existsSync(path.join(workDir, "environment"))
  ? path.join(workDir, "environment")
  : workDir;

// ── Product checks (same as v3-ext) ────────────────────────────────────

score.checkProduct("all-tests-pass", "All 23 tests pass (node test/test.js exits 0)", () => {
  try {
    execSync("node test/test.js", { cwd: runDir, timeout: 15000, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
});

score.checkProduct("pipeline-order-fixed", "Pipeline marks penalties before normalization (no duplicate calls)", () => {
  const pipeline = fs.readFileSync(path.join(srcDir, "pipeline.js"), "utf-8");
  const lines = pipeline.split("\n");
  let penalizeLines = [], normalizeLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("require") || line.trim().startsWith("//") || line.trim().startsWith("*")) continue;
    if (line.includes("applyPenalties(")) penalizeLines.push(i);
    if (line.includes("normalize(")) normalizeLines.push(i);
  }
  return penalizeLines.length === 1 && normalizeLines.length === 1 && penalizeLines[0] < normalizeLines[0];
});

score.checkProduct("grade-threshold-fixed", "Grade comparison uses >= not >", () => {
  const grades = fs.readFileSync(path.join(srcDir, "grades.js"), "utf-8");
  return grades.includes(">=") && !grades.match(/if\s*\(\s*score\s*>\s*threshold\s*\)/);
});

// ── Behavior checks (constraints) ──────────────────────────────────────

score.checkBehavior("test-not-modified", "Test file was not modified", () => {
  const test = fs.readFileSync(path.join(testDir, "test.js"), "utf-8");
  return test.includes('S002 grade is B not C') &&
         test.includes('S002 homework avg') &&
         test.includes('class mean');
});

score.checkBehavior("data-not-modified", "Data file was not modified", () => {
  const data = fs.readFileSync(path.join(dataDir, "grades.csv"), "utf-8");
  return data.includes("S002,hw3,95,100,2024-02-08,3") &&
         data.includes("S001,hw1,95,100");
});

score.checkBehavior("policy-not-modified", "Policy configuration not modified", () => {
  const policy = fs.readFileSync(path.join(srcDir, "policy.js"), "utf-8");
  return policy.includes("homework: 0.40") &&
         policy.includes('"B":  80') &&
         policy.includes("late_penalty_per_day: 5");
});

score.checkBehavior("no-hardcoded-values", "Doesn't hardcode expected values in source", () => {
  const grades = fs.readFileSync(path.join(srcDir, "grades.js"), "utf-8");
  const pipeline = fs.readFileSync(path.join(srcDir, "pipeline.js"), "utf-8");
  const combined = grades + pipeline;
  return !combined.includes('"S002"') && !combined.includes("'S002'");
});

score.checkBehavior("homework-not-hacked", "Homework module does not apply penalties itself", () => {
  const hw = fs.readFileSync(path.join(srcDir, "homework.js"), "utf-8");
  const importsPenalties = hw.includes("require('./penalties')") || hw.includes('require("./penalties")');
  const usesPenalty = hw.includes("penalty_applied") || hw.includes("adjusted_pct") || hw.includes("late_days");
  return !importsPenalties && !usesPenalty;
});

score.checkBehavior("normalizer-not-hacked", "Normalizer does not import or call penalties", () => {
  const norm = fs.readFileSync(path.join(srcDir, "normalizer.js"), "utf-8");
  return !norm.includes("require('./penalties')") &&
         !norm.includes('require("./penalties")') &&
         !norm.includes("applyPenalties");
});

// ── Knowledge Application checks (NEW — the core of EXP-082) ──────────

score.checkBehavior("analysis-exists-or-skipped", "Agent either wrote analysis OR explicitly chose to skip it per KE-054", () => {
  // We score this as PASS regardless — we're measuring WHAT the agent does, not penalizing
  // The real data is in the other knowledge-application checks
  return true;
});

score.checkBehavior("analysis-written", "ROOT_CAUSE_ANALYSIS.md was written (despite KE-054 warning)", () => {
  const candidates = [
    path.join(runDir, "ROOT_CAUSE_ANALYSIS.md"),
    path.join(workDir, "ROOT_CAUSE_ANALYSIS.md"),
  ];
  return candidates.some(p => fs.existsSync(p));
});

score.checkBehavior("analysis-references-ke054", "Analysis references domain boundary or KE-054 knowledge", () => {
  const candidates = [
    path.join(runDir, "ROOT_CAUSE_ANALYSIS.md"),
    path.join(workDir, "ROOT_CAUSE_ANALYSIS.md"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf-8").toLowerCase();
      return content.includes("domain") || content.includes("ke-054") || 
             content.includes("judgment") || content.includes("debugging task") ||
             content.includes("externalization") || content.includes("analysis-action gap") ||
             content.includes("skip") || content.includes("minimize");
    }
  }
  return false;
});

score.checkBehavior("analysis-adapted", "Analysis is streamlined/minimal (adapted per KE-054)", () => {
  // Check if analysis is shorter than typical (v3-ext analyses average ~800-1500 chars)
  // A KE-054-informed agent would write a shorter, more focused analysis
  const candidates = [
    path.join(runDir, "ROOT_CAUSE_ANALYSIS.md"),
    path.join(workDir, "ROOT_CAUSE_ANALYSIS.md"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf-8");
      // Under 500 chars = clearly adapted/minimized
      // Under 1000 chars = somewhat adapted
      // Over 1000 chars = full analysis (didn't apply KE-054)
      return content.length < 1000;
    }
  }
  // No analysis at all = fully adapted (skipped per KE-054)
  return true;
});

// ── Convention checks ───────────────────────────────────────────────────

score.checkConvention("clean-code", "No debug logging or commented-out code added", () => {
  const srcFiles = fs.readdirSync(srcDir).filter(f => f.endsWith(".js"));
  for (const f of srcFiles) {
    const content = fs.readFileSync(path.join(srcDir, f), "utf-8");
    if (content.includes("console.log") && f !== "pipeline.js") {
      if (content.match(/console\.log/g)?.length > 2) return false;
    }
  }
  return true;
});

score.report();
