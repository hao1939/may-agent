import { createRequire } from "node:module";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { gymRoot, loadSuite, readManifest, resolveRunDir, safeName } from "./store";
import type { MachineVerdict, ScenarioCheck, ScenarioRunResult } from "./types";

interface RescoredTrial {
  scenario: string;
  trial: number;
  original_verdict: MachineVerdict;
  rescored_verdict: Exclude<MachineVerdict, "invalid">;
  checks: ScenarioCheck[];
  summary: string;
}

export interface RescoreResult {
  schema_version: 1;
  run_id: string;
  evaluator_path: string;
  created_at: string;
  disclaimer: string;
  counts: { pass: number; fail: number };
  changed: number;
  trials: RescoredTrial[];
  artifact_path: string;
}

type Evaluator = (workDir: string, scenarioDir: string) => Pick<ScenarioRunResult, "passed" | "checks" | "summary">;

function evaluatorFor(path: string): Evaluator {
  const loaded = createRequire(import.meta.url)(path) as { scoreDecision?: Evaluator };
  if (typeof loaded.scoreDecision !== "function") {
    throw new Error(`Evaluator must export scoreDecision(workDir, scenarioDir): ${path}`);
  }
  return loaded.scoreDecision;
}

export function rescoreRun(run: string): RescoreResult {
  const runDir = resolveRunDir(run);
  const manifest = readManifest(runDir);
  const { suite } = loadSuite(manifest.benchmark);
  if (!suite.evaluator) throw new Error(`Benchmark ${manifest.benchmark} has no evaluator`);
  const evaluatorPath = join(gymRoot, "benchmarks", manifest.benchmark, suite.evaluator);
  const evaluate = evaluatorFor(evaluatorPath);
  const trials: RescoredTrial[] = [];

  for (const trial of manifest.trials) {
    if (!trial.artifact_path) throw new Error(`Trial has no captured artifact: ${trial.scenario} ${trial.trial}`);
    const caseDir = join(runDir, "cases", safeName(trial.scenario), `trial-${trial.trial}`);
    const workDir = mkdtempSync(join(tmpdir(), "gym-rescore-"));
    try {
      copyFileSync(join(runDir, trial.artifact_path), join(workDir, basename(trial.artifact_path)));
      const statePath = join(caseDir, "environment", "system-state.md");
      if (existsSync(statePath)) copyFileSync(statePath, join(workDir, "system-state.md"));
      const score = evaluate(workDir, join(gymRoot, "scenarios", trial.scenario));
      trials.push({
        scenario: trial.scenario,
        trial: trial.trial,
        original_verdict: trial.machine_verdict,
        rescored_verdict: score.passed ? "pass" : "fail",
        checks: score.checks,
        summary: score.summary ?? "",
      });
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }

  const createdAt = new Date().toISOString();
  const outputDir = join(runDir, "rescoring");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `${createdAt.replace(/[-:.]/g, "")}.json`);
  const result: RescoreResult = {
    schema_version: 1,
    run_id: manifest.run_id,
    evaluator_path: evaluatorPath,
    created_at: createdAt,
    disclaimer: "Diagnostic only: rescoring uses current definitions and does not rewrite frozen evidence or create a release baseline.",
    counts: {
      pass: trials.filter((trial) => trial.rescored_verdict === "pass").length,
      fail: trials.filter((trial) => trial.rescored_verdict === "fail").length,
    },
    changed: trials.filter((trial) => trial.original_verdict !== trial.rescored_verdict).length,
    trials,
    artifact_path: outputPath,
  };
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

export function renderRescore(result: RescoreResult): string {
  const lines = [
    `# Gym Rescore — ${result.run_id}`,
    "",
    `Current evaluator: \`${result.evaluator_path}\``,
    `Result: ${result.counts.pass} pass, ${result.counts.fail} fail · ${result.changed} verdicts changed`,
    `Evidence: \`${result.artifact_path}\``,
    "",
    `> ${result.disclaimer}`,
    "",
  ];
  for (const scenario of [...new Set(result.trials.map((trial) => trial.scenario))]) {
    const trials = result.trials.filter((trial) => trial.scenario === scenario);
    const pass = trials.filter((trial) => trial.rescored_verdict === "pass").length;
    lines.push(`${pass === trials.length ? "✓" : pass > 0 ? "~" : "✗"} ${scenario} — ${pass}/${trials.length} pass`);
    const failures = new Map<string, number>();
    for (const trial of trials) {
      for (const check of trial.checks.filter((check) => !check.passed && check.gate !== false)) {
        failures.set(check.name, (failures.get(check.name) ?? 0) + 1);
      }
    }
    for (const [name, count] of failures) lines.push(`  - ${name}: ${count}/${trials.length} failed`);
  }
  return `${lines.join("\n")}\n`;
}
