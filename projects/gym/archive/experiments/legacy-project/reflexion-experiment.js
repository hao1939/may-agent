#!/usr/bin/env node
/**
 * Reflexion Experiment Runner
 * 
 * Runs baseline vs treatment gym scenarios to measure the impact of
 * lesson injection on agent behavior. Outputs structured results.
 *
 * Usage:
 *   node projects/gym/experiments/reflexion-experiment.js [--runs N] [--adapter <name>]
 *
 * Pairs tested:
 *   1. reflexion-npx-recovery-baseline vs reflexion-npx-recovery-treatment
 *   2. reflexion-read-before-edit-baseline vs reflexion-read-before-edit-treatment
 *
 * Output: JSON with per-pair pass rates, behavioral check rates, and summary.
 */

const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const PROJECT_ROOT = path.resolve(__dirname, "../../..");

// Parse args
const args = process.argv.slice(2);
let runs = 1;
let adapter = "may-agent";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--runs" && args[i + 1]) runs = parseInt(args[++i], 10);
  if (args[i] === "--adapter" && args[i + 1]) adapter = args[++i];
}

const EXPERIMENT_PAIRS = [
  {
    name: "npx-recovery",
    baseline: "reflexion-npx-recovery-baseline",
    treatment: "reflexion-npx-recovery-treatment",
    behavioral_check: "npx-avoided",
  },
  {
    name: "read-before-edit",
    baseline: "reflexion-read-before-edit-baseline",
    treatment: "reflexion-read-before-edit-treatment",
    behavioral_check: "read-before-edit",
  },
];

function runScenario(scenario, adapter) {
  try {
    const result = execFileSync(
      "bun",
      ["--cwd=projects/gym", "run", "scenario:run", "--", scenario, "--adapter", adapter],
      {
        cwd: PROJECT_ROOT,
        encoding: "utf-8",
        timeout: 10 * 60 * 1000,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    // Parse JSON from stdout
    const jsonMatch = result.match(/\{[\s\S]*\}\s*$/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { passed: false, checks: [], agent_status: "parse-error" };
  } catch (err) {
    const stdout = (err.stdout || "").toString();
    const jsonMatch = stdout.match(/\{[\s\S]*\}\s*$/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch {}
    }
    return { passed: false, checks: [], agent_status: "error", summary: err.message?.slice(0, 200) };
  }
}

function getCheckResult(gymResult, checkName) {
  if (!gymResult.checks) return null;
  const check = gymResult.checks.find(c => c.name === checkName);
  return check ? check.passed : null;
}

// Main
const results = {
  experiment: "reflexion-lessons-injection",
  timestamp: new Date().toISOString(),
  runs_per_arm: runs,
  adapter,
  pairs: [],
};

for (const pair of EXPERIMENT_PAIRS) {
  const pairResult = {
    name: pair.name,
    behavioral_check: pair.behavioral_check,
    baseline: { runs: [], pass_count: 0, behavioral_pass_count: 0 },
    treatment: { runs: [], pass_count: 0, behavioral_pass_count: 0 },
  };

  for (let i = 0; i < runs; i++) {
    console.error(`[${pair.name}] Baseline run ${i + 1}/${runs}...`);
    const baseResult = runScenario(pair.baseline, adapter);
    pairResult.baseline.runs.push(baseResult);
    if (baseResult.passed) pairResult.baseline.pass_count++;
    if (getCheckResult(baseResult, pair.behavioral_check)) pairResult.baseline.behavioral_pass_count++;

    console.error(`[${pair.name}] Treatment run ${i + 1}/${runs}...`);
    const treatResult = runScenario(pair.treatment, adapter);
    pairResult.treatment.runs.push(treatResult);
    if (treatResult.passed) pairResult.treatment.pass_count++;
    if (getCheckResult(treatResult, pair.behavioral_check)) pairResult.treatment.behavioral_pass_count++;
  }

  pairResult.baseline.pass_rate = pairResult.baseline.pass_count / runs;
  pairResult.baseline.behavioral_rate = pairResult.baseline.behavioral_pass_count / runs;
  pairResult.treatment.pass_rate = pairResult.treatment.pass_count / runs;
  pairResult.treatment.behavioral_rate = pairResult.treatment.behavioral_pass_count / runs;
  pairResult.delta_pass = pairResult.treatment.pass_rate - pairResult.baseline.pass_rate;
  pairResult.delta_behavioral = pairResult.treatment.behavioral_rate - pairResult.baseline.behavioral_rate;

  results.pairs.push(pairResult);
}

// Summary
results.summary = results.pairs.map(p =>
  `${p.name}: baseline=${(p.baseline.pass_rate * 100).toFixed(0)}%/${(p.baseline.behavioral_rate * 100).toFixed(0)}% ` +
  `treatment=${(p.treatment.pass_rate * 100).toFixed(0)}%/${(p.treatment.behavioral_rate * 100).toFixed(0)}% ` +
  `delta=+${(p.delta_behavioral * 100).toFixed(0)}pp`
).join("; ");

console.log(JSON.stringify(results, null, 2));
