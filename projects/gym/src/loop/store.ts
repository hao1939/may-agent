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
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";

import {
  parseComparisonObjective,
  type ComparisonObjective,
} from "./objective";
import {
  readBenchmark,
  resolveBenchmarkName,
  legacyCasesDirectory,
} from "../cases/catalog";

import type {
  BenchmarkSuite,
  GroundTruthCatalog,
  GroundTruthLabel,
  HumanAdjudication,
  InlineBenchmarkCase,
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

export function benchmarkDir(benchmark: string, root = gymRoot): string {
  return join(root, "benchmarks", resolveBenchmarkName(root, benchmark));
}

/**
 * Resolve an agent directory by name across `agentsRoot` (`/app/agents`) and
 * optional `projectsRoot` (`/app/projects/*.app/agents/*`).
 */
export function resolveGymAgentDir(
  agentsRoot: string,
  agentName: string,
  projectsRoot?: string,
): string | null {
  const trimmed = agentName.trim();
  if (!trimmed) return null;

  const directCandidate = join(agentsRoot, trimmed);
  if (existsSync(join(directCandidate, "agent.json"))) return directCandidate;

  if (!projectsRoot || !existsSync(projectsRoot)) return null;

  for (const entry of readdirSync(projectsRoot).sort()) {
    if (!entry.endsWith(".app")) continue;
    const appDir = join(projectsRoot, entry);
    try {
      if (!lstatSync(appDir).isDirectory()) continue;
    } catch {
      continue;
    }
    if (existsSync(join(appDir, ".disabled"))) continue;
    const appAgentsDir = join(appDir, "agents");
    if (!existsSync(appAgentsDir)) continue;

    const byFolder = join(appAgentsDir, trimmed);
    if (existsSync(join(byFolder, "agent.json"))) return byFolder;

    for (const child of readdirSync(appAgentsDir).sort()) {
      const candidateDir = join(appAgentsDir, child);
      const configPath = join(candidateDir, "agent.json");
      if (!existsSync(configPath)) continue;
      try {
        const parsed = JSON.parse(readFileSync(configPath, "utf8")) as {
          name?: unknown;
        };
        if (parsed.name === trimmed) return candidateDir;
      } catch {
        // Ignore malformed unrelated agent configs.
      }
    }
  }
  return null;
}

/**
 * Resolve a `.lab/<labFork>` candidate directory across `agentsRoot/.lab/<labFork>`
 * or `<resolvedAgentParent>/.lab/<labFork>`.
 */
export function resolveGymLabDir(
  agentsRoot: string,
  labFork: string,
  agentName?: string,
  projectsRoot?: string,
): string | null {
  const primary = join(agentsRoot, ".lab", labFork);
  if (existsSync(primary)) return primary;
  if (agentName) {
    const resolvedAgent = resolveGymAgentDir(
      agentsRoot,
      agentName,
      projectsRoot,
    );
    if (resolvedAgent) {
      const appLab = join(dirname(resolvedAgent), ".lab", labFork);
      if (existsSync(appLab)) return appLab;
    }
  }
  return null;
}

const SEMANTIC_SCENARIO_FILES = [
  "semantic_criteria.md",
  "semantic_controls.json",
] as const;

const CONTROLLED_HARNESS_PATHS = [
  "src/cli.ts",
  "src/model-registry.ts",
  "src/workflow-adapter.ts",
  "src/loop",
  "src/scoring",
  "src/scenarios", // Compatibility readers for retained inputs.
  "src/cases",
  "dist/@may-agent/gym/scoring.js",
  "benchmarks/compatibility.json",
  "benchmarks/intent-and-follow-through/score-decision.cjs",
  "benchmarks/outcome-coordination/score-task-result.cjs",
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

export function loadSuite(
  benchmark: string,
  adhocScenarios?: string[],
  root = gymRoot,
): {
  suite: BenchmarkSuite;
  path: string;
} {
  const path = join(benchmarkDir(benchmark, root), "suite.json");
  if (!existsSync(path) && adhocScenarios?.length && benchmark === "adhoc") {
    // Retained diagnostic fixtures may still have the old unowned layout.
    // The live CLI never synthesizes active ownership from an archived case.
    return {
      suite: { name: "adhoc-v1", version: 1, scenarios: [...adhocScenarios] },
      path,
    };
  }
  const { suite } = readBenchmark(root, benchmark);
  if (suite.core_scenarios !== undefined) selectCoreScenarios(suite);
  return { suite, path };
}

export function selectCoreScenarios(suite: BenchmarkSuite): string[] {
  const selected = suite.core_cases ?? suite.core_scenarios;
  if (
    !Array.isArray(selected) ||
    selected.length === 0 ||
    new Set(selected).size !== selected.length ||
    selected.some((id) => !suite.scenarios.includes(id))
  ) {
    throw new Error(
      `Benchmark ${suite.name} needs a nonempty, unique core_cases selection (legacy core_scenarios) from its cases`,
    );
  }
  return [...selected];
}

export const selectCoreCases = selectCoreScenarios;

export function isApprovedLabel(label: GroundTruthLabel | undefined): boolean {
  return (
    label?.status === "approved" &&
    typeof label.approved_by === "string" &&
    label.approved_by.trim().length > 0 &&
    typeof label.approved_at === "string" &&
    Number.isFinite(Date.parse(label.approved_at))
  );
}

export function loadLabels(
  benchmark: string,
  suite: BenchmarkSuite,
  root = gymRoot,
): { catalog: GroundTruthCatalog | null; path: string | null } {
  benchmark = resolveBenchmarkName(root, benchmark);
  const path = join(
    benchmarkDir(benchmark, root),
    suite.labels_file ?? "labels.json",
  );
  let catalog: GroundTruthCatalog | null = null;
  let resolvedPath: string | null = null;
  if (existsSync(path)) {
    catalog = JSON.parse(readFileSync(path, "utf-8")) as GroundTruthCatalog;
    if (catalog.benchmark !== benchmark) {
      throw new Error(
        `Label catalog benchmark mismatch: expected ${benchmark}, found ${catalog.benchmark}`,
      );
    }
    resolvedPath = path;
  } else {
    catalog = {
      version: suite.version || 1,
      benchmark,
      labels: {},
    };
  }

  if (catalog && Array.isArray(suite.cases)) {
    for (const c of suite.cases) {
      if (!c.id || catalog.labels[c.id]) continue;
      const status = c.label?.status ?? "draft";
      catalog.labels[c.id] = {
        status,
        source: c.label?.source ?? "synthetic",
        rationale:
          c.label?.rationale ??
          c.description ??
          (typeof c.expected?.human_answer === "string"
            ? c.expected.human_answer
            : `Inline case ${c.id}`),
        approved_by: c.label?.approved_by ?? null,
        approved_at: c.label?.approved_at ?? null,
        ...(c.label?.review_status
          ? { review_status: c.label.review_status }
          : {}),
      };
    }
  }

  // Runnable cases are diagnostic inputs until their truth is explicitly approved.
  if (catalog) {
    for (const s of suite.scenarios) {
      if (catalog.labels[s]) continue;
      catalog.labels[s] = {
        status: "draft",
        source: "synthetic",
        rationale: `Unreviewed case ${s}`,
        approved_by: null,
        approved_at: null,
      };
    }
    for (const [scenario, label] of Object.entries(catalog.labels)) {
      if (label.status === "approved" && !isApprovedLabel(label)) {
        throw new Error(
          `Invalid approval metadata for ${benchmark}/${scenario}: approved labels require a reviewer and valid timestamp`,
        );
      }
    }
  }

  return { catalog, path: resolvedPath };
}

export function materializeScenarioOrInlineCase(input: {
  scenario: string;
  suite: BenchmarkSuite;
  sourceBenchmarkDir: string;
  evaluatorOwner: string | null;
  destination: string;
}): void {
  if (input.suite.case_ids && !input.suite.scenarios.includes(input.scenario))
    throw new Error(`Case ${input.scenario} is not in this benchmark`);
  const inlineCase = input.suite.cases?.find((c) => c.id === input.scenario);
  const local = join(input.sourceBenchmarkDir, "cases", input.scenario);
  const source = existsSync(local)
    ? local
    : !input.suite.case_ids && !input.suite.purpose
      ? join(legacyCasesDirectory(gymRoot), input.scenario)
      : local;
  if (!inlineCase && existsSync(source)) {
    cpSync(source, input.destination, { recursive: true });
  } else if (!inlineCase) {
    throw new Error(`Case not found in its benchmark: ${source}`);
  }

  // Git does not retain empty directories. An absent local environment means
  // an empty fixture, just like an inline case with no files.
  mkdirSync(join(input.destination, "environment"), { recursive: true });
  if (inlineCase) {
    const defaults = input.suite.defaults ?? {};
    const scenarioMeta = {
      name: inlineCase.id,
      ...(inlineCase.description
        ? { description: inlineCase.description }
        : {}),
      categories: inlineCase.categories ?? defaults.categories ?? ["judgment"],
      tags: inlineCase.tags ?? defaults.tags ?? ["inline-case"],
      tier: inlineCase.tier ?? defaults.tier ?? "smoke",
      timeout: inlineCase.timeout ?? defaults.timeout ?? 5,
      agent_type: inlineCase.agent_type ?? defaults.agent_type ?? "may",
      workflow: false,
      ...((inlineCase.evaluation_kind ?? input.suite.evaluation_kind)
        ? {
            evaluation_kind:
              inlineCase.evaluation_kind ?? input.suite.evaluation_kind,
          }
        : {}),
      ...((inlineCase.output_contract ?? defaults.output_contract)
        ? {
            output_contract:
              inlineCase.output_contract ?? defaults.output_contract,
          }
        : {}),
      ...(inlineCase.workflow_entry
        ? { workflow_entry: inlineCase.workflow_entry }
        : {}),
    };
    writeFileSync(
      join(input.destination, "case.json"),
      `${JSON.stringify(scenarioMeta, null, 2)}\n`,
    );

    const stateSection = inlineCase.state?.trim()
      ? `\n\n${inlineCase.state.trim()}`
      : "";
    const taskSuffix = defaults.task_suffix
      ? `\n\n${defaults.task_suffix.trim()}`
      : "";
    writeFileSync(
      join(input.destination, "task.md"),
      `${inlineCase.task.trim()}${stateSection}${taskSuffix}\n`,
    );

    if (inlineCase.files) {
      for (const [relPath, content] of Object.entries(inlineCase.files)) {
        if (isAbsolute(relPath) || relPath.split(/[\\/]/).includes(".."))
          throw new Error(
            `Fixture path escapes case ${input.scenario}: ${relPath}`,
          );
        const fileDest = join(input.destination, "environment", relPath);
        mkdirSync(dirname(fileDest), { recursive: true });
        writeFileSync(fileDest, content);
      }
    }
    if (inlineCase.expected) {
      writeFileSync(
        join(input.destination, "expected.json"),
        `${JSON.stringify(inlineCase.expected, null, 2)}\n`,
      );
    }
    if (inlineCase.semantic_criteria) {
      writeFileSync(
        join(input.destination, "semantic_criteria.md"),
        `${inlineCase.semantic_criteria.trim()}\n`,
      );
    }
    if (inlineCase.semantic_controls) {
      writeFileSync(
        join(input.destination, "semantic_controls.json"),
        `${JSON.stringify(inlineCase.semantic_controls, null, 2)}\n`,
      );
    }
  }

  if (!input.suite.purpose && !input.suite.case_ids) {
    // Historical reconstruction only. Active case expectations never come
    // from another benchmark just because it owns a shared evaluator.
    applyEvaluatorScenarioOverlay({
      sourceBenchmarkDir: input.sourceBenchmarkDir,
      evaluatorOwner: input.evaluatorOwner,
      scenario: input.scenario,
      destination: input.destination,
    });
  }

  // Bind expected-only cases to their selected evaluator, not a live default.
  // The relative layout is inputs/cases/<id> -> inputs/benchmarks/<suite>.
  if (input.suite.evaluator) {
    writeFileSync(
      join(input.destination, ".gym-evaluator.json"),
      `${JSON.stringify(
        {
          path: join(
            "../../benchmarks",
            basename(input.sourceBenchmarkDir),
            input.suite.evaluator,
          ),
        },
        null,
        2,
      )}\n`,
    );
  }
  if (input.suite.evaluation_kind) {
    const metaPath = existsSync(join(input.destination, "case.json"))
      ? join(input.destination, "case.json")
      : join(input.destination, "scenario.json");
    if (existsSync(metaPath)) {
      const meta = JSON.parse(readFileSync(metaPath, "utf8"));
      if (!meta.evaluation_kind) {
        writeFileSync(
          metaPath,
          `${JSON.stringify({ ...meta, evaluation_kind: input.suite.evaluation_kind }, null, 2)}\n`,
        );
      }
    }
  }
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
  labelsCatalog?: GroundTruthCatalog | null;
  baselineRunId?: string;
  objective?: ComparisonObjective;
  candidate: string;
  agent: string;
  trials: number;
  scenarios: string[];
  candidateFingerprint: string | null;
  candidatePath: string | null;
}): { manifest: LoopRunManifest; runDir: string } {
  const objective = parseComparisonObjective(input.objective);
  const runId = `${safeName(input.benchmark)}-${input.phase}-${timestampId()}-${crypto.randomUUID().slice(0, 8)}`;
  const runDir = join(stateRoot(), "benchmarks", runId);
  mkdirSync(join(runDir, "cases"), { recursive: true });
  const inputsDir = join(runDir, "inputs");
  mkdirSync(inputsDir, { recursive: true });
  writeFileSync(
    join(inputsDir, "comparison-objective.json"),
    `${JSON.stringify(objective, null, 2)}\n`,
  );
  const sourceBenchmarkDir = benchmarkDir(input.benchmark);
  const frozenBenchmarkDir = join(
    inputsDir,
    "benchmarks",
    safeName(input.benchmark),
  );
  mkdirSync(frozenBenchmarkDir, { recursive: true });
  if (existsSync(sourceBenchmarkDir)) {
    cpSync(sourceBenchmarkDir, frozenBenchmarkDir, { recursive: true });
  }
  const suiteSnapshot = existsSync(input.suitePath)
    ? join(frozenBenchmarkDir, relative(sourceBenchmarkDir, input.suitePath))
    : join(frozenBenchmarkDir, "suite.json");
  if (!existsSync(suiteSnapshot)) {
    writeFileSync(suiteSnapshot, `${JSON.stringify(input.suite, null, 2)}\n`);
  }
  const effectiveCatalog = input.labelsCatalog ?? null;
  const labelsSnapshot = input.labelsPath
    ? join(frozenBenchmarkDir, relative(sourceBenchmarkDir, input.labelsPath))
    : effectiveCatalog
      ? join(frozenBenchmarkDir, "labels.json")
      : null;
  if (
    labelsSnapshot &&
    (!input.labelsPath || Array.isArray(input.suite.cases)) &&
    effectiveCatalog
  ) {
    writeFileSync(
      labelsSnapshot,
      `${JSON.stringify(effectiveCatalog, null, 2)}\n`,
    );
  }
  const evaluatorSource = input.suite.evaluator
    ? join(sourceBenchmarkDir, input.suite.evaluator)
    : null;
  if (evaluatorSource && !existsSync(evaluatorSource)) {
    throw new Error(
      `Evaluator not found: ${evaluatorSource}; run the Gym build before starting trials`,
    );
  }
  const evaluatorSnapshot =
    evaluatorSource && existsSync(evaluatorSource)
      ? join(frozenBenchmarkDir, input.suite.evaluator!)
      : null;
  if (evaluatorSource && evaluatorSnapshot && !existsSync(evaluatorSnapshot)) {
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
  const scenariosSnapshot = join(inputsDir, "cases");
  const evaluatorOwner = evaluatorSource ? dirname(evaluatorSource) : null;
  for (const scenario of input.scenarios) {
    const snapshot = join(scenariosSnapshot, safeName(scenario));
    materializeScenarioOrInlineCase({
      scenario,
      suite: input.suite,
      sourceBenchmarkDir,
      evaluatorOwner,
      destination: snapshot,
    });
  }
  const usesSemanticJudges = input.scenarios.some((scenario) =>
    existsSync(
      join(scenariosSnapshot, safeName(scenario), "semantic_criteria.md"),
    ),
  );
  if (usesSemanticJudges) {
    if (!existsSync(semanticJudgesSource)) {
      throw new Error(
        "Semantic benchmark has no semantic judge agent definitions",
      );
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
    comparison_objective: objective,
    candidate: input.candidate,
    agent: input.agent,
    trials_per_scenario: input.trials,
    scenarios: input.scenarios,
    evaluation_kinds: Object.fromEntries(
      input.scenarios.map((scenario) => {
        const caseRoot = join(scenariosSnapshot, safeName(scenario));
        const metaPath = existsSync(join(caseRoot, "case.json"))
          ? join(caseRoot, "case.json")
          : join(caseRoot, "scenario.json");
        const kind = existsSync(metaPath)
          ? JSON.parse(readFileSync(metaPath, "utf8")).evaluation_kind
          : null;
        if (kind != null && kind !== "judgment" && kind !== "behavior") {
          throw new Error(`Unknown evaluation kind for ${scenario}: ${kind}`);
        }
        return [scenario, kind ?? null];
      }),
    ),
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
    return {
      verdict: "invalid",
      reason: "scorer returned a nonboolean overall verdict",
    };
  }
  if (!Array.isArray(result.checks) || result.checks.length === 0) {
    return { verdict: "invalid", reason: "scorer returned no checks" };
  }
  if (
    result.checks.some(
      (check) =>
        !check ||
        typeof check.name !== "string" ||
        typeof check.passed !== "boolean",
    )
  ) {
    return {
      verdict: "invalid",
      reason: "scorer returned a malformed check verdict",
    };
  }
  const failedRequiredCheck = result.checks.find(
    (check) => check.gate !== false && !check.passed,
  );
  if (result.passed && failedRequiredCheck) {
    return {
      verdict: "invalid",
      reason: `scorer overall pass contradicts required check ${failedRequiredCheck.name}`,
    };
  }
  if (!result.passed && !failedRequiredCheck) {
    return {
      verdict: "invalid",
      reason: "scorer overall failure has no failed required check",
    };
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
    "case.json",
    "scenario.json", // Historical input compatibility.
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

  // Preserve actual outputs before the temporary sandbox is removed. Do not
  // confuse this with environment/, which is the original fixture input.
  const workspacePath =
    input.result.work_dir && existsSync(input.result.work_dir)
      ? join(caseDir, "workspace")
      : null;
  if (workspacePath && input.result.work_dir) {
    cpSync(input.result.work_dir, workspacePath, { recursive: true });
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
    workspace_path: workspacePath
      ? relative(input.runDir, workspacePath)
      : null,
    duration_ms: input.result.duration_ms ?? null,
    ...(input.result.usage !== undefined ? { usage: input.result.usage } : {}),
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
