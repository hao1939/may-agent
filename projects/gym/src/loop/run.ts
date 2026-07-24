import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { compareRuns, renderReport } from "./report";
import {
  createRunManifest,
  fingerprintTree,
  gymRoot,
  loadLabels,
  loadSuite,
  readManifest,
  resolveRunDir,
  safeName,
  storeTrial,
  writeManifest,
} from "./store";
import type {
  LoopRunManifest,
  RunComparison,
  ScenarioRunResult,
  StoredTrial,
} from "./types";

export interface RunOptions {
  phase: "test" | "verify";
  benchmark: string;
  scenarios?: string[];
  agent: string;
  candidate: string;
  trials: number;
  baselineRunId?: string;
  timeout?: number;
  agentsRoot?: string;
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
  agentsRoot?: string;
}) => Promise<ExecutionResult>;

function cleanupScenarioSandbox(result: ScenarioRunResult): void {
  if (!result.gym_root) return;
  const root = resolve(result.gym_root);
  const tempRoot = `${resolve(tmpdir())}/`;
  const name = root.slice(tempRoot.length);
  if (
    !root.startsWith(tempRoot) ||
    (!name.startsWith("gym-run-") && !name.startsWith("gym-multi-")) ||
    name.includes("/")
  ) {
    return;
  }
  rmSync(root, { recursive: true, force: true });
}

function parseResult(
  stdout: string,
  scenario: string,
  agent: string,
): ScenarioRunResult {
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
  const args = [
    join(gymRoot, "src", "cli.ts"),
    input.scenario,
    "--agent",
    input.agent,
  ];
  if (input.candidate !== "baseline") args.push("--lab", input.candidate);
  if (input.timeout) args.push("--timeout", String(input.timeout));
  const child = Bun.spawn([process.env["BUN_EXEC_PATH"] || "bun", ...args], {
    cwd: gymRoot,
    env: {
      ...process.env,
      GYM_SCENARIOS_DIR: input.scenariosDir,
      ...(input.agentsRoot ? { GYM_AGENTS_ROOT: input.agentsRoot } : {}),
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  await child.exited;
  return { result: parseResult(stdout, input.scenario, input.agent), stderr };
};

function assertSameFile(current: string, frozen: string, label: string): void {
  if (
    !existsSync(current) ||
    !existsSync(frozen) ||
    fingerprintTree(current) !== fingerprintTree(frozen)
  ) {
    throw new Error(
      `Frozen benchmark input changed (${label}); create a new baseline`,
    );
  }
}

function candidateFingerprint(
  candidate: string,
  configuredAgentsRoot?: string,
): string | null {
  if (candidate === "baseline") return null;
  const agentsRoot = resolve(
    configuredAgentsRoot ||
      process.env["GYM_AGENTS_ROOT"] ||
      process.env["AGENTS_ROOT"] ||
      join(gymRoot, "../../agents"),
  );
  const candidatePath = join(agentsRoot, ".lab", candidate);
  if (!existsSync(candidatePath)) {
    throw new Error(`Candidate not found: ${candidatePath}`);
  }
  return fingerprintTree(candidatePath);
}

function refreshObservedProvenance(manifest: LoopRunManifest): void {
  const unique = (values: Array<string | null>): string[] =>
    [
      ...new Set(values.filter((value): value is string => Boolean(value))),
    ].sort();
  manifest.proof.agent_prompt_fingerprints = unique(
    manifest.trials.map((trial) => trial.provenance.prompt_fingerprint),
  );
  manifest.proof.framework_revisions = unique(
    manifest.trials.map((trial) => trial.provenance.framework_revision),
  );
  manifest.proof.models = unique(
    manifest.trials.map((trial) => trial.provenance.model),
  );
}

function assertFrozenInputs(
  baselineDir: string,
  baseline: LoopRunManifest,
): void {
  const { suite, path: suitePath } = loadSuite(baseline.benchmark);
  assertSameFile(
    suitePath,
    join(baselineDir, baseline.source.suite_snapshot),
    "suite.json",
  );
  const { path: labelsPath } = loadLabels(baseline.benchmark, suite);
  if (baseline.source.labels_snapshot) {
    if (!labelsPath)
      throw new Error(
        "Frozen labels exist but current labels are missing; create a new baseline",
      );
    assertSameFile(
      labelsPath,
      join(baselineDir, baseline.source.labels_snapshot),
      "labels.json",
    );
  }
  if (baseline.source.evaluator_snapshot && suite.evaluator) {
    assertSameFile(
      join(gymRoot, "benchmarks", baseline.benchmark, suite.evaluator),
      join(baselineDir, baseline.source.evaluator_snapshot),
      suite.evaluator,
    );
  }
  for (const scenario of baseline.scenarios) {
    const frozenCase = join(
      baselineDir,
      baseline.source.scenarios_snapshot,
      safeName(scenario),
    );
    const currentCase = join(gymRoot, "scenarios", scenario);
    assertSameFile(currentCase, frozenCase, scenario);
  }
}

export async function runLoop(
  options: RunOptions,
  executor: ScenarioExecutor = executeScenario,
): Promise<{
  runDir: string;
  manifest: LoopRunManifest;
}> {
  const { suite, path: suitePath } = loadSuite(options.benchmark);
  const { catalog: labels, path: labelsPath } = loadLabels(
    options.benchmark,
    suite,
  );
  const scenarios = options.scenarios?.length
    ? options.scenarios
    : suite.scenarios;
  const unknown = scenarios.filter(
    (scenario) => !suite.scenarios.includes(scenario),
  );
  if (unknown.length)
    throw new Error(
      `Scenarios are not in ${options.benchmark}: ${unknown.join(", ")}`,
    );

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
    candidateFingerprint: candidateFingerprint(
      options.candidate,
      options.agentsRoot,
    ),
  });

  for (const scenario of scenarios) {
    for (let trial = 1; trial <= options.trials; trial++) {
      process.stderr.write(
        `${scenario} trial ${trial}/${options.trials} (${options.candidate})... `,
      );
      const execution = await executor({
        scenario,
        scenariosDir: join(
          created.runDir,
          created.manifest.source.scenarios_snapshot,
        ),
        agent: options.agent,
        candidate: options.candidate,
        timeout: options.timeout,
        agentsRoot: options.agentsRoot,
      });
      let stored: StoredTrial;
      try {
        stored = storeTrial({
          runDir: created.runDir,
          suite,
          labels,
          scenarioDir: join(
            created.runDir,
            created.manifest.source.scenarios_snapshot,
            safeName(scenario),
          ),
          scenario,
          trial,
          result: execution.result,
          stderr: execution.stderr,
        });
      } finally {
        cleanupScenarioSandbox(execution.result);
      }
      created.manifest.trials.push(stored);
      refreshObservedProvenance(created.manifest);
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
  agentsRoot?: string;
}): Promise<{
  runDir: string;
  manifest: LoopRunManifest;
  comparison: RunComparison;
}> {
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
    agentsRoot: input.agentsRoot,
  });
  const labels = baseline.source.labels_snapshot
    ? JSON.parse(
        readFileSync(
          join(baselineDir, baseline.source.labels_snapshot),
          "utf-8",
        ),
      )
    : null;
  const comparison = compareRuns(baseline, created.manifest, labels);
  writeFileSync(
    join(created.runDir, "comparison.json"),
    `${JSON.stringify(comparison, null, 2)}\n`,
  );
  renderReport(created.runDir, created.manifest, comparison);
  return { ...created, comparison };
}
