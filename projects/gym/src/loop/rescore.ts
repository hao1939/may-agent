import { createRequire } from "node:module";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import { gymRoot, loadSuite, machineVerdict, materializeScenarioOrInlineCase, readManifest, resolveRunDir, safeName } from "./store";
import type { MachineVerdict, ScenarioCheck, ScenarioRunResult } from "./types";

interface RescoredTrial {
  scenario: string;
  trial: number;
  original_verdict: MachineVerdict;
  rescored_verdict: MachineVerdict;
  invalid_reason: string | null;
  checks: ScenarioCheck[];
  summary: string;
}

export interface RescoreResult {
  schema_version: 1;
  run_id: string;
  evaluator_path: string;
  created_at: string;
  disclaimer: string;
  counts: { pass: number; fail: number; invalid: number };
  changed: number;
  trials: RescoredTrial[];
  artifact_path: string;
}

type Evaluator = (workDir: string, scenarioDir: string, context?: { originalWorkDir?: string }) => Pick<ScenarioRunResult, "passed" | "checks" | "summary">;

function evaluatorFor(path: string): Evaluator {
  const loaded = createRequire(import.meta.url)(path) as { scoreScenario?: Evaluator; scoreDecision?: Evaluator; scoreTaskResult?: Evaluator };
  const evaluate = loaded.scoreScenario ?? loaded.scoreDecision ?? loaded.scoreTaskResult;
  if (typeof evaluate !== "function") {
    throw new Error(`Evaluator must export scoreScenario, scoreDecision or scoreTaskResult(workDir, scenarioDir): ${path}`);
  }
  return evaluate;
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
    if (!trial.artifact_path && !trial.workspace_path) throw new Error(`Trial has no captured artifact or workspace: ${trial.scenario} ${trial.trial}`);
    const caseDir = join(runDir, "cases", safeName(trial.scenario), `trial-${trial.trial}`);
    const originalResult = JSON.parse(readFileSync(join(runDir, trial.result_path), "utf8")) as ScenarioRunResult;
    const workDir = mkdtempSync(join(tmpdir(), "gym-rescore-"));
    try {
      const hasWorkspace = Boolean(trial.workspace_path && existsSync(join(runDir, trial.workspace_path)));
      if (hasWorkspace) {
        cpSync(join(runDir, trial.workspace_path!), workDir, { recursive: true });
      } else {
        if (trial.artifact_path) copyFileSync(join(runDir, trial.artifact_path), join(workDir, basename(trial.artifact_path)));
        const statePath = join(caseDir, "environment", "system-state.md");
        if (existsSync(statePath)) copyFileSync(statePath, join(workDir, "system-state.md"));
      }
      const currentScenarioDir = mkdtempSync(join(tmpdir(), "gym-rescore-case-"));
      let score: ReturnType<Evaluator>;
      let currentSemantic = false;
      try {
        materializeScenarioOrInlineCase({
          scenario: trial.scenario, suite,
          sourceBenchmarkDir: join(gymRoot, "benchmarks", manifest.benchmark),
          evaluatorOwner: dirname(resolve(evaluatorPath)),
          destination: currentScenarioDir,
        });
        currentSemantic = existsSync(join(currentScenarioDir, "semantic_criteria.md"));
        // Origin comes from the runner's stored result, not a path guessed from
        // agent-authored command text. Keep original receipts unchanged.
        score = evaluate(workDir, currentScenarioDir, { originalWorkDir: originalResult.work_dir });
      } finally {
        rmSync(currentScenarioDir, { recursive: true, force: true });
      }
      const deterministic = machineVerdict({
        scenario: trial.scenario,
        agent: manifest.agent,
        agent_status: originalResult.agent_status,
        passed: score.passed,
        checks: score.checks,
        summary: score.summary,
      });
      const requiresSemanticEvaluation =
        currentSemantic ||
        (originalResult.semantic_evaluation !== undefined && originalResult.semantic_evaluation !== null) ||
        existsSync(join(caseDir, "semantic-evaluation.json")) ||
        existsSync(join(caseDir, "semantic_criteria.md")) ||
        existsSync(join(gymRoot, "scenarios", trial.scenario, "semantic_criteria.md")) ||
        Boolean(suite.cases?.find((item) => item.id === trial.scenario)?.semantic_criteria) ||
        existsSync(join(gymRoot, "benchmarks", manifest.benchmark, "scenarios", trial.scenario, "semantic_criteria.md"));
      const missingWorkspace = !hasWorkspace && (
        manifest.evaluation_kinds?.[trial.scenario] === "behavior" ||
        score.checks.some((check) => check.name === "decision-only-scope")
      );
      const rescoredVerdict = requiresSemanticEvaluation || missingWorkspace ? "invalid" : deterministic.verdict;
      const invalidReason = requiresSemanticEvaluation
        ? "current semantic rubric was not evaluated; deterministic rescore is diagnostic only"
        : missingWorkspace ? "no retained final workspace; cannot re-evaluate workspace scope or behavior"
        : deterministic.reason;
      trials.push({
        scenario: trial.scenario,
        trial: trial.trial,
        original_verdict: trial.machine_verdict,
        rescored_verdict: rescoredVerdict,
        invalid_reason: invalidReason,
        checks: score.checks,
        summary: rescoredVerdict === "invalid"
          ? `No full verdict: ${invalidReason}. Deterministic result was ${deterministic.verdict}. ${score.summary ?? ""}`.trim()
          : score.summary ?? "",
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
      invalid: trials.filter((trial) => trial.rescored_verdict === "invalid").length,
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
    `Result: ${result.counts.pass} pass, ${result.counts.fail} fail, ${result.counts.invalid} invalid · ${result.changed} verdicts changed`,
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
