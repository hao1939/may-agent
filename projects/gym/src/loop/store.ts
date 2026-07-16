import {
  appendFileSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";

import type {
  BenchmarkSuite,
  GroundTruthCatalog,
  HumanAdjudication,
  LoopRunManifest,
  MachineVerdict,
  ScenarioRunResult,
  StoredTrial,
} from "./types";

export const gymRoot = resolve(import.meta.dirname, "../..");

function timestampId(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "__");
}

export function benchmarkDir(benchmark: string): string {
  return join(gymRoot, "benchmarks", benchmark);
}

export function loadSuite(benchmark: string): { suite: BenchmarkSuite; path: string } {
  const path = join(benchmarkDir(benchmark), "suite.json");
  if (!existsSync(path)) throw new Error(`Benchmark suite not found: ${path}`);
  const suite = JSON.parse(readFileSync(path, "utf-8")) as BenchmarkSuite;
  if (!suite.name || !Array.isArray(suite.scenarios) || suite.scenarios.length === 0) {
    throw new Error(`Invalid benchmark suite: ${path}`);
  }
  return { suite, path };
}

export function loadLabels(
  benchmark: string,
  suite: BenchmarkSuite,
): { catalog: GroundTruthCatalog | null; path: string | null } {
  const path = join(benchmarkDir(benchmark), suite.labels_file ?? "labels.json");
  if (!existsSync(path)) return { catalog: null, path: null };
  return { catalog: JSON.parse(readFileSync(path, "utf-8")) as GroundTruthCatalog, path };
}

export function stateRoot(): string {
  return resolve(process.env["GYM_STATE_DIR"] || join(gymRoot, ".state"));
}

export function resolveRunDir(run: string): string {
  const direct = resolve(run);
  if (existsSync(join(direct, "manifest.json"))) return direct;
  const underState = join(stateRoot(), "benchmarks", run);
  if (existsSync(join(underState, "manifest.json"))) return underState;
  throw new Error(`Run not found: ${run}`);
}

export function createRunManifest(input: {
  phase: "test" | "verify";
  benchmark: string;
  suite: BenchmarkSuite;
  suitePath: string;
  labelsPath: string | null;
  baselineRunId?: string;
  candidate: string;
  agent: string;
  trials: number;
  scenarios: string[];
}): { manifest: LoopRunManifest; runDir: string } {
  const runId = `${safeName(input.benchmark)}-${input.phase}-${timestampId()}-${crypto.randomUUID().slice(0, 8)}`;
  const runDir = join(stateRoot(), "benchmarks", runId);
  mkdirSync(join(runDir, "cases"), { recursive: true });
  const inputsDir = join(runDir, "inputs");
  mkdirSync(inputsDir, { recursive: true });
  const sourceBenchmarkDir = benchmarkDir(input.benchmark);
  const frozenBenchmarkDir = join(inputsDir, "benchmarks", safeName(input.benchmark));
  cpSync(sourceBenchmarkDir, frozenBenchmarkDir, { recursive: true });
  const suiteSnapshot = join(frozenBenchmarkDir, relative(sourceBenchmarkDir, input.suitePath));
  const labelsSnapshot = input.labelsPath
    ? join(frozenBenchmarkDir, relative(sourceBenchmarkDir, input.labelsPath))
    : null;
  const evaluatorSource = input.suite.evaluator
    ? join(sourceBenchmarkDir, input.suite.evaluator)
    : null;
  const evaluatorSnapshot = evaluatorSource && existsSync(evaluatorSource)
    ? join(frozenBenchmarkDir, input.suite.evaluator!)
    : null;
  const scenariosSnapshot = join(inputsDir, "scenarios");
  for (const scenario of input.scenarios) {
    const source = join(gymRoot, "scenarios", scenario);
    if (!existsSync(source)) throw new Error(`Scenario not found: ${source}`);
    cpSync(source, join(scenariosSnapshot, safeName(scenario)), { recursive: true });
  }
  const manifest: LoopRunManifest = {
    schema_version: 1,
    run_id: runId,
    phase: input.phase,
    benchmark: input.benchmark,
    benchmark_version: input.suite.version,
    baseline_run_id: input.baselineRunId ?? null,
    candidate: input.candidate,
    agent: input.agent,
    trials_per_scenario: input.trials,
    scenarios: input.scenarios,
    started_at: new Date().toISOString(),
    completed_at: null,
    source: {
      suite_path: relative(gymRoot, input.suitePath),
      labels_path: input.labelsPath ? relative(gymRoot, input.labelsPath) : null,
      suite_snapshot: relative(runDir, suiteSnapshot),
      labels_snapshot: labelsSnapshot ? relative(runDir, labelsSnapshot) : null,
      evaluator_snapshot: evaluatorSnapshot ? relative(runDir, evaluatorSnapshot) : null,
      scenarios_snapshot: relative(runDir, scenariosSnapshot),
    },
    trials: [],
  };
  writeManifest(runDir, manifest);
  return { manifest, runDir };
}

export function readManifest(runDir: string): LoopRunManifest {
  return JSON.parse(readFileSync(join(runDir, "manifest.json"), "utf-8")) as LoopRunManifest;
}

export function writeManifest(runDir: string, manifest: LoopRunManifest): void {
  writeFileSync(join(runDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

export function machineVerdict(result: ScenarioRunResult): { verdict: MachineVerdict; reason: string | null } {
  if (result.agent_status === "error") return { verdict: "invalid", reason: "agent runtime returned error" };
  if (!Array.isArray(result.checks) || result.checks.length === 0) {
    return { verdict: "invalid", reason: "scorer returned no checks" };
  }
  const harnessFailure = result.checks.find((check) => !check.passed && check.category === "harness");
  if (harnessFailure) {
    return { verdict: "invalid", reason: harnessFailure.detail || harnessFailure.name };
  }
  return { verdict: result.passed ? "pass" : "fail", reason: null };
}

function copyIfPresent(source: string | undefined, destination: string): string | null {
  if (!source || !existsSync(source)) return null;
  copyFileSync(source, destination);
  return destination;
}

export function storeTrial(input: {
  runDir: string;
  suite: BenchmarkSuite;
  labels: GroundTruthCatalog | null;
  scenarioDir: string;
  scenario: string;
  trial: number;
  result: ScenarioRunResult;
  stderr: string;
}): StoredTrial {
  const caseDir = join(input.runDir, "cases", safeName(input.scenario), `trial-${input.trial}`);
  mkdirSync(caseDir, { recursive: true });

  const resultPath = join(caseDir, "result.json");
  writeFileSync(resultPath, `${JSON.stringify(input.result, null, 2)}\n`);
  writeFileSync(join(caseDir, "checks.json"), `${JSON.stringify(input.result.checks ?? [], null, 2)}\n`);
  writeFileSync(join(caseDir, "runner.stderr.log"), input.stderr);

  for (const name of ["task.md", "expected.json", "scenario.json", "success_criteria.js"]) {
    if (existsSync(join(input.scenarioDir, name))) copyFileSync(join(input.scenarioDir, name), join(caseDir, name));
  }
  if (existsSync(join(input.scenarioDir, "environment"))) {
    cpSync(join(input.scenarioDir, "environment"), join(caseDir, "environment"), { recursive: true });
  }

  const artifactName = input.suite.artifact ?? "alignment-decision.json";
  const artifactPath = copyIfPresent(
    input.result.work_dir ? join(input.result.work_dir, artifactName) : undefined,
    join(caseDir, basename(artifactName)),
  );
  const transcriptPath = copyIfPresent(
    input.result.work_dir ? join(input.result.work_dir, "transcript.jsonl") : undefined,
    join(caseDir, "transcript.jsonl"),
  );

  const sessionArchive = join(caseDir, "session");
  if (input.result.session_path && existsSync(input.result.session_path)) {
    cpSync(input.result.session_path, sessionArchive, { recursive: true });
  }

  const evaluated = machineVerdict(input.result);
  const labelStatus = input.labels?.labels[input.scenario]?.status ?? "missing";
  const stored: StoredTrial = {
    scenario: input.scenario,
    trial: input.trial,
    machine_verdict: evaluated.verdict,
    invalid_reason: evaluated.reason,
    label_status: labelStatus,
    result_path: relative(input.runDir, resultPath),
    artifact_path: artifactPath ? relative(input.runDir, artifactPath) : null,
    transcript_path: transcriptPath ? relative(input.runDir, transcriptPath) : null,
  };
  writeFileSync(join(caseDir, "evaluation.json"), `${JSON.stringify(stored, null, 2)}\n`);
  return stored;
}

export function appendAdjudication(runDir: string, adjudication: HumanAdjudication): void {
  appendFileSync(join(runDir, "reviews.jsonl"), `${JSON.stringify(adjudication)}\n`);
}

export function readAdjudications(runDir: string): HumanAdjudication[] {
  const path = join(runDir, "reviews.jsonl");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as HumanAdjudication);
}
