#!/usr/bin/env bash
# EXP-242 Phase 0: Auditor-Only Detection Test
# Run a structural auditor agent against cascading-fix-trap-v2 to see
# if reframing the task as "find ordering bugs" enables detection.
#
# This is Arm D: auditor-only, measuring detection rate.
# We run 5 trials first to gauge signal before committing to 15.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GYM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SCENARIO_DIR="$GYM_DIR/scenarios/cascading-fix-trap-v2-exp242-auditor"

# Create the auditor variant scenario
mkdir -p "$SCENARIO_DIR/environment"

# Copy the original environment
cp -r "$GYM_DIR/scenarios/cascading-fix-trap-v2/environment/"* "$SCENARIO_DIR/environment/"

# Create auditor-specific task
cat > "$SCENARIO_DIR/task.md" << 'TASK'
You are a **Structural Auditor**. Your ONLY job is finding ordering/sequencing bugs in code.

This is a student grade processing pipeline. It reads CSV data, applies late penalties, computes averages (dropping lowest), calculates weighted grades, and generates reports.

Some tests are failing: `node test/test.js`

Your task is NOT to fix bugs. Your task is to **audit the pipeline for ordering/sequencing errors**:

1. Read the pipeline code and trace the order of operations
2. For each processing step, verify it happens in the correct sequence
3. Specifically check: Are penalties applied BEFORE or AFTER normalization? Which should come first?
4. Report any ordering mismatches you find

Write your findings to `AUDIT-REPORT.md` with:
- Each ordering issue found
- The file and line numbers involved
- What the correct order should be
- Why the current order is wrong

Important: Do NOT modify any source files. Only create AUDIT-REPORT.md.
TASK

# Copy scenario.json with modified description
cat > "$SCENARIO_DIR/scenario.json" << 'JSON'
{
  "name": "cascading-fix-trap-v2-exp242-auditor",
  "description": "EXP-242 Arm D: Structural auditor detecting ordering bugs without fixing them",
  "difficulty": "hard",
  "time_limit": 300
}
JSON

# Scoring: check if the auditor detected the ordering bug
cat > "$SCENARIO_DIR/success_criteria.js" << 'SCORER'
const { Score } = require("../../lib/gym-score-utils.cjs");
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
SCORER

echo "Scenario created at: $SCENARIO_DIR"
echo ""
echo "Running 5 auditor-only trials..."

RESULTS_FILE="$SCRIPT_DIR/exp242-phase0-results.jsonl"
> "$RESULTS_FILE"

for i in $(seq 1 5); do
  echo "=== Trial $i/5 ==="
  
  # Run the gym
  RESULT=$(bash "$GYM_DIR/../test/gym/run-gym.sh" cascading-fix-trap-v2-exp242-auditor --agent tech-lead --timeout 5 2>&1 || true)
  
  echo "$RESULT" | tail -5
  
  # Extract JSON result
  JSON_LINE=$(echo "$RESULT" | grep -o '{.*}' | tail -1 || echo '{"error": "no json"}')
  echo "{\"trial\": $i, \"result\": $JSON_LINE}" >> "$RESULTS_FILE"
  
  echo ""
done

echo "=== Results ==="
cat "$RESULTS_FILE"
echo ""
echo "Detection rate:"
DETECTED=$(grep -c '"ordering-bug-detected.*pass' "$RESULTS_FILE" 2>/dev/null || echo 0)
echo "Ordering bug detected: $DETECTED / 5"
