import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { compareRuns, renderReport } from "./report";
import {
  createRunManifest,
  gymRoot,
  loadLabels,
  loadSuite,
  readManifest,
  resolveRunDir,
  safeName,
  storeTrial,
  writeManifest,
} from "./store";
import type { LoopRunManifest, RunComparison, ScenarioRunResult } from "./types";

export interface RunOptions {
  phase: "test" | "verify";
  benchmark: string;
  scenarios?: string[];
  agent: string;
  candidate: string;
  trials: number;
  baselineRunId?: string;
  timeout?: number;
}

export interface ExecutionResult {
  result: ScenarioRunResult;
  stderr: string;
}

export type ScenarioExecutor = (input: {
  scenario: string;
  scenariosDir: string;
  agent: string;
  candidate: string;
  timeout?: number;
}) => Promise<ExecutionResult>;

function parseResult(stdout: string, scenario: string, agent: string): ScenarioRunResult {
  try {
    return JSON.parse(stdout.trim()) as ScenarioRunResult;
  } catch (error) {
    return {
      scenario,
      agent,
      passed: false,
      checks: [],
      agent_status: "error",
      summary: `Could not parse runner output: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const executeScenario: ScenarioExecutor = async (input) => {
  const args = [join(gymRoot, "src", "cli.ts"), input.scenario, "--agent", input.agent];
  if (input.candidate !== "baseline") args.push("--lab", input.candidate);
  if (input.timeout) args.push("--timeout", String(input.timeout));
  const child = Bun.spawn([process.execPath, ...args], {
    cwd: gymRoot,
    env: { ...process.env, GYM_SCENARIOS_DIR: input.scenariosDir },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
  await child.exited;
  return { result: parseResult(stdout, input.scenario, input.agent), stderr };
};

function hashTree(path: string): string {
  const hash = createHash("sha256");
  const visit = (current: string, relativePath: string): void => {
    const stat = lstatSync(current);
    hash.update(`${relativePath}\0${stat.isSymbolicLink() ? "link" : stat.isDirectory() ? "dir" : "file"}\0`);
    if (stat.isSymbolicLink()) {
      hash.update(readlinkSync(current));
    } else if (stat.isDirectory()) {
      for (const entry of readdirSync(current).sort()) visit(join(current, entry), join(relativePath, entry));
    } else {
      hash.update(readFileSync(current));
    }
  };
  visit(path, ".");
  return hash.digest("hex");
}

function assertSameFile(current: string, frozen: string, label: string): void {
  if (!existsSync(current) || !existsSync(frozen) || hashTree(current) !== hashTree(frozen)) {
    throw new Error(`Frozen benchmark input changed (${label}); create a new baseline`);
  }
}

function assertFrozenInputs(baselineDir: string, baseline: LoopRunManifest): void {
  const { suite, path: suitePath } = loadSuite(baseline.benchmark);
  assertSameFile(suitePath, join(baselineDir, baseline.source.suite_snapshot), "suite.json");
  const { path: labelsPath } = loadLabels(baseline.benchmark, suite);
  if (baseline.source.labels_snapshot) {
    if (!labelsPath) throw new Error("Frozen labels exist but current labels are missing; create a new baseline");
    assertSameFile(labelsPath, join(baselineDir, baseline.source.labels_snapshot), "labels.json");
  }
  if (baseline.source.evaluator_snapshot && suite.evaluator) {
    assertSameFile(
      join(gymRoot, "benchmarks", baseline.benchmark, suite.evaluator),
      join(baselineDir, baseline.source.evaluator_snapshot),
      suite.evaluator,
    );
  }
  for (const scenario of baseline.scenarios) {
    const frozenCase = join(baselineDir, baseline.source.scenarios_snapshot, safeName(scenario));
    const currentCase = join(gymRoot, "scenarios", scenario);
    assertSameFile(currentCase, frozenCase, scenario);
  }
}

export async function runLoop(options: RunOptions, executor: ScenarioExecutor = executeScenario): Promise<{
  runDir: string;
  manifest: LoopRunManifest;
}> {
  const { suite, path: suitePath } = loadSuite(options.benchmark);
  const { catalog: labels, path: labelsPath } = loadLabels(options.benchmark, suite);
  const scenarios = options.scenarios?.length ? options.scenarios : suite.scenarios;
  const unknown = scenarios.filter((scenario) => !suite.scenarios.includes(scenario));
  if (unknown.length) throw new Error(`Scenarios are not in ${options.benchmark}: ${unknown.join(", ")}`);

  const created = createRunManifest({
    phase: options.phase,
    benchmark: options.benchmark,
    suite,
    suitePath,
    labelsPath,
    baselineRunId: options.baselineRunId,
    candidate: options.candidate,
    agent: options.agent,
    trials: options.trials,
    scenarios,
  });

  for (const scenario of scenarios) {
    for (let trial = 1; trial <= options.trials; trial++) {
      process.stderr.write(`${scenario} trial ${trial}/${options.trials} (${options.candidate})... `);
      const execution = await executor({
        scenario,
        scenariosDir: join(created.runDir, created.manifest.source.scenarios_snapshot),
        agent: options.agent,
        candidate: options.candidate,
        timeout: options.timeout,
      });
      const stored = storeTrial({
        runDir: created.runDir,
        suite,
        labels,
        scenarioDir: join(created.runDir, created.manifest.source.scenarios_snapshot, safeName(scenario)),
        scenario,
        trial,
        result: execution.result,
        stderr: execution.stderr,
      });
      created.manifest.trials.push(stored);
      writeManifest(created.runDir, created.manifest);
      process.stderr.write(`${stored.machine_verdict}\n`);
    }
  }
  created.manifest.completed_at = new Date().toISOString();
  writeManifest(created.runDir, created.manifest);
  renderReport(created.runDir, created.manifest);
  return created;
}

export async function verifyLoop(input: {
  baseline: string;
  candidate: string;
  trials?: number;
  timeout?: number;
}): Promise<{ runDir: string; manifest: LoopRunManifest; comparison: RunComparison }> {
  const baselineDir = resolveRunDir(input.baseline);
  const baseline = readManifest(baselineDir);
  assertFrozenInputs(baselineDir, baseline);
  const trials = input.trials ?? baseline.trials_per_scenario;
  if (trials !== baseline.trials_per_scenario) {
    throw new Error(
      `Verification trials (${trials}) must equal baseline trials (${baseline.trials_per_scenario}); create a matching baseline`,
    );
  }
  const created = await runLoop({
    phase: "verify",
    benchmark: baseline.benchmark,
    scenarios: baseline.scenarios,
    agent: baseline.agent,
    candidate: input.candidate,
    trials,
    baselineRunId: baseline.run_id,
    timeout: input.timeout,
  });
  const labels = baseline.source.labels_snapshot
    ? JSON.parse(readFileSync(join(baselineDir, baseline.source.labels_snapshot), "utf-8"))
    : null;
  const comparison = compareRuns(baseline, created.manifest, labels);
  writeFileSync(join(created.runDir, "comparison.json"), `${JSON.stringify(comparison, null, 2)}\n`);
  renderReport(created.runDir, created.manifest, comparison);
  return { ...created, comparison };
}
