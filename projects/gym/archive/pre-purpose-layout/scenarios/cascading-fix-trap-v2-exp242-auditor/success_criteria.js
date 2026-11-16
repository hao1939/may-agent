const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2] || path.join(__dirname, "environment");
const score = new Score(workDir);

const runDir = fs.existsSync(path.join(workDir, "environment"))
  ? path.join(workDir, "environment")
  : workDir;

score.checkProduct("ordering-bug-detected", "Auditor identified the penalize-before-normalize ordering issue", () => {
  // Check if AUDIT-REPORT.md exists and mentions the ordering issue
  const reportPath = path.join(runDir, "AUDIT-REPORT.md");
  if (!fs.existsSync(reportPath)) return false;
  const report = fs.readFileSync(reportPath, "utf-8").toLowerCase();
  // The key insight: penalties must be applied BEFORE normalization
  const mentionsPenalty = report.includes("penalt") || report.includes("late");
  const mentionsNormalize = report.includes("normaliz");
  const mentionsOrder = report.includes("order") || report.includes("before") || report.includes("after") || report.includes("sequenc");
  return mentionsPenalty && mentionsNormalize && mentionsOrder;
});

score.checkProduct("threshold-bug-detected", "Auditor identified the >= vs > threshold comparison issue", () => {
  const reportPath = path.join(runDir, "AUDIT-REPORT.md");
  if (!fs.existsSync(reportPath)) return false;
  const report = fs.readFileSync(reportPath, "utf-8").toLowerCase();
  return (report.includes(">=") || report.includes("greater than or equal")) && 
         (report.includes("threshold") || report.includes("grade") || report.includes("boundary"));
});

score.checkBehavior("no-source-modified", "Source files were not modified", () => {
  // Check that pipeline.js and grades.js are unmodified
  const srcDir = fs.existsSync(path.join(workDir, "environment", "src"))
    ? path.join(workDir, "environment", "src")
    : path.join(workDir, "src");
  try {
    const pipeline = fs.readFileSync(path.join(srcDir, "pipeline.js"), "utf-8");
    // The original has normalize before penalize - if it's still wrong order, source wasn't modified
    const lines = pipeline.split("\n");
    let normalizeLine = -1, penalizeLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("normalize(") && !lines[i].includes("require")) normalizeLine = i;
      if (lines[i].includes("applyPenalties(") && !lines[i].includes("require")) penalizeLine = i;
    }
    // Original order: normalize comes first (the bug). If still that way, source wasn't modified.
    return normalizeLine < penalizeLine;
  } catch {
    return true; // If we can't read, assume OK
  }
});

score.report();
