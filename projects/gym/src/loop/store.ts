import { createHash } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import type {
  BenchmarkSuite,
  GroundTruthCatalog,
  HumanAdjudication,
  LoopRunManifest,
  MachineVerdict,
  ScenarioRunResult,
  StoredTrial,
} from "./types";

export let gymRoot = resolve(import.meta.dirname, "../..");

export function configureGymRoot(path: string): void {
  gymRoot = resolve(path);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function fingerprintValue(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function fingerprintTree(path: string): string {
  const hash = createHash("sha256");
  const visit = (current: string, relativePath: string): void => {
    const stat = lstatSync(current);
    hash.update(
      `${relativePath}\0${
        stat.isSymbolicLink() ? "link" : stat.isDirectory() ? "dir" : "file"
      }\0`,
    );
    if (stat.isSymbolicLink()) {
      hash.update(readlinkSync(current));
    } else if (stat.isDirectory()) {
      for (const entry of readdirSync(current).sort()) {
        visit(join(current, entry), join(relativePath, entry));
      }
    } else {
      hash.update(readFileSync(current));
    }
  };
  visit(path, ".");
  return hash.digest("hex");
}

function timestampId(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "__");
}

export function benchmarkDir(benchmark: string): string {
  return join(gymRoot, "benchmarks", benchmark);
}

const SEMANTIC_SCENARIO_FILES = [
  "semantic_criteria.md",
  "semantic_controls.json",
] as const;

const CONTROLLED_HARNESS_PATHS = [
  "src/cli.ts",
  "src/model-registry.ts",
  "src/loop",
  "src/scoring",
  "src/scenarios",
  "dist/@may-agent/gym/scoring.js",
] as const;

/** Copies the Gym-owned runner/scoring implementation used by a bounded run. */
export function snapshotHarness(destination: string): void {
  mkdirSync(destination, { recursive: true });
  for (const relativePath of CONTROLLED_HARNESS_PATHS) {
    const source = join(gymRoot, relativePath);
    if (!existsSync(source)) continue;
    const target = join(destination, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true });
  }
}

export function applyEvaluatorScenarioOverlay(input: {
  sourceBenchmarkDir: string;
  evaluatorOwner: string | null;
  scenario: string;
  destination: string;
}): void {
  if (!input.evaluatorOwner) return;
  const overlay = join(
    input.evaluatorOwner,
    "scenarios",
    safeName(input.scenario),
  );
  if (!existsSync(overlay)) return;
  if (input.evaluatorOwner !== input.sourceBenchmarkDir) {
    cpSync(overlay, input.destination, { recursive: true, force: true });
    return;
  }
  for (const name of SEMANTIC_SCENARIO_FILES) {
    const source = join(overlay, name);
    if (existsSync(source)) copyFileSync(source, join(input.destination, name));
  }
}

export function loadSuite(benchmark: string): {
  suite: BenchmarkSuite;
  path: string;
} {
  const path = join(benchmarkDir(benchmark), "suite.json");
  if (!existsSync(path)) throw new Error(`Benchmark suite not found: ${path}`);
  const suite = JSON.parse(readFileSync(path, "utf-8")) as BenchmarkSuite;
  if (
    !suite.name ||
    !Array.isArray(suite.scenarios) ||
    suite.scenarios.length === 0
  ) {
    throw new Error(`Invalid benchmark suite: ${path}`);
  }
  return { suite, path };
}

export function loadLabels(
  benchmark: string,
  suite: BenchmarkSuite,
): { catalog: GroundTruthCatalog | null; path: string | null } {
  const path = join(
    benchmarkDir(benchmark),
    suite.labels_file ?? "labels.json",
  );
  if (!existsSync(path)) return { catalog: null, path: null };
  const catalog = JSON.parse(readFileSync(path, "utf-8")) as GroundTruthCatalog;
  if (catalog.benchmark !== benchmark) {
    throw new Error(
      `Label catalog benchmark mismatch: expected ${benchmark}, found ${catalog.benchmark}`,
    );
  }
  return { catalog, path };
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
  candidateFingerprint: string | null;
  candidatePath: string | null;
}): { manifest: LoopRunManifest; runDir: string } {
  const runId = `${safeName(input.benchmark)}-${input.phase}-${timestampId()}-${crypto.randomUUID().slice(0, 8)}`;
  const runDir = join(stateRoot(), "benchmarks", runId);
  mkdirSync(join(runDir, "cases"), { recursive: true });
  const inputsDir = join(runDir, "inputs");
  mkdirSync(inputsDir, { recursive: true });
  const sourceBenchmarkDir = benchmarkDir(input.benchmark);
  const frozenBenchmarkDir = join(
    inputsDir,
    "benchmarks",
    safeName(input.benchmark),
  );
  cpSync(sourceBenchmarkDir, frozenBenchmarkDir, { recursive: true });
  const suiteSnapshot = join(
    frozenBenchmarkDir,
    relative(sourceBenchmarkDir, input.suitePath),
  );
  const labelsSnapshot = input.labelsPath
    ? join(frozenBenchmarkDir, relative(sourceBenchmarkDir, input.labelsPath))
    : null;
  const evaluatorSource = input.suite.evaluator
    ? join(sourceBenchmarkDir, input.suite.evaluator)
    : null;
  const evaluatorSnapshot =
    evaluatorSource && existsSync(evaluatorSource)
      ? join(frozenBenchmarkDir, input.suite.evaluator!)
      : null;
  if (
    evaluatorSource &&
    evaluatorSnapshot &&
    !existsSync(evaluatorSnapshot)
  ) {
    mkdirSync(dirname(evaluatorSnapshot), { recursive: true });
    copyFileSync(evaluatorSource, evaluatorSnapshot);
  }
  const semanticJudgesSource = join(
    gymRoot,
    "benchmarks",
    "semantic-judges",
    "agents",
  );
  let semanticJudgesSnapshot: string | null = null;
  const scenariosSnapshot = join(inputsDir, "scenarios");
  const evaluatorOwner = evaluatorSource ? dirname(evaluatorSource) : null;
  for (const scenario of input.scenarios) {
    const source = join(gymRoot, "scenarios", scenario);
    if (!existsSync(source)) throw new Error(`Scenario not found: ${source}`);
    const snapshot = join(scenariosSnapshot, safeName(scenario));
    cpSync(source, snapshot, {
      recursive: true,
    });
    applyEvaluatorScenarioOverlay({
      sourceBenchmarkDir,
      evaluatorOwner,
      scenario,
      destination: snapshot,
    });
  }
  const usesSemanticJudges = input.scenarios.some((scenario) =>
    existsSync(join(scenariosSnapshot, safeName(scenario), "semantic_criteria.md")),
  );
  if (usesSemanticJudges) {
    if (!existsSync(semanticJudgesSource)) {
      throw new Error("Semantic benchmark has no semantic judge agent definitions");
    }
    semanticJudgesSnapshot = join(inputsDir, "semantic-judges", "agents");
    cpSync(semanticJudgesSource, semanticJudgesSnapshot, { recursive: true });
  }
  const harnessSnapshot = join(inputsDir, "harness");
  snapshotHarness(harnessSnapshot);
  const candidateSnapshot = input.candidatePath
    ? join(runDir, "candidate")
    : null;
  if (input.candidatePath && candidateSnapshot) {
    cpSync(input.candidatePath, candidateSnapshot, { recursive: true });
    const snapshotFingerprint = fingerprintTree(candidateSnapshot);
    if (snapshotFingerprint !== input.candidateFingerprint) {
      throw new Error(
        `Candidate changed while snapshotting: expected ${input.candidateFingerprint}, found ${snapshotFingerprint}`,
      );
    }
  }
  const manifest: LoopRunManifest = {
    schema_version: 2,
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
    proof: {
      input_fingerprint: fingerprintTree(inputsDir),
      label_set_fingerprint: labelsSnapshot
        ? fingerprintTree(labelsSnapshot)
        : null,
      label_catalog_fingerprint: labelsSnapshot
        ? fingerprintValue(JSON.parse(readFileSync(labelsSnapshot, "utf8")))
        : null,
      candidate_fingerprint: input.candidateFingerprint,
      semantic_judging: usesSemanticJudges,
      semantic_judge_fingerprint: semanticJudgesSnapshot
        ? fingerprintTree(semanticJudgesSnapshot)
        : null,
      harness_fingerprint: fingerprintTree(harnessSnapshot),
      agent_prompt_fingerprints: [],
      framework_revisions: [],
      models: [],
    },
    source: {
      suite_path: relative(gymRoot, input.suitePath),
      labels_path: input.labelsPath
        ? relative(gymRoot, input.labelsPath)
        : null,
      suite_snapshot: relative(runDir, suiteSnapshot),
      labels_snapshot: labelsSnapshot ? relative(runDir, labelsSnapshot) : null,
      evaluator_snapshot: evaluatorSnapshot
        ? relative(runDir, evaluatorSnapshot)
        : null,
      semantic_judges_snapshot: semanticJudgesSnapshot
        ? relative(runDir, semanticJudgesSnapshot)
        : null,
      harness_snapshot: relative(runDir, harnessSnapshot),
      scenarios_snapshot: relative(runDir, scenariosSnapshot),
      candidate_snapshot: candidateSnapshot
        ? relative(runDir, candidateSnapshot)
        : null,
    },
    trials: [],
  };
  writeManifest(runDir, manifest);
  return { manifest, runDir };
}

export function readManifest(runDir: string): LoopRunManifest {
  return JSON.parse(
    readFileSync(join(runDir, "manifest.json"), "utf-8"),
  ) as LoopRunManifest;
}

export function writeManifest(runDir: string, manifest: LoopRunManifest): void {
  writeFileSync(
    join(runDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

export function machineVerdict(result: ScenarioRunResult): {
  verdict: MachineVerdict;
  reason: string | null;
} {
  if (result.agent_status !== "success") {
    const status = result.agent_status ?? "missing";
    const diagnostic = result.execution_error?.trim() || result.summary?.trim();
    return {
      verdict: "invalid",
      reason: `agent execution status ${status}${diagnostic ? `: ${diagnostic}` : ""}`,
    };
  }
  if (typeof result.passed !== "boolean") {
    return { verdict: "invalid", reason: "scorer returned a nonboolean overall verdict" };
  }
  if (!Array.isArray(result.checks) || result.checks.length === 0) {
    return { verdict: "invalid", reason: "scorer returned no checks" };
  }
  if (result.checks.some((check) => !check || typeof check.name !== "string" || typeof check.passed !== "boolean")) {
    return { verdict: "invalid", reason: "scorer returned a malformed check verdict" };
  }
  const failedRequiredCheck = result.checks.find((check) => check.gate !== false && !check.passed);
  if (result.passed && failedRequiredCheck) {
    return { verdict: "invalid", reason: `scorer overall pass contradicts required check ${failedRequiredCheck.name}` };
  }
  if (!result.passed && !failedRequiredCheck) {
    return { verdict: "invalid", reason: "scorer overall failure has no failed required check" };
  }
  const harnessFailure = result.checks.find(
    (check) => !check.passed && check.category === "harness",
  );
  if (harnessFailure) {
    return {
      verdict: "invalid",
      reason: harnessFailure.detail || harnessFailure.name,
    };
  }
  return { verdict: result.passed ? "pass" : "fail", reason: null };
}

function copyIfPresent(
  source: string | undefined,
  destination: string,
): string | null {
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
  const caseDir = join(
    input.runDir,
    "cases",
    safeName(input.scenario),
    `trial-${input.trial}`,
  );
  mkdirSync(caseDir, { recursive: true });

  const resultPath = join(caseDir, "result.json");
  writeFileSync(resultPath, `${JSON.stringify(input.result, null, 2)}\n`);
  writeFileSync(
    join(caseDir, "checks.json"),
    `${JSON.stringify(input.result.checks ?? [], null, 2)}\n`,
  );
  writeFileSync(join(caseDir, "runner.stderr.log"), input.stderr);

  for (const name of [
    "task.md",
    "expected.json",
    "scenario.json",
    "success_criteria.js",
    "semantic_criteria.md",
    "semantic_controls.json",
  ]) {
    if (existsSync(join(input.scenarioDir, name)))
      copyFileSync(join(input.scenarioDir, name), join(caseDir, name));
  }
  if (existsSync(join(input.scenarioDir, "environment"))) {
    cpSync(
      join(input.scenarioDir, "environment"),
      join(caseDir, "environment"),
      { recursive: true },
    );
  }

  const artifactName = input.suite.artifact ?? "alignment-decision.json";
  const artifactPath = copyIfPresent(
    input.result.work_dir
      ? join(input.result.work_dir, artifactName)
      : undefined,
    join(caseDir, basename(artifactName)),
  );
  const transcriptPath = copyIfPresent(
    input.result.work_dir
      ? join(input.result.work_dir, "transcript.jsonl")
      : undefined,
    join(caseDir, "transcript.jsonl"),
  );

  const sessionArchive = join(caseDir, "session");
  if (input.result.session_path && existsSync(input.result.session_path)) {
    cpSync(input.result.session_path, sessionArchive, { recursive: true });
  }

  if (input.result.gym_root) {
    const semanticJudges = join(input.result.gym_root, "semantic-judges");
    if (existsSync(semanticJudges)) {
      cpSync(semanticJudges, join(caseDir, "semantic-judges"), {
        recursive: true,
      });
    }
    copyIfPresent(
      join(input.result.gym_root, "semantic-evaluation.json"),
      join(caseDir, "semantic-evaluation.json"),
    );
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
    transcript_path: transcriptPath
      ? relative(input.runDir, transcriptPath)
      : null,
    duration_ms: input.result.duration_ms ?? null,
    provenance: {
      prompt_fingerprint: input.result.prompt_hash ?? null,
      framework_revision: input.result.framework_sha ?? null,
      model: input.result.model ?? null,
    },
  };
  writeFileSync(
    join(caseDir, "evaluation.json"),
    `${JSON.stringify(stored, null, 2)}\n`,
  );
  return stored;
}

export function appendAdjudication(
  runDir: string,
  adjudication: HumanAdjudication,
): void {
  appendFileSync(
    join(runDir, "reviews.jsonl"),
    `${JSON.stringify(adjudication)}\n`,
  );
}

export function readAdjudications(runDir: string): HumanAdjudication[] {
  const path = join(runDir, "reviews.jsonl");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as HumanAdjudication);
}
