#!/usr/bin/env bun
/**
 * workflow-compare.ts — Run two workflows on the same project scenario and compare.
 *
 * Usage:
 *   bun scripts/workflow-compare.ts app/gym/scenarios/workflow-fibonacci
 *
 * Runs master-worker and worker-reviewer on copies of the scenario,
 * then scores both with success_criteria.js.
 */

import { cpSync, mkdirSync, mkdtempSync, readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const APP_ROOT = join(PROJECT_ROOT, "app");
const scenarioDir = resolve(PROJECT_ROOT, process.argv[2] ?? "app/gym/scenarios/workflow-fibonacci");

if (!existsSync(join(scenarioDir, "success_criteria.js"))) {
  console.error(`No success_criteria.js in ${scenarioDir}`);
  process.exit(1);
}

const workflows = ["master-worker", "worker-reviewer"];

async function runWorkflow(workflowName: string): Promise<{ score: any; duration: number }> {
  const tmpDir = mkdtempSync(join(tmpdir(), `wf-${workflowName}-`));
  const workDir = join(tmpDir, "project");
  mkdirSync(workDir, { recursive: true });
  cpSync(join(scenarioDir, "environment"), workDir, { recursive: true });

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Running: ${workflowName}`);
  console.log(`Work dir: ${workDir}`);
  console.log("=".repeat(60));

  const start = Date.now();
  try {
    const cmd = `bun src/app/may.ts --run-workflow ${workflowName} "project: ${workDir}"`;
    execSync(cmd, {
      cwd: PROJECT_ROOT,
      timeout: 10 * 60 * 1000, // 10 min
      stdio: "inherit",
      env: { ...process.env, PATH: process.env.PATH },
    });
  } catch (e: any) {
    console.error(`Workflow ${workflowName} failed:`, e.message?.slice(0, 200));
  }
  const duration = Date.now() - start;

  // Score
  let score: any = { passed: false, checks: [], summary: "scorer failed" };
  try {
    const output = execSync(`node ${join(scenarioDir, "success_criteria.js")} ${workDir}`, {
      timeout: 30000,
      encoding: "utf-8",
    });
    score = JSON.parse(output);
  } catch (e: any) {
    console.error(`Scorer failed for ${workflowName}:`, e.message?.slice(0, 200));
  }

  return { score, duration };
}

// Run sequentially
const results: Record<string, { score: any; duration: number }> = {};
for (const wf of workflows) {
  const wfPath = join(APP_ROOT, "shared/workflows", `${wf}.ts`);
  if (!existsSync(wfPath)) {
    console.log(`Skipping ${wf} — ${wfPath} not found`);
    continue;
  }
  results[wf] = await runWorkflow(wf);
}

// Compare
console.log(`\n${"=".repeat(60)}`);
console.log("COMPARISON");
console.log("=".repeat(60));
for (const [wf, r] of Object.entries(results)) {
  const passCount = r.score.checks?.filter((c: any) => c.passed).length ?? 0;
  const totalChecks = r.score.checks?.length ?? 0;
  console.log(`\n${wf}:`);
  console.log(`  Score: ${passCount}/${totalChecks} (${r.score.passed ? "PASS" : "FAIL"})`);
  console.log(`  Duration: ${Math.round(r.duration / 1000)}s`);
  for (const c of r.score.checks ?? []) {
    console.log(`  ${c.passed ? "✅" : "❌"} ${c.name}: ${c.detail?.slice(0, 80)}`);
  }
}
