import { createHash } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import {
  configureGymRoot,
  resolveLearningContexts,
  runLoop,
  verifyLoop,
  type LearningUnitContext,
  type LoopRunManifest,
  type RunComparison,
  type RunOptions,
} from "@may-agent/gym/loop";
import { Type } from "@earendil-works/pi-ai";
import type {
  ProjectAppConditionSpec,
  ProjectAppTaskAction,
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk";
import { reconciliationPacket, safeKey, triggerDetails } from "./lib/trigger";

export const name = "improve-agent";
export const description =
  "Evaluate May, classify each finding, and iterate one isolated candidate at a time until progress stops or one verified proposal is ready.";
export const workspace = "shared";

const RELEASE_TRIALS = 5;

type FindingClass = "agent" | "benchmark" | "scorer" | "runtime" | "noise";

export interface Finding {
  classification: FindingClass;
  scenarios: string[];
  failureFamily?: string;
  summary: string;
  evidence: string[];
}

export interface Assessment {
  schema_version: 1;
  agent: string;
  benchmark: string;
  release_benchmark: string;
  release_scenarios: string[];
  screening_run_id: string;
  screening_run_dir: string;
  retry_run_id: string | null;
  retry_run_dir: string | null;
  findings: Finding[];
  focus: Finding | null;
  baseline_run_id: string | null;
  baseline_run_dir: string | null;
  accepted_at: string;
}

interface CandidatePlan {
  agent: string;
  benchmark: string;
  releaseBenchmark: string;
  releaseScenarios: string[];
  baselineRunId: string;
  baselineDir: string;
  focus: Finding;
  assessmentPath: string;
  learningUnits: LearningUnitContext[];
  revision?: {
    summary: string;
    proposedChange: string;
    evidence: string[];
    previousVerificationDir: string;
    previousCandidateFingerprint: string;
  };
}

interface VerificationCheckpoint {
  runDir: string;
  manifest: LoopRunManifest;
  comparison: RunComparison;
}

interface FailedReview {
  disposition:
    | "revise-candidate"
    | "review-benchmark"
    | "review-scorer"
    | "review-runtime"
    | "needs-human";
  summary: string;
  proposedChange: string;
  evidence: string[];
}

interface StoredResult {
  summary: string;
  state: "converged" | "waiting" | "needs-owner";
  evidence: string[];
  actions: ProjectAppTaskAction[];
  conditions: ProjectAppConditionSpec[];
  approval: ApprovalRequest | null;
}

interface OperatingMetricsState {
  schema_version: 1;
  updated_at: string;
  recorded_sample_ids: string[];
  valid_run_rate: number | null;
  total_model_trials: number;
  total_model_runtime_ms: number;
  latest_classification_ms: number | null;
  proposals_accepted: number;
  regressions_prevented: number;
}

interface OperatingMetricSample {
  id: string;
  stage: "assessment" | "verification" | "approval";
  validRunRate?: number;
  modelTrials?: number;
  modelRuntimeMs?: number;
  classificationMs?: number;
  proposalAccepted?: boolean;
  regressionPrevented?: boolean;
  evidence: string[];
}

export interface CurriculumTarget {
  id: string;
  benchmark: string;
  scenarios: string[];
  trials: number;
}

interface TrainingDrainCheckpoint {
  schema_version: 1;
  agent: string;
  curriculum_fingerprint: string;
  agent_fingerprint: string;
  exhausted_at: string;
  targets: string[];
  evidence: string[];
}

type ApprovalKind = "agent-improvement" | "benchmark-fix";

interface ApprovalRequest {
  kind: ApprovalKind;
  approvalId: string;
  waitId: string;
  taskId: string;
  taskGeneration: number;
  artifactFingerprint: string;
  packetPath: string;
  requestedAction: string;
  reason: string;
  condition: ProjectAppConditionSpec;
}

export interface GymLoopApi {
  run(
    options: RunOptions,
  ): Promise<{ runDir: string; manifest: LoopRunManifest }>;
  verify(input: {
    baseline: string;
    candidate: string;
    trials?: number;
    timeout?: number;
    agentsRoot?: string;
  }): ReturnType<typeof verifyLoop>;
}

const defaultLoopApi: GymLoopApi = {
  run: (options) => runLoop(options),
  verify: (input) => verifyLoop(input),
};

const findingSchema = Type.Object(
  {
    classification: Type.Union([
      Type.Literal("agent"),
      Type.Literal("benchmark"),
      Type.Literal("scorer"),
      Type.Literal("runtime"),
      Type.Literal("noise"),
    ]),
    scenarios: Type.Array(Type.String({ minLength: 1 }), {
      minItems: 1,
      maxItems: 32,
    }),
    failureFamily: Type.Optional(
      Type.String({
        minLength: 1,
        maxLength: 80,
        pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
      }),
    ),
    summary: Type.String({ minLength: 1, maxLength: 1_000 }),
    evidence: Type.Array(Type.String({ minLength: 1 }), { maxItems: 16 }),
  },
  { additionalProperties: false },
);

const findingsSchema = Type.Object(
  {
    findings: Type.Array(findingSchema, { maxItems: 32 }),
  },
  { additionalProperties: false },
);

const implementationSchema = Type.Object(
  {
    summary: Type.String({ minLength: 1, maxLength: 1_000 }),
    changedFiles: Type.Array(Type.String({ minLength: 1 }), { maxItems: 32 }),
    evidence: Type.Array(Type.String({ minLength: 1 }), { maxItems: 16 }),
  },
  { additionalProperties: false },
);

const failedReviewSchema = Type.Object(
  {
    disposition: Type.Union([
      Type.Literal("revise-candidate"),
      Type.Literal("review-benchmark"),
      Type.Literal("review-scorer"),
      Type.Literal("review-runtime"),
      Type.Literal("needs-human"),
    ]),
    summary: Type.String({ minLength: 1, maxLength: 1_000 }),
    proposedChange: Type.String({ minLength: 1, maxLength: 2_000 }),
    evidence: Type.Array(Type.String({ minLength: 1 }), { maxItems: 16 }),
  },
  { additionalProperties: false },
);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeName(value: unknown, fallback: string): string | null {
  const name = String(value ?? fallback).trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) ? name : null;
}

function safeRunId(value: unknown): string | null {
  const id = String(value ?? "").trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) ? id : null;
}

function requestedTrials(value: unknown): number {
  const count = Number(value ?? 3);
  if (!Number.isInteger(count) || count < 1 || count > 5) {
    throw new Error("trials must be an integer from 1 through 5");
  }
  return count;
}

function requestedScenarios(input: Record<string, unknown>): string[] {
  const raw = Array.isArray(input.scenarios)
    ? input.scenarios
    : input.scenario
      ? [input.scenario]
      : [];
  return raw.map((value) => {
    const scenario = safeName(value, "");
    if (!scenario) throw new Error("scenario contains unsupported characters");
    return scenario;
  });
}

export function loadCurriculumTargets(gymRoot: string): {
  targets: CurriculumTarget[];
  fingerprint: string;
} {
  const configPath = join(
    gymRoot,
    "benchmarks",
    "may-learning",
    "autonomous-training.json",
  );
  const config = record(JSON.parse(readFileSync(configPath, "utf8")));
  if (config.schema_version !== 1 || config.agent !== "may") {
    throw new Error("Autonomous May training config is invalid");
  }
  const rows = Array.isArray(config.tracks) ? config.tracks : [];
  const targets = rows.map((value) => {
    const row = record(value);
    const id = safeName(row.id, "");
    const benchmark = safeName(row.benchmark, "");
    const scenarios = Array.isArray(row.scenarios)
      ? row.scenarios.map((scenario) => safeName(scenario, ""))
      : [];
    const trials = Number(row.trials);
    if (
      !id ||
      !benchmark ||
      !scenarios.length ||
      scenarios.some((scenario) => !scenario) ||
      !Number.isInteger(trials) ||
      trials < 1 ||
      trials > 5
    ) {
      throw new Error("Autonomous May training track is invalid");
    }
    const benchmarkDir = join(gymRoot, "benchmarks", benchmark);
    const suite = record(
      JSON.parse(readFileSync(join(benchmarkDir, "suite.json"), "utf8")),
    );
    const labels = record(
      record(
        JSON.parse(
          readFileSync(
            join(benchmarkDir, String(suite.labels_file ?? "labels.json")),
            "utf8",
          ),
        ),
      ).labels,
    );
    const approvedScenarios = (
      Array.isArray(suite.scenarios) ? suite.scenarios : []
    )
      .filter(
        (scenario) => record(labels[String(scenario)]).status === "approved",
      )
      .map(String);
    const configured = new Set(scenarios as string[]);
    const missing = approvedScenarios.filter(
      (scenario) => !configured.has(scenario),
    );
    if (missing.length) {
      throw new Error(
        `Autonomous May training track ${id} omits approved scenarios: ${missing.join(", ")}`,
      );
    }
    return {
      id,
      benchmark,
      scenarios: scenarios as string[],
      trials,
    };
  });
  if (
    !targets.length ||
    new Set(targets.map(({ id }) => id)).size !== targets.length
  ) {
    throw new Error(
      "Autonomous May training tracks must be non-empty and unique",
    );
  }

  const hash = createHash("sha256");
  hash.update(readFileSync(configPath));
  for (const target of targets) {
    hash.update(target.id);
    hash.update(fingerprintTree(join(gymRoot, "benchmarks", target.benchmark)));
    for (const scenario of target.scenarios) {
      hash.update(fingerprintTree(join(gymRoot, "scenarios", scenario)));
    }
  }
  return { targets, fingerprint: `sha256:${hash.digest("hex")}` };
}

export async function runCurriculumSequence<T extends Record<string, unknown>>(
  targets: CurriculumTarget[],
  runTarget: (target: CurriculumTarget) => Promise<T>,
): Promise<
  | { state: "exhausted"; results: T[] }
  | { state: "stopped"; result: T; results: T[] }
> {
  const results: T[] = [];
  for (const target of targets) {
    const result = await runTarget(target);
    results.push(result);
    const output = record(result.output);
    const state = String(output.state ?? result.state ?? "");
    const summary = String(output.summary ?? result.summary ?? "");
    if (
      state !== "converged" ||
      summary !==
        "May has no actionable failures in the current approved evaluation."
    ) {
      return { state: "stopped", result, results };
    }
  }
  return { state: "exhausted", results };
}

export function learningPromptLines(units: LearningUnitContext[]): string[] {
  if (!units.length) return [];
  return [
    "Use these reviewed learning resources to generalize the candidate. Do not copy benchmark-specific names or expected answer wording into the agent:",
    ...units.flatMap((unit) => [
      `Learning unit: ${unit.id} v${unit.version} — ${unit.title}`,
      `Competencies: ${unit.competencies.join(", ")}`,
      `Lesson: ${unit.lessonPath}`,
      `Practice: ${unit.practicePath}`,
      `Reviewed evidence: ${unit.evidencePath}`,
      `Canonical sources: ${unit.sourcePaths.join(", ")}`,
    ]),
  ];
}

function readManifest(runDir: string): LoopRunManifest {
  return JSON.parse(
    readFileSync(join(runDir, "manifest.json"), "utf8"),
  ) as LoopRunManifest;
}

export function scenarioVerdicts(manifest: LoopRunManifest): {
  pass: string[];
  fail: string[];
  invalid: string[];
} {
  const verdicts = new Map<string, Set<string>>();
  for (const trial of manifest.trials) {
    const current = verdicts.get(trial.scenario) ?? new Set<string>();
    current.add(trial.machine_verdict);
    verdicts.set(trial.scenario, current);
  }
  const result = {
    pass: [] as string[],
    fail: [] as string[],
    invalid: [] as string[],
  };
  for (const scenario of manifest.scenarios) {
    const observed = verdicts.get(scenario) ?? new Set<string>();
    if (observed.has("invalid") || observed.size === 0)
      result.invalid.push(scenario);
    else if (observed.has("fail")) result.fail.push(scenario);
    else result.pass.push(scenario);
  }
  return result;
}

function approvalGate(
  gymRoot: string,
  benchmark: string,
  requested: string[],
): { scenarios: string[]; labelsPath: string; unapproved: string[] } {
  const benchmarkDir = join(gymRoot, "benchmarks", benchmark);
  const suite = record(
    JSON.parse(readFileSync(join(benchmarkDir, "suite.json"), "utf8")),
  );
  const suiteScenarios = Array.isArray(suite.scenarios)
    ? suite.scenarios.map(String)
    : [];
  if (!suiteScenarios.length) throw new Error(`${benchmark} has no scenarios`);
  const scenarios = requested.length ? requested : suiteScenarios;
  const unknown = scenarios.filter(
    (scenario) => !suiteScenarios.includes(scenario),
  );
  if (unknown.length) {
    throw new Error(`Scenarios are not in ${benchmark}: ${unknown.join(", ")}`);
  }
  const labelsPath = join(
    benchmarkDir,
    typeof suite.labels_file === "string" ? suite.labels_file : "labels.json",
  );
  const labels = record(
    record(JSON.parse(readFileSync(labelsPath, "utf8"))).labels,
  );
  const unapproved = scenarios.filter((scenario) => {
    const label = record(labels[scenario]);
    return (
      label.status !== "approved" ||
      !String(label.approved_by ?? "").trim() ||
      !String(label.approved_at ?? "").trim()
    );
  });
  return { scenarios, labelsPath, unapproved };
}

export function validateFindings(
  findings: Finding[],
  scenarios: string[],
): string[] {
  const problems: string[] = [];
  const expected = new Set(scenarios);
  const seen = new Set<string>();
  for (const finding of findings) {
    if (finding.classification === "agent" && !finding.failureFamily) {
      problems.push(`agent finding lacks failureFamily: ${finding.summary}`);
    }
    for (const scenario of finding.scenarios) {
      if (!expected.has(scenario))
        problems.push(`unexpected scenario: ${scenario}`);
      if (seen.has(scenario))
        problems.push(`scenario classified twice: ${scenario}`);
      seen.add(scenario);
    }
  }
  for (const scenario of expected) {
    if (!seen.has(scenario))
      problems.push(`scenario was not classified: ${scenario}`);
  }
  return problems;
}

function writeAssessment(path: string, assessment: Assessment): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(assessment, null, 2)}\n`);
}

function recordOperatingMetrics(
  ctx: WorkflowContext,
  sample: OperatingMetricSample,
): void {
  const metricsDir = join(ctx.projectsRoot, "gym.app", ".state", "metrics");
  const statePath = join(metricsDir, "autonomous-improvement.json");
  const journalPath = join(metricsDir, "autonomous-improvement.jsonl");
  mkdirSync(metricsDir, { recursive: true });
  const existing = readJson<OperatingMetricsState>(statePath);
  const state: OperatingMetricsState = existing ?? {
    schema_version: 1,
    updated_at: new Date(0).toISOString(),
    recorded_sample_ids: [],
    valid_run_rate: null,
    total_model_trials: 0,
    total_model_runtime_ms: 0,
    latest_classification_ms: null,
    proposals_accepted: 0,
    regressions_prevented: 0,
  };
  if (state.recorded_sample_ids.includes(sample.id)) return;

  state.recorded_sample_ids.push(sample.id);
  state.updated_at = new Date().toISOString();
  if (sample.validRunRate !== undefined) {
    state.valid_run_rate = sample.validRunRate;
  }
  state.total_model_trials += sample.modelTrials ?? 0;
  state.total_model_runtime_ms += sample.modelRuntimeMs ?? 0;
  if (sample.classificationMs !== undefined) {
    state.latest_classification_ms = sample.classificationMs;
  }
  if (sample.proposalAccepted) state.proposals_accepted += 1;
  if (sample.regressionPrevented) state.regressions_prevented += 1;

  appendFileSync(
    journalPath,
    `${JSON.stringify({
      schema_version: 1,
      recorded_at: state.updated_at,
      ...sample,
    })}\n`,
  );
  writeJson(statePath, state);

  const metrics = ctx.metrics;
  if (!metrics) return;
  try {
    metrics.defineMany([
      {
        id: "gym.valid-run-rate",
        name: "Gym valid run rate",
        owner: "gym",
        project: "gym",
        type: "gauge",
        target: 1,
        threshold: 0.95,
        alertOp: "<",
        unit: "ratio",
        priority: "P1",
      },
      {
        id: "gym.model-trials",
        name: "Gym cumulative model trials",
        owner: "gym",
        project: "gym",
        type: "counter",
        unit: "trials",
        priority: "P2",
      },
      {
        id: "gym.model-runtime-ms",
        name: "Gym cumulative model runtime",
        owner: "gym",
        project: "gym",
        type: "counter",
        unit: "ms",
        priority: "P2",
      },
      {
        id: "gym.time-to-classification-ms",
        name: "Gym time to classification",
        owner: "gym",
        project: "gym",
        type: "gauge",
        unit: "ms",
        priority: "P2",
      },
      {
        id: "gym.proposals-accepted",
        name: "Gym accepted proposals",
        owner: "gym",
        project: "gym",
        type: "counter",
        unit: "proposals",
        priority: "P1",
      },
      {
        id: "gym.regressions-prevented",
        name: "Gym regressions prevented",
        owner: "gym",
        project: "gym",
        type: "counter",
        unit: "candidates",
        priority: "P1",
      },
    ]);
    if (state.valid_run_rate !== null) {
      metrics.record("gym.valid-run-rate", state.valid_run_rate, {
        measuredBy: "gym-improve-agent",
        note: sample.id,
      });
    }
    metrics.record("gym.model-trials", state.total_model_trials, {
      measuredBy: "gym-improve-agent",
      note: "Model-trial cost proxy; token accounting is not exposed by the runner.",
    });
    metrics.record("gym.model-runtime-ms", state.total_model_runtime_ms, {
      measuredBy: "gym-improve-agent",
      note: "Model-runtime cost proxy; token accounting is not exposed by the runner.",
    });
    if (state.latest_classification_ms !== null) {
      metrics.record(
        "gym.time-to-classification-ms",
        state.latest_classification_ms,
        { measuredBy: "gym-improve-agent", note: sample.id },
      );
    }
    metrics.record("gym.proposals-accepted", state.proposals_accepted, {
      measuredBy: "gym-improve-agent",
      note: sample.id,
    });
    metrics.record("gym.regressions-prevented", state.regressions_prevented, {
      measuredBy: "gym-improve-agent",
      note: sample.id,
    });
  } catch {
    // Durable app evidence remains authoritative if the metric sink is unavailable.
  }
}

function recordAssessmentMetrics(
  ctx: WorkflowContext,
  assessment: Assessment,
  runs: Array<{ runDir: string; manifest: LoopRunManifest }>,
): void {
  const trials = runs.flatMap((run) => run.manifest.trials);
  const valid = trials.filter(
    (trial) => trial.machine_verdict !== "invalid",
  ).length;
  const latestCompleted = runs
    .map((run) => Date.parse(run.manifest.completed_at ?? ""))
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0];
  const acceptedAt = Date.parse(assessment.accepted_at);
  recordOperatingMetrics(ctx, {
    id: `assessment:${assessment.screening_run_id}`,
    stage: "assessment",
    validRunRate: trials.length ? valid / trials.length : 0,
    modelTrials: trials.length,
    modelRuntimeMs: trials.reduce(
      (total, trial) => total + (trial.duration_ms ?? 0),
      0,
    ),
    ...(latestCompleted !== undefined && Number.isFinite(acceptedAt)
      ? { classificationMs: Math.max(0, acceptedAt - latestCompleted) }
      : {}),
    evidence: runs.map((run) => run.runDir),
  });
}

function recordVerificationMetrics(
  ctx: WorkflowContext,
  checkpoint: VerificationCheckpoint,
): void {
  const trials = checkpoint.manifest.trials;
  const valid = trials.filter(
    (trial) => trial.machine_verdict !== "invalid",
  ).length;
  recordOperatingMetrics(ctx, {
    id: `verification:${checkpoint.manifest.run_id}`,
    stage: "verification",
    validRunRate: trials.length ? valid / trials.length : 0,
    modelTrials: trials.length,
    modelRuntimeMs: trials.reduce(
      (total, trial) => total + (trial.duration_ms ?? 0),
      0,
    ),
    regressionPrevented: !checkpoint.comparison.no_regressions,
    evidence: [checkpoint.runDir, join(checkpoint.runDir, "comparison.json")],
  });
}

export function qualifiesHeldBackRelease(
  checkpoint: VerificationCheckpoint,
): boolean {
  const { manifest, comparison } = checkpoint;
  const complete =
    manifest.scenarios.length > 0 &&
    manifest.trials_per_scenario > 0 &&
    manifest.scenarios.every((scenario) => {
      const trials = manifest.trials.filter(
        (trial) => trial.scenario === scenario,
      );
      return (
        trials.length === manifest.trials_per_scenario &&
        new Set(trials.map((trial) => trial.trial)).size ===
          manifest.trials_per_scenario
      );
    }) &&
    manifest.trials.length ===
      manifest.scenarios.length * manifest.trials_per_scenario;
  const candidatePassedEveryTrial = manifest.trials.every(
    (trial) => trial.machine_verdict === "pass",
  );
  return (
    complete &&
    candidatePassedEveryTrial &&
    comparison.labels_approved &&
    comparison.no_invalid_runs &&
    comparison.no_regressions
  );
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, path);
}

async function classifyFailures(
  ctx: WorkflowContext,
  failing: string[],
  runDirs: string[],
): Promise<Finding[] | null> {
  if (!failing.length) return [];
  const result = await ctx.runAgent(
    "gym",
    [
      "Classify every listed failing Gym scenario from immutable evidence.",
      "Return each scenario exactly once. Group scenarios only when they show the same responsible failure family.",
      "Choose agent only when approved evidence establishes May behavior. Use benchmark, scorer, runtime, or noise for the responsible alternative.",
      "Every agent finding needs one short stable kebab-case failureFamily.",
      `Failing scenarios: ${JSON.stringify(failing)}`,
      `Run directories: ${JSON.stringify(runDirs)}`,
      "Read the reports, captured decisions, expected answers, scorer checks, prompt/model provenance, and runtime logs before deciding.",
    ].join("\n"),
    { schema: findingsSchema, timeoutMs: 900_000 },
  );
  if (
    result.status === "error" ||
    result.status === "interrupted" ||
    !result.structuredResult
  ) {
    return null;
  }
  const findings = result.structuredResult.findings as Finding[];
  return validateFindings(findings, failing).length ? null : findings;
}

function sameScenarios(actual: string[], expected: string[]): boolean {
  return (
    JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort())
  );
}

export async function prepareAssessment(
  ctx: WorkflowContext,
  input: Record<string, unknown>,
  assessmentPath: string,
  loop: GymLoopApi,
): Promise<{ assessment: Assessment; problem?: string }> {
  if (existsSync(assessmentPath)) {
    return {
      assessment: JSON.parse(
        readFileSync(assessmentPath, "utf8"),
      ) as Assessment,
    };
  }

  const benchmark = safeName(input.benchmark, "may-alignment");
  const agent = safeName(input.agent, "may");
  if (!benchmark || !agent) throw new Error("Invalid benchmark or agent name");
  const trials = requestedTrials(input.trials);
  const gymRoot = join(ctx.projectsRoot, "gym");
  const gate = approvalGate(gymRoot, benchmark, requestedScenarios(input));
  if (gate.unapproved.length) {
    throw new Error(
      `Benchmark truth is not approved: ${gate.unapproved.join(", ")}`,
    );
  }
  const agentsRoot = join(dirname(ctx.projectsRoot), "agents");
  const screening = await loop.run({
    phase: "test",
    benchmark,
    scenarios: gate.scenarios,
    agent,
    candidate: "baseline",
    trials,
    agentsRoot,
  });
  const screeningVerdicts = scenarioVerdicts(screening.manifest);

  let retry: { runDir: string; manifest: LoopRunManifest } | null = null;
  if (screeningVerdicts.invalid.length) {
    retry = await loop.run({
      phase: "test",
      benchmark,
      scenarios: screeningVerdicts.invalid,
      agent,
      candidate: "baseline",
      trials,
      agentsRoot,
    });
  }

  const authoritative = new Map<string, "pass" | "fail" | "invalid">();
  for (const scenario of screeningVerdicts.pass)
    authoritative.set(scenario, "pass");
  for (const scenario of screeningVerdicts.fail)
    authoritative.set(scenario, "fail");
  for (const scenario of screeningVerdicts.invalid)
    authoritative.set(scenario, "invalid");
  if (retry) {
    const retried = scenarioVerdicts(retry.manifest);
    for (const scenario of retried.pass) authoritative.set(scenario, "pass");
    for (const scenario of retried.fail) authoritative.set(scenario, "fail");
    for (const scenario of retried.invalid)
      authoritative.set(scenario, "invalid");
  }
  const failing = [...authoritative]
    .filter(([, verdict]) => verdict === "fail")
    .map(([scenario]) => scenario)
    .sort();
  const invalid = [...authoritative]
    .filter(([, verdict]) => verdict === "invalid")
    .map(([scenario]) => scenario)
    .sort();
  const runDirs = [screening.runDir, ...(retry ? [retry.runDir] : [])];
  const sourceRuns = [screening, ...(retry ? [retry] : [])];
  let classified = await classifyFailures(ctx, failing, runDirs);
  if (!classified && failing.length) {
    classified = await classifyFailures(ctx, failing, runDirs);
  }
  if (!classified) {
    throw new Error("Gym could not classify every valid failing scenario");
  }
  const findings: Finding[] = [
    ...classified,
    ...(invalid.length
      ? [
          {
            classification: "runtime" as const,
            scenarios: invalid,
            summary:
              "These scenarios remained invalid after one bounded retry and cannot establish May behavior.",
            evidence: runDirs,
          },
        ]
      : []),
  ];
  const focus =
    findings.find((finding) => finding.classification === "agent") ?? null;
  const learningUnits = focus
    ? resolveLearningContexts(gymRoot, benchmark, focus.scenarios)
    : [];
  const releaseBenchmarks = [
    ...new Set(learningUnits.map((unit) => unit.releaseBenchmark)),
  ];
  if (releaseBenchmarks.length > 1) {
    throw new Error(
      `Focused learning units require multiple release benchmarks: ${releaseBenchmarks.join(", ")}`,
    );
  }
  const releaseBenchmark = releaseBenchmarks[0] ?? benchmark;
  const releaseScenarios = learningUnits.length
    ? [...new Set(learningUnits.flatMap((unit) => unit.releaseScenarios))]
    : gate.scenarios;
  const assessment: Assessment = {
    schema_version: 1,
    agent,
    benchmark,
    release_benchmark: releaseBenchmark,
    release_scenarios: releaseScenarios,
    screening_run_id: screening.manifest.run_id,
    screening_run_dir: screening.runDir,
    retry_run_id: retry?.manifest.run_id ?? null,
    retry_run_dir: retry?.runDir ?? null,
    findings,
    focus,
    baseline_run_id: null,
    baseline_run_dir: null,
    accepted_at: new Date().toISOString(),
  };
  recordAssessmentMetrics(ctx, assessment, sourceRuns);

  if (!focus) {
    writeAssessment(assessmentPath, assessment);
    return { assessment };
  }

  let baseline = sourceRuns.find(
    (run) =>
      sameScenarios(run.manifest.scenarios, focus.scenarios) &&
      scenarioVerdicts(run.manifest).invalid.length === 0,
  );
  if (!baseline) {
    baseline = await loop.run({
      phase: "test",
      benchmark,
      scenarios: focus.scenarios,
      agent,
      candidate: "baseline",
      trials,
      agentsRoot,
    });
  }
  let baselineVerdicts = scenarioVerdicts(baseline.manifest);
  if (baselineVerdicts.invalid.length) {
    baseline = await loop.run({
      phase: "test",
      benchmark,
      scenarios: focus.scenarios,
      agent,
      candidate: "baseline",
      trials,
      agentsRoot,
    });
    baselineVerdicts = scenarioVerdicts(baseline.manifest);
  }
  assessment.baseline_run_id = baseline.manifest.run_id;
  assessment.baseline_run_dir = baseline.runDir;
  writeAssessment(assessmentPath, assessment);
  if (baselineVerdicts.invalid.length) {
    return {
      assessment,
      problem:
        "The focused May failure remained invalid after one bounded retry.",
    };
  }
  if (!baselineVerdicts.fail.length) {
    return {
      assessment,
      problem:
        "The focused May failure did not reproduce in the frozen development baseline.",
    };
  }
  return { assessment };
}

function planFromInput(
  ctx: WorkflowContext,
  input: Record<string, unknown>,
): CandidatePlan | null {
  const baselineRunId = safeRunId(input.baselineRunId);
  const scenarios = Array.isArray(input.focusScenarios)
    ? input.focusScenarios.map(String)
    : [];
  const failureFamily = safeName(input.failureFamily, "");
  const benchmark = safeName(input.benchmark, "may-alignment");
  const agent = safeName(input.agent, "may");
  if (
    !baselineRunId ||
    !scenarios.length ||
    !failureFamily ||
    !benchmark ||
    !agent
  ) {
    return null;
  }
  const baselineDir = join(
    ctx.projectsRoot,
    "gym",
    ".state",
    "benchmarks",
    baselineRunId,
  );
  if (!existsSync(join(baselineDir, "manifest.json"))) return null;
  const suite = record(
    JSON.parse(
      readFileSync(
        join(ctx.projectsRoot, "gym", "benchmarks", benchmark, "suite.json"),
        "utf8",
      ),
    ),
  );
  const suiteScenarios = Array.isArray(suite.scenarios)
    ? suite.scenarios.map(String)
    : [];
  const learningUnits = resolveLearningContexts(
    join(ctx.projectsRoot, "gym"),
    benchmark,
    scenarios,
  );
  const learnedReleaseBenchmarks = [
    ...new Set(learningUnits.map((unit) => unit.releaseBenchmark)),
  ];
  if (learnedReleaseBenchmarks.length > 1) return null;
  const releaseBenchmark = safeName(
    input.releaseBenchmark,
    learnedReleaseBenchmarks[0] ?? benchmark,
  );
  if (!releaseBenchmark) return null;
  const releaseScenarios = Array.isArray(input.releaseScenarios)
    ? input.releaseScenarios.map(String)
    : learningUnits.length
      ? [...new Set(learningUnits.flatMap((unit) => unit.releaseScenarios))]
      : suiteScenarios;
  if (!releaseScenarios.length) return null;
  return {
    agent,
    benchmark,
    releaseBenchmark,
    releaseScenarios,
    baselineRunId,
    baselineDir,
    assessmentPath: String(input.assessmentPath ?? ""),
    learningUnits,
    focus: {
      classification: "agent",
      scenarios,
      failureFamily,
      summary: String(
        input.classificationSummary ?? "Approved May behavior gap",
      ),
      evidence: Array.isArray(input.classificationEvidence)
        ? input.classificationEvidence.map(String)
        : [],
    },
  };
}

export function fingerprintTree(path: string): string {
  const hash = createHash("sha256");
  const visit = (current: string, relativePath: string): void => {
    const stat = lstatSync(current);
    hash.update(
      `${relativePath}\0${stat.isSymbolicLink() ? "link" : stat.isDirectory() ? "dir" : "file"}\0`,
    );
    if (stat.isSymbolicLink()) hash.update(readlinkSync(current));
    else if (stat.isDirectory()) {
      for (const entry of readdirSync(current).sort()) {
        visit(join(current, entry), join(relativePath, entry));
      }
    } else hash.update(readFileSync(current));
  };
  visit(path, ".");
  return hash.digest("hex");
}

function fingerprintAgentLearningSurface(path: string): string {
  const hash = createHash("sha256");
  const visit = (current: string, relativePath: string): void => {
    if (/^handlers\/\.may-runtime-module-/.test(relativePath)) return;
    const stat = lstatSync(current);
    hash.update(
      `${relativePath}\0${stat.isSymbolicLink() ? "link" : stat.isDirectory() ? "dir" : "file"}\0`,
    );
    if (stat.isSymbolicLink()) hash.update(readlinkSync(current));
    else if (stat.isDirectory()) {
      for (const entry of readdirSync(current).sort()) {
        visit(join(current, entry), join(relativePath, entry));
      }
    } else hash.update(readFileSync(current));
  };
  for (const entry of [
    "AGENTS.md",
    "agent.json",
    "cron.json",
    "handlers",
    "skills",
    "tools",
    "workflows",
  ]) {
    const current = join(path, entry);
    if (existsSync(current)) visit(current, entry);
  }
  return hash.digest("hex");
}

export function buildApprovalRequest(input: {
  kind: ApprovalKind;
  taskId: string;
  generation: number;
  artifactFingerprint: string;
  packetPath: string;
  requestedAction: string;
  reason: string;
}): ApprovalRequest {
  const taskKey = safeKey(input.taskId, "improve-may");
  const fingerprintKey = safeKey(input.artifactFingerprint, "artifact");
  const approvalId = [
    "gym",
    input.kind,
    taskKey,
    `g${input.generation}`,
    fingerprintKey,
  ].join(":");
  const waitId = `wait:${approvalId}`;
  return {
    ...input,
    approvalId,
    waitId,
    taskGeneration: input.generation,
    condition: {
      id: `approval-${input.kind}-g${input.generation}-${fingerprintKey.slice(-16)}`,
      type: "project.approval.submitted",
      subject: `approvalId:${approvalId}`,
      expected: {
        taskId: input.taskId,
        taskGeneration: input.generation,
        artifactFingerprint: input.artifactFingerprint,
        acceptedDecisions: ["approve", "adjust", "decline"],
      },
    },
  };
}

export function buildBenchmarkFixRetryEvent(input: {
  agent: string;
  benchmark: string;
  scenarios: string[];
  artifactFingerprint: string;
  taskId: string;
  taskGeneration: number;
  approvalId: string;
}) {
  return {
    type: "gym.improvement.requested",
    project: "gym",
    agent: input.agent,
    benchmark: input.benchmark,
    scenarios: [...input.scenarios],
    trials: 3,
    reason: "approved-benchmark-fix-applied",
    artifactFingerprint: input.artifactFingerprint,
    taskId: input.taskId,
    taskGeneration: input.taskGeneration,
    approvalId: input.approvalId,
  };
}

export function dispatchApproval(
  ctx: WorkflowContext,
  request: ApprovalRequest,
): void {
  const expectedResponse = {
    type: "project.approval.submitted",
    approvalKind: request.kind,
    approvalId: request.approvalId,
    waitId: request.waitId,
    taskId: request.taskId,
    taskGeneration: request.taskGeneration,
    artifactFingerprint: request.artifactFingerprint,
    acceptedDecisions: ["approve", "adjust", "decline"],
  };
  const approval = {
    ...request,
    question: request.requestedAction,
    options: [
      {
        id: "approve",
        label: "Approve",
        effect: "Apply this exact verified artifact.",
      },
      {
        id: "decline",
        label: "Reject",
        effect: "Keep production unchanged and revise the proposal.",
      },
    ],
    directEvent: expectedResponse,
  };

  ctx.emit({
    type: "project.approval.requested",
    project: "gym",
    taskId: request.taskId,
    taskGeneration: request.taskGeneration,
    approvalKind: request.kind,
    approvalId: request.approvalId,
    waitId: request.waitId,
    artifactFingerprint: request.artifactFingerprint,
    packetPath: request.packetPath,
    requestedAction: request.requestedAction,
    reason: request.reason,
    expectedResponse,
  });
  ctx.dispatchEvent("message.created", {
    to: "human",
    from: "gym",
    project: "gym",
    projectId: "projects/gym.app",
    projectPath: "projects/gym.app",
    taskId: request.taskId,
    taskGeneration: request.taskGeneration,
    content: [
      request.kind === "agent-improvement"
        ? "Gym has a verified May improvement"
        : "Gym found a benchmark or scorer fix",
      "",
      "Decision",
      request.requestedAction,
      "",
      "Why now",
      request.reason,
      "",
      `Artifact: ${request.artifactFingerprint}`,
      `Review packet: ${request.packetPath}`,
      "",
      "Reply: approve or reject <reason>",
    ].join("\n"),
    priority: "P1",
    intent: "gym-approval",
    approval,
    approvalKind: request.kind,
    approvalId: request.approvalId,
    waitId: request.waitId,
    artifactFingerprint: request.artifactFingerprint,
    packetPath: request.packetPath,
    pathId: request.taskId,
    requestedAction: request.requestedAction,
    reason: request.reason,
    expectedResponse,
    dedupKey: request.approvalId,
  });
}

function approvalFromStored(
  value: Record<string, unknown>,
): ApprovalRequest | null {
  const raw = record(value.approval);
  const kind = raw.kind;
  const taskGeneration = Number(raw.taskGeneration);
  if (
    (kind !== "agent-improvement" && kind !== "benchmark-fix") ||
    !String(raw.approvalId ?? "") ||
    !String(raw.taskId ?? "") ||
    !Number.isInteger(taskGeneration) ||
    !String(raw.artifactFingerprint ?? "")
  ) {
    return null;
  }
  return raw as unknown as ApprovalRequest;
}

function boundedEvidence(values: string[], limit = 32): string[] {
  return [...new Set(values.filter((value) => value.trim()))].slice(0, limit);
}

function existingResult(path: string): StoredResult | null {
  if (!existsSync(path)) return null;
  const value = record(JSON.parse(readFileSync(path, "utf8")));
  const summary = String(value.summary ?? "").trim();
  if (!summary) return null;
  const safetyStop =
    value.stop_reason === "candidate-safety-limit" ||
    summary.startsWith("Gym reached the safety limit");
  if (
    safetyStop &&
    (value.workflow_state !== "converged" ||
      value.stop_reason !== "candidate-safety-limit")
  ) {
    value.workflow_state = "converged";
    value.stop_reason = "candidate-safety-limit";
    writeJson(path, value);
  }
  return {
    summary,
    state: safetyStop
      ? "converged"
      : value.workflow_state === "needs-owner"
        ? "needs-owner"
        : value.workflow_state === "waiting"
          ? "waiting"
          : "converged",
    evidence: boundedEvidence(
      Array.isArray(value.evidence)
        ? [path, ...value.evidence.map(String)]
        : [path],
    ),
    actions: Array.isArray(value.actions)
      ? (value.actions as ProjectAppTaskAction[])
      : [],
    conditions: Array.isArray(value.conditions)
      ? (value.conditions as ProjectAppConditionSpec[])
      : [],
    approval: approvalFromStored(value),
  };
}

function approvalDecision(
  task: string,
  request: ApprovalRequest,
): { decision: "approve" | "adjust" | "decline"; message: string } | null {
  const trigger = triggerDetails(task);
  if (trigger?.type !== "project.approval.submitted") return null;
  if (
    trigger.approvalId !== request.approvalId ||
    trigger.taskId !== request.taskId ||
    Number(trigger.taskGeneration) !== request.taskGeneration ||
    trigger.artifactFingerprint !== request.artifactFingerprint
  ) {
    return null;
  }
  const decision = String(trigger.decision ?? "").toLowerCase();
  if (
    decision !== "approve" &&
    decision !== "adjust" &&
    decision !== "decline"
  ) {
    return null;
  }
  return {
    decision,
    message: String(trigger.message ?? decision),
  };
}

function assertPromotableOverlay(path: string): void {
  const visit = (current: string): void => {
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) {
      throw new Error(`Candidate promotion refuses symbolic link: ${current}`);
    }
    if (!stat.isDirectory()) return;
    for (const entry of readdirSync(current)) visit(join(current, entry));
  };
  visit(path);
}

function promoteAgentOverlay(input: {
  candidatePath: string;
  expectedFingerprint: string;
  productionAgentPath: string;
}): void {
  const actual = `sha256:${fingerprintTree(input.candidatePath)}`;
  if (actual !== input.expectedFingerprint) {
    throw new Error(
      `Candidate changed after approval request: expected ${input.expectedFingerprint}, got ${actual}`,
    );
  }
  assertPromotableOverlay(input.candidatePath);
  cpSync(input.candidatePath, input.productionAgentPath, {
    recursive: true,
    force: true,
  });
}

export function applyDirectorySnapshot(input: {
  snapshotPath: string;
  expectedFingerprint: string;
  targetPath: string;
}): void {
  if (!input.targetPath || !existsSync(input.targetPath)) {
    throw new Error(`Approved artifact target is missing: ${input.targetPath}`);
  }
  const actual = `sha256:${fingerprintTree(input.snapshotPath)}`;
  if (actual !== input.expectedFingerprint) {
    throw new Error(
      `Approved artifact changed: expected ${input.expectedFingerprint}, got ${actual}`,
    );
  }
  assertPromotableOverlay(input.snapshotPath);
  const parent = dirname(input.targetPath);
  const token = safeKey(input.expectedFingerprint, "snapshot").slice(-16);
  const staged = join(parent, `.gym-stage-${token}`);
  const backup = join(parent, `.gym-backup-${token}`);
  rmSync(staged, { recursive: true, force: true });
  rmSync(backup, { recursive: true, force: true });
  cpSync(input.snapshotPath, staged, { recursive: true });
  renameSync(input.targetPath, backup);
  try {
    renameSync(staged, input.targetPath);
    rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (!existsSync(input.targetPath) && existsSync(backup)) {
      renameSync(backup, input.targetPath);
    }
    rmSync(staged, { recursive: true, force: true });
    throw error;
  }
}

async function buildBenchmarkFix(
  ctx: WorkflowContext,
  plan: CandidatePlan,
  review: FailedReview,
  candidateStateDir: string,
  verificationDir: string,
  scratchRoot: string,
): Promise<{
  path: string;
  targetPath: string;
  fingerprint: string;
  summary: string;
  evidence: string[];
} | null> {
  const gymRoot = join(ctx.projectsRoot, "gym");
  const target = benchmarkFixTarget({
    gymRoot,
    benchmark: plan.benchmark,
    disposition: review.disposition,
  });
  const targetPath = target.path;
  const workspacePath = join(scratchRoot, "benchmark-fix", target.benchmark);
  const durablePath = join(
    candidateStateDir,
    "benchmark-fix",
    target.benchmark,
  );
  rmSync(workspacePath, { recursive: true, force: true });
  mkdirSync(dirname(workspacePath), { recursive: true });
  cpSync(targetPath, workspacePath, { recursive: true });
  const before = fingerprintTree(workspacePath);
  const result = await ctx.runAgent(
    "gym-implementer",
    [
      "Build one narrow isolated benchmark/scorer fix from this reviewed Gym evidence.",
      `Responsible layer: ${review.disposition}`,
      `Consumer benchmark: ${plan.benchmark}`,
      `Writable owner benchmark: ${target.benchmark}`,
      ...(target.evaluatorPath
        ? [`Resolved evaluator: ${target.evaluatorPath}`]
        : []),
      `Review: ${review.summary}`,
      `Proposed change: ${review.proposedChange}`,
      `Failed verification: ${verificationDir}`,
      `Writable benchmark snapshot: ${workspacePath}`,
      "Edit only that snapshot. Do not edit production, agent files, run evidence, task state, or Git state.",
      "Keep the change minimal. Preserve approved truth unless the proposal explicitly identifies truth that requires Hao's approval.",
      "Return every changed file and concrete validation evidence.",
    ].join("\n"),
    { schema: implementationSchema, timeoutMs: 1_800_000 },
  );
  if (
    result.status === "error" ||
    result.status === "interrupted" ||
    !result.structuredResult
  ) {
    return null;
  }
  const after = fingerprintTree(workspacePath);
  if (before === after) return null;
  rmSync(durablePath, { recursive: true, force: true });
  mkdirSync(dirname(durablePath), { recursive: true });
  cpSync(workspacePath, durablePath, { recursive: true });
  return {
    path: durablePath,
    targetPath,
    fingerprint: `sha256:${fingerprintTree(durablePath)}`,
    summary: String(result.structuredResult.summary),
    evidence: result.structuredResult.evidence.map(String),
  };
}

export function benchmarkFixTarget(input: {
  gymRoot: string;
  benchmark: string;
  disposition: FailedReview["disposition"];
}): { benchmark: string; path: string; evaluatorPath: string | null } {
  const benchmarksRoot = resolve(input.gymRoot, "benchmarks");
  const consumerPath = join(benchmarksRoot, input.benchmark);
  if (input.disposition !== "review-scorer") {
    return {
      benchmark: input.benchmark,
      path: consumerPath,
      evaluatorPath: null,
    };
  }

  const suitePath = join(consumerPath, "suite.json");
  const suite = JSON.parse(readFileSync(suitePath, "utf8")) as {
    evaluator?: unknown;
  };
  const evaluator =
    typeof suite.evaluator === "string" ? suite.evaluator.trim() : "";
  if (!evaluator) {
    return {
      benchmark: input.benchmark,
      path: consumerPath,
      evaluatorPath: null,
    };
  }

  const evaluatorPath = resolve(consumerPath, evaluator);
  const evaluatorRelative = relative(benchmarksRoot, evaluatorPath);
  if (
    !evaluatorRelative ||
    evaluatorRelative === ".." ||
    evaluatorRelative.startsWith(`..${sep}`)
  ) {
    throw new Error(
      `Benchmark evaluator escapes the benchmark root: ${evaluatorPath}`,
    );
  }
  const ownerBenchmark = evaluatorRelative.split(sep)[0]!;
  const ownerPath = join(benchmarksRoot, ownerBenchmark);
  if (!existsSync(ownerPath)) {
    throw new Error(`Scorer owner benchmark is missing: ${ownerPath}`);
  }
  return {
    benchmark: ownerBenchmark,
    path: ownerPath,
    evaluatorPath,
  };
}

function isReleaseBaseline(
  manifest: LoopRunManifest,
  gymRoot: string,
  benchmark: string,
  agent: string,
  releaseScenarios: string[],
): boolean {
  return (
    releaseScenarios.length > 0 &&
    sameScenarios(manifest.scenarios, releaseScenarios) &&
    manifest.benchmark === benchmark &&
    manifest.agent === agent &&
    manifest.trials_per_scenario >= RELEASE_TRIALS
  );
}

async function reviewFailedCandidate(
  ctx: WorkflowContext,
  plan: CandidatePlan,
  verificationDir: string,
): Promise<FailedReview | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await ctx.runAgent(
      "gym",
      [
        "Review this failed May candidate before deciding what changes next.",
        "Read the baseline, comparison, failed decisions, approved expected answers, scorer checks, prompt/model provenance, and runtime evidence.",
        "Read the exact candidate snapshot preserved by the verification manifest. If it contains agent.json skillActivationRules, execute each relevant rule against the frozen task text and distinguish a trigger miss from a loaded-skill policy failure.",
        "Use revise-candidate only when the evidence still establishes a May behavior gap.",
        "When the failed candidate text was present in the actual prompt but behavior did not improve, propose a different learning mechanism instead of stronger wording in the same file.",
        "Use review-benchmark, review-scorer, review-runtime, or needs-human for the responsible alternative.",
        `Failure family: ${plan.focus.failureFamily}`,
        `Original finding: ${plan.focus.summary}`,
        `Baseline: ${plan.baselineDir}`,
        `Verification: ${verificationDir}`,
        ...(attempt === 2
          ? [
              "The first review call returned no valid structured result. Return the requested review object directly and do not run benchmarks.",
            ]
          : []),
      ].join("\n"),
      { schema: failedReviewSchema, timeoutMs: 900_000 },
    );
    if (
      result.status !== "error" &&
      result.status !== "interrupted" &&
      result.structuredResult
    ) {
      return result.structuredResult as FailedReview;
    }
  }
  return null;
}

const MAX_CANDIDATE_ITERATIONS = 5;

interface CandidateCheckpoint {
  candidateId: string;
  candidatePath: string;
  candidateFingerprint: string;
  implementationSummary: string;
  implementationEvidence: string[];
  learningUnits?: Array<{ id: string; version: number }>;
}

interface IterationRevision {
  kind: "revise";
  review: FailedReview;
  verificationDir: string;
  candidatePath: string;
  candidateFingerprint: string;
  evidence: string[];
}

function saveWorkflowResult(
  resultPath: string,
  value: Record<string, unknown>,
): void {
  writeJson(resultPath, {
    schema_version: 1,
    ...value,
    actions: [],
    completed_at: new Date().toISOString(),
  });
}

function migrateLegacyRevision(candidateStateDir: string): void {
  const resultPath = join(candidateStateDir, "result.json");
  if (!existsSync(resultPath)) return;
  const stored = record(JSON.parse(readFileSync(resultPath, "utf8")));
  const review = record(stored.review);
  if (
    stored.recommendation !== "revise-candidate" ||
    review.disposition !== "revise-candidate"
  ) {
    return;
  }
  const candidatePath = String(stored.candidate_path ?? "");
  const verificationDir = String(
    stored.development_verification_run_dir ??
      stored.verification_run_dir ??
      "",
  );
  const manifestPath = join(verificationDir, "manifest.json");
  const comparisonPath = join(verificationDir, "comparison.json");
  if (
    !candidatePath ||
    !existsSync(candidatePath) ||
    !existsSync(manifestPath) ||
    !existsSync(comparisonPath)
  ) {
    return;
  }

  const iterationDir = join(candidateStateDir, "iterations", "1");
  const durableCandidate = join(iterationDir, "may");
  mkdirSync(iterationDir, { recursive: true });
  if (!existsSync(durableCandidate)) {
    cpSync(candidatePath, durableCandidate, { recursive: true });
  }
  const candidateFingerprint = fingerprintTree(durableCandidate);
  writeJson(join(iterationDir, "candidate.json"), {
    candidateId: String(stored.candidate_id ?? "legacy-candidate"),
    candidatePath: durableCandidate,
    candidateFingerprint,
    implementationSummary: "Recovered the pre-checkpoint candidate.",
    implementationEvidence: [resultPath, candidatePath],
  } satisfies CandidateCheckpoint);
  writeJson(join(iterationDir, "development-verification.json"), {
    runDir: verificationDir,
    manifest: JSON.parse(readFileSync(manifestPath, "utf8")) as LoopRunManifest,
    comparison: JSON.parse(
      readFileSync(comparisonPath, "utf8"),
    ) as RunComparison,
  } satisfies VerificationCheckpoint);
  writeJson(join(iterationDir, "failed-review.json"), review);
  const legacyResultPath = join(candidateStateDir, "legacy-result.json");
  if (!existsSync(legacyResultPath)) renameSync(resultPath, legacyResultPath);
  else rmSync(resultPath, { force: true });
}

async function runCandidateIteration(
  ctx: WorkflowContext,
  loop: GymLoopApi,
  plan: CandidatePlan,
  taskId: string,
  generation: number,
  iteration: number,
  iterationDir: string,
  scratchRoot: string,
  resultPath: string,
  baseCandidatePath: string | null,
): Promise<WorkflowResult | IterationRevision> {
  const productionAgentsRoot = join(dirname(ctx.projectsRoot), "agents");
  const sourceMay = join(productionAgentsRoot, plan.agent);
  if (!existsSync(sourceMay))
    return ctx.blocked(`Agent not found: ${sourceMay}`);
  const workspaceAgentsRoot = join(scratchRoot, "agents");
  const workspaceMay = join(workspaceAgentsRoot, plan.agent);
  const candidateId = `gym/${plan.agent}/g${generation}-i${iteration}`;
  const candidateDir = join(workspaceAgentsRoot, ".lab", candidateId);
  rmSync(scratchRoot, { recursive: true, force: true });
  mkdirSync(workspaceAgentsRoot, { recursive: true });
  cpSync(sourceMay, workspaceMay, { recursive: true });

  const durableCandidate = join(iterationDir, plan.agent);
  const candidateCheckpointPath = join(iterationDir, "candidate.json");
  let candidateCheckpoint = readJson<CandidateCheckpoint>(
    candidateCheckpointPath,
  );
  if (!candidateCheckpoint || !existsSync(durableCandidate)) {
    mkdirSync(candidateDir, { recursive: true });
    if (baseCandidatePath && existsSync(baseCandidatePath)) {
      cpSync(baseCandidatePath, candidateDir, { recursive: true });
    }
    const result = await ctx.runAgent(
      "gym-implementer",
      [
        "Build one narrow isolated May candidate for this approved Gym finding.",
        `Failure family: ${plan.focus.failureFamily}`,
        `Scenarios: ${JSON.stringify(plan.focus.scenarios)}`,
        `Finding: ${plan.focus.summary}`,
        `Immutable baseline: ${plan.baselineDir}`,
        ...learningPromptLines(plan.learningUnits),
        ...(plan.revision
          ? [
              `Previous review: ${plan.revision.summary}`,
              `Proposed revision: ${plan.revision.proposedChange}`,
              `Previous verification: ${plan.revision.previousVerificationDir}`,
              "Mechanism change required: valid verification already showed that the previous candidate did not solve the gap.",
              "Compare the previous candidate with the prepared May base. Do not merely strengthen or lengthen the same AGENTS.md guidance.",
              "Inspect May's skill-discovery and preparation model and use one distinct supported mechanism, such as a narrowly described task-triggered skill, when the evidence supports it.",
              "If no distinct mechanism is justified, make no artifact change so the workflow stops instead of spending another wording-only iteration.",
            ]
          : []),
        "Read prior generation results for this task when present; they are evidence about mechanisms that already failed even when this generation has no in-run revision yet.",
        "When repeated valid trials prove model-selected skill loading is ignored, use the validated agent.json skillActivationRules mechanism for a narrow deterministic trigger instead of adding more prompt wording. Copy the full prepared agent.json into the overlay, change only skillActivationRules, and pair the rule with its named skill package.",
        "Keep activation rules general, bounded, and tied to the real high-risk task class. Require an opposite control so a rule does not make May over-apply the skill.",
        "Before finishing, validate candidate agent.json with the May-agent config validator: each activation pattern must be valid and 1-512 characters, and every named skill must exist in the candidate catalog.",
        `Candidate overlay directory: ${candidateDir}`,
        "Read the baseline evidence, current agent preparation, and relevant design before editing.",
        "Write only under the candidate overlay. Do not edit production, Gym truth, labels, evidence, task state, or Git state.",
        "Do not run Gym scenarios, benchmarks, or comparisons. The workflow owns verification after it fingerprints the artifact.",
        "Keep the overlay minimal and return concrete evidence.",
      ].join("\n"),
      { schema: implementationSchema, timeoutMs: 1_800_000 },
    );
    const candidateProduced =
      existsSync(candidateDir) && readdirSync(candidateDir).length > 0;
    if (!candidateProduced) {
      return ctx.done("Candidate implementation failed", {
        state: "needs-owner",
        summary: "Candidate implementation failed",
        evidence: [result.sessionId, result.lastAssistantText ?? result.status],
      });
    }
    const implementation = result.structuredResult ?? {
      summary:
        result.lastAssistantText?.trim() ||
        `Recovered an isolated candidate after builder status ${result.status}; authoritative verification decides whether it is usable.`,
      changedFiles: readdirSync(candidateDir).sort(),
      evidence: [
        `builder-session:${result.sessionId}`,
        `builder-status:${result.status}`,
        `candidate-overlay:${candidateDir}`,
      ],
    };
    rmSync(durableCandidate, { recursive: true, force: true });
    mkdirSync(iterationDir, { recursive: true });
    cpSync(candidateDir, durableCandidate, { recursive: true });
    candidateCheckpoint = {
      candidateId,
      candidatePath: durableCandidate,
      candidateFingerprint: fingerprintTree(durableCandidate),
      implementationSummary: implementation.summary,
      implementationEvidence: implementation.evidence,
      learningUnits: plan.learningUnits.map(({ id, version }) => ({
        id,
        version,
      })),
    };
    writeJson(candidateCheckpointPath, candidateCheckpoint);
  }
  rmSync(candidateDir, { recursive: true, force: true });
  cpSync(durableCandidate, candidateDir, { recursive: true });
  const candidateFingerprint = candidateCheckpoint.candidateFingerprint;
  if (fingerprintTree(durableCandidate) !== candidateFingerprint) {
    return ctx.done("Durable candidate changed after it was checkpointed", {
      state: "needs-owner",
      summary: "Durable candidate changed after it was checkpointed",
      evidence: [candidateCheckpointPath, durableCandidate],
    });
  }
  if (plan.revision?.previousCandidateFingerprint === candidateFingerprint) {
    const summary = `Candidate iteration ${iteration} made no artifact change; autonomous progress stopped.`;
    saveWorkflowResult(resultPath, {
      task_id: taskId,
      generation,
      workflow_state: "needs-owner",
      summary,
      evidence: [candidateCheckpointPath, durableCandidate],
      conditions: [],
      approval: null,
    });
    return ctx.done(summary, {
      state: "needs-owner",
      summary,
      evidence: [candidateCheckpointPath, durableCandidate],
    });
  }

  const baselineManifest = readManifest(plan.baselineDir);
  const developmentCheckpointPath = join(
    iterationDir,
    "development-verification.json",
  );
  let development = readJson<VerificationCheckpoint>(developmentCheckpointPath);
  if (!development) {
    development = await loop.verify({
      baseline: plan.baselineRunId,
      candidate: candidateId,
      trials: baselineManifest.trials_per_scenario,
      agentsRoot: workspaceAgentsRoot,
    });
    writeJson(developmentCheckpointPath, development);
  }
  if (
    development.manifest.proof.candidate_fingerprint !== candidateFingerprint
  ) {
    return ctx.done("Candidate fingerprint does not match verification", {
      state: "needs-owner",
      summary: "Candidate fingerprint does not match verification",
      evidence: [durableCandidate, development.runDir],
    });
  }
  recordVerificationMetrics(ctx, development);

  const gymRoot = join(ctx.projectsRoot, "gym");
  let comparison = development.comparison;
  let verificationPassed = comparison.gate === "pass";
  let verificationDir = development.runDir;
  let releaseBaselineDir: string | null = null;
  if (verificationPassed) {
    const releaseBaselineCheckpointPath = join(
      iterationDir,
      "release-baseline.json",
    );
    let releaseBaseline = readJson<{
      runDir: string;
      manifest: LoopRunManifest;
    }>(releaseBaselineCheckpointPath);
    if (!releaseBaseline) {
      releaseBaseline = isReleaseBaseline(
        baselineManifest,
        gymRoot,
        plan.releaseBenchmark,
        plan.agent,
        plan.releaseScenarios,
      )
        ? { runDir: plan.baselineDir, manifest: baselineManifest }
        : await loop.run({
            phase: "test",
            benchmark: plan.releaseBenchmark,
            scenarios: plan.releaseScenarios,
            agent: plan.agent,
            candidate: "baseline",
            trials: RELEASE_TRIALS,
            agentsRoot: workspaceAgentsRoot,
          });
      writeJson(releaseBaselineCheckpointPath, releaseBaseline);
    }
    releaseBaselineDir = releaseBaseline.runDir;
    const releaseCheckpointPath = join(
      iterationDir,
      "release-verification.json",
    );
    let release = readJson<VerificationCheckpoint>(releaseCheckpointPath);
    if (!release) {
      release = await loop.verify({
        baseline: releaseBaseline.manifest.run_id,
        candidate: candidateId,
        trials: releaseBaseline.manifest.trials_per_scenario,
        agentsRoot: workspaceAgentsRoot,
      });
      writeJson(releaseCheckpointPath, release);
    }
    if (release.manifest.proof.candidate_fingerprint !== candidateFingerprint) {
      return ctx.done("Release fingerprint does not match candidate", {
        state: "needs-owner",
        summary: "Release fingerprint does not match candidate",
        evidence: [durableCandidate, release.runDir],
      });
    }
    recordVerificationMetrics(ctx, release);
    comparison = release.comparison;
    verificationPassed = qualifiesHeldBackRelease(release);
    verificationDir = release.runDir;
  }

  const reviewCheckpointPath = join(iterationDir, "failed-review.json");
  let review = verificationPassed
    ? null
    : readJson<FailedReview>(reviewCheckpointPath);
  if (!verificationPassed && !review) {
    review = await reviewFailedCandidate(ctx, plan, verificationDir);
    if (review) writeJson(reviewCheckpointPath, review);
  }
  if (!verificationPassed && !review) {
    return ctx.done("Gym could not review the failed candidate", {
      state: "needs-owner",
      summary: "Gym could not review the failed candidate",
      evidence: [durableCandidate, verificationDir],
    });
  }

  const expectsBenchmarkFix =
    review?.disposition === "review-benchmark" ||
    review?.disposition === "review-scorer";
  if (review?.disposition === "revise-candidate") {
    return {
      kind: "revise",
      review,
      verificationDir,
      candidatePath: durableCandidate,
      candidateFingerprint,
      evidence: [
        candidateCheckpointPath,
        developmentCheckpointPath,
        verificationDir,
        reviewCheckpointPath,
        ...review.evidence,
      ],
    };
  }

  const benchmarkFix = expectsBenchmarkFix
    ? await buildBenchmarkFix(
        ctx,
        plan,
        review!,
        iterationDir,
        verificationDir,
        scratchRoot,
      )
    : null;
  if (expectsBenchmarkFix && !benchmarkFix) {
    return ctx.done("Gym could not build an isolated benchmark/scorer fix", {
      state: "needs-owner",
      summary: "Gym could not build an isolated benchmark/scorer fix",
      evidence: [resultPath, verificationDir, ...(review?.evidence ?? [])],
    });
  }

  const recommendation = verificationPassed ? "promote" : review!.disposition;
  const approval = verificationPassed
    ? buildApprovalRequest({
        kind: "agent-improvement",
        taskId,
        generation,
        artifactFingerprint: `sha256:${candidateFingerprint}`,
        packetPath: resultPath,
        requestedAction:
          "Approve this exact release-verified May candidate for production promotion?",
        reason:
          "The candidate improved the targeted behavior, then passed every approved held-back release trial without an invalid run or regression.",
      })
    : benchmarkFix
      ? buildApprovalRequest({
          kind: "benchmark-fix",
          taskId,
          generation,
          artifactFingerprint: benchmarkFix.fingerprint,
          packetPath: resultPath,
          requestedAction:
            "Approve this exact benchmark/scorer fix and a fresh baseline?",
          reason: `${review!.summary} ${benchmarkFix.summary}`,
        })
      : null;
  const workflowState = approval ? "waiting" : "needs-owner";
  const summary = verificationPassed
    ? `May candidate passed targeted and release verification and is waiting for approval of the exact artifact. ${candidateCheckpoint.implementationSummary}`
    : benchmarkFix
      ? `Gym prepared an exact benchmark/scorer fix and is waiting for approval. ${benchmarkFix.summary}`
      : `Gym found a ${review!.disposition} issue: ${review!.summary}`;
  const evidence = [
    resultPath,
    plan.assessmentPath,
    durableCandidate,
    `candidate-sha256:${candidateFingerprint}`,
    development.runDir,
    ...(releaseBaselineDir ? [releaseBaselineDir] : []),
    verificationDir,
    join(verificationDir, "comparison.json"),
    candidateCheckpointPath,
    ...candidateCheckpoint.implementationEvidence,
    ...(benchmarkFix
      ? [
          benchmarkFix.path,
          `benchmark-fix-${benchmarkFix.fingerprint}`,
          ...benchmarkFix.evidence,
        ]
      : []),
    ...(review?.evidence ?? []),
  ];
  saveWorkflowResult(resultPath, {
    task_id: taskId,
    generation,
    iteration,
    assessment_path: plan.assessmentPath,
    baseline_run_id: plan.baselineRunId,
    focus: plan.focus,
    learning_units: plan.learningUnits.map(({ id, version }) => ({
      id,
      version,
    })),
    candidate_id: candidateId,
    candidate_path: durableCandidate,
    candidate_fingerprint: candidateFingerprint,
    artifact_path: benchmarkFix?.path ?? durableCandidate,
    artifact_target_path: benchmarkFix?.targetPath ?? null,
    development_verification_run_dir: development.runDir,
    release_baseline_run_dir: releaseBaselineDir,
    verification_run_dir: verificationDir,
    gate: verificationPassed ? "pass" : comparison.gate,
    recommendation,
    review,
    summary,
    evidence,
    workflow_state: workflowState,
    conditions: approval ? [approval.condition] : [],
    approval,
  });
  ctx.emit({
    type: "gym.improvement.reviewed",
    project: "gym",
    taskId,
    agent: plan.agent,
    candidateId,
    candidateFingerprint,
    verificationDir,
    recommendation,
    resultPath,
  });
  if (approval) dispatchApproval(ctx, approval);
  if (!approval) {
    return ctx.done(summary, {
      state: "needs-owner",
      summary,
      evidence: boundedEvidence(evidence),
    });
  }
  return ctx.done(summary, {
    state: "waiting",
    summary,
    evidence: boundedEvidence(evidence),
    actions: [],
    conditions: [approval.condition],
  });
}

async function runCandidate(
  ctx: WorkflowContext,
  loop: GymLoopApi,
  initialPlan: CandidatePlan,
  taskId: string,
  generation: number,
  candidateStateDir: string,
): Promise<WorkflowResult> {
  const resultPath = join(candidateStateDir, "result.json");
  migrateLegacyRevision(candidateStateDir);
  const previous = existingResult(resultPath);
  let plan = initialPlan;
  let startIteration = 1;
  let resumedCandidatePath: string | null = null;
  if (previous) {
    if (previous.state !== "waiting" || !previous.approval) {
      return ctx.done(previous.summary, {
        state: previous.state,
        summary: previous.summary,
        evidence: previous.evidence,
      });
    }
    const response = approvalDecision(ctx.task, previous.approval);
    if (!response) {
      return ctx.done(previous.summary, {
        state: "waiting",
        summary: previous.summary,
        evidence: previous.evidence,
        actions: [],
        conditions: previous.conditions.length
          ? previous.conditions
          : [previous.approval.condition],
      });
    }
    const stored = record(JSON.parse(readFileSync(resultPath, "utf8")));
    const decisionPath = join(candidateStateDir, "approval-decision.json");
    writeJson(decisionPath, {
      schema_version: 1,
      ...response,
      ...previous.approval,
      recorded_at: new Date().toISOString(),
    });
    if (response.decision === "approve") {
      const artifactPath = String(
        stored.artifact_path ?? stored.candidate_path ?? "",
      );
      try {
        if (!artifactPath || !existsSync(artifactPath)) {
          throw new Error("Approved candidate artifact is missing");
        }
        if (previous.approval.kind === "agent-improvement") {
          promoteAgentOverlay({
            candidatePath: artifactPath,
            expectedFingerprint: previous.approval.artifactFingerprint,
            productionAgentPath: join(
              dirname(ctx.projectsRoot),
              "agents",
              plan.agent,
            ),
          });
        } else {
          applyDirectorySnapshot({
            snapshotPath: artifactPath,
            expectedFingerprint: previous.approval.artifactFingerprint,
            targetPath: String(stored.artifact_target_path ?? ""),
          });
        }
      } catch (error) {
        const summary = error instanceof Error ? error.message : String(error);
        return ctx.done(summary, {
          state: "needs-owner",
          summary,
          evidence: [resultPath, artifactPath],
        });
      }
      recordOperatingMetrics(ctx, {
        id: `approval:${previous.approval.approvalId}`,
        stage: "approval",
        proposalAccepted: true,
        evidence: [resultPath, decisionPath, artifactPath],
      });
      ctx.emit(
        previous.approval.kind === "agent-improvement"
          ? {
              type: "agent.revision.changed",
              project: "gym",
              agent: plan.agent,
              revision: previous.approval.artifactFingerprint,
              scenarios: [...plan.focus.scenarios],
              trials: 3,
              taskId,
              taskGeneration: generation,
              approvalId: previous.approval.approvalId,
            }
          : buildBenchmarkFixRetryEvent({
              agent: plan.agent,
              benchmark: plan.benchmark,
              scenarios: plan.focus.scenarios,
              artifactFingerprint: previous.approval.artifactFingerprint,
              taskId,
              taskGeneration: generation,
              approvalId: previous.approval.approvalId,
            }),
      );
      const summary =
        previous.approval.kind === "agent-improvement"
          ? `Applied approved May candidate ${previous.approval.artifactFingerprint}.`
          : `Applied approved benchmark/scorer fix ${previous.approval.artifactFingerprint}.`;
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: [...previous.evidence, decisionPath],
        actions: [],
      });
    }
    if (previous.approval.kind !== "agent-improvement") {
      const summary = `Hao ${response.decision === "decline" ? "rejected" : "adjusted"} the benchmark/scorer proposal. A new evaluation cycle is required.`;
      return ctx.done(summary, {
        state: "needs-owner",
        summary,
        evidence: [...previous.evidence, decisionPath],
      });
    }
    plan = {
      ...plan,
      revision: {
        summary: `Hao ${response.decision === "decline" ? "rejected" : "adjusted"} the candidate: ${response.message}`,
        proposedChange: response.message,
        evidence: [decisionPath, resultPath],
        previousVerificationDir: String(stored.verification_run_dir ?? ""),
        previousCandidateFingerprint:
          previous.approval.artifactFingerprint.replace(/^sha256:/, ""),
      },
    };
    startIteration = Math.max(1, Number(stored.iteration ?? 0) + 1);
    resumedCandidatePath = String(stored.candidate_path ?? "") || null;
    rmSync(resultPath, { force: true });
  }

  const iterationsDir = join(candidateStateDir, "iterations");
  const scratchBase = join(
    ctx.projectsRoot,
    "gym.app",
    ".state",
    "scratch",
    safeKey(taskId, "improve-may"),
    String(generation),
  );
  let baseCandidatePath: string | null = resumedCandidatePath;
  let previousFingerprint = plan.revision?.previousCandidateFingerprint;
  const accumulatedEvidence: string[] = [];
  for (
    let iteration = startIteration;
    iteration <= MAX_CANDIDATE_ITERATIONS;
    iteration++
  ) {
    const iterationDir = join(iterationsDir, String(iteration));
    const checkpoint = readJson<CandidateCheckpoint>(
      join(iterationDir, "candidate.json"),
    );
    if (checkpoint && previousFingerprint === checkpoint.candidateFingerprint) {
      baseCandidatePath = checkpoint.candidatePath;
      continue;
    }
    const iterationPlan = previousFingerprint
      ? {
          ...plan,
          revision: plan.revision ?? {
            summary: "Revise the previous failed candidate.",
            proposedChange: "Use the durable failed-candidate review.",
            evidence: accumulatedEvidence,
            previousVerificationDir: "",
            previousCandidateFingerprint: previousFingerprint,
          },
        }
      : plan;
    try {
      const outcome = await runCandidateIteration(
        ctx,
        loop,
        iterationPlan,
        taskId,
        generation,
        iteration,
        iterationDir,
        join(scratchBase, String(iteration)),
        resultPath,
        baseCandidatePath,
      );
      const revision = outcome as IterationRevision;
      if (revision.kind !== "revise") return outcome as WorkflowResult;
      accumulatedEvidence.push(...revision.evidence);
      plan = {
        ...plan,
        revision: {
          summary: revision.review.summary,
          proposedChange: revision.review.proposedChange,
          evidence: revision.review.evidence,
          previousVerificationDir: revision.verificationDir,
          previousCandidateFingerprint: revision.candidateFingerprint,
        },
      };
      previousFingerprint = revision.candidateFingerprint;
      baseCandidatePath = revision.candidatePath;
    } finally {
      rmSync(join(scratchBase, String(iteration)), {
        recursive: true,
        force: true,
      });
      if (existsSync(scratchBase) && readdirSync(scratchBase).length === 0) {
        rmSync(scratchBase, { recursive: true, force: true });
      }
    }
  }
  const summary = `Gym reached the safety limit of ${MAX_CANDIDATE_ITERATIONS} sequential candidate iterations without a verified proposal.`;
  saveWorkflowResult(resultPath, {
    task_id: taskId,
    generation,
    workflow_state: "converged",
    stop_reason: "candidate-safety-limit",
    summary,
    evidence: accumulatedEvidence,
    conditions: [],
    approval: null,
  });
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: boundedEvidence([resultPath, ...accumulatedEvidence]),
    actions: [],
  });
}

async function handleAssessmentBenchmarkFix(
  ctx: WorkflowContext,
  loop: GymLoopApi,
  assessment: Assessment,
  finding: Finding,
  assessmentPath: string,
  taskId: string,
  generation: number,
  stateDir: string,
  workflowInput: Record<string, unknown>,
): Promise<WorkflowResult> {
  const plan: CandidatePlan = {
    agent: assessment.agent,
    benchmark: assessment.benchmark,
    releaseBenchmark: assessment.release_benchmark ?? assessment.benchmark,
    releaseScenarios: assessment.release_scenarios,
    baselineRunId: assessment.screening_run_id,
    baselineDir: assessment.screening_run_dir,
    assessmentPath,
    learningUnits: resolveLearningContexts(
      join(ctx.projectsRoot, "gym"),
      assessment.benchmark,
      finding.scenarios,
    ),
    focus: finding,
  };
  const resultPath = join(stateDir, "result.json");
  if (existingResult(resultPath)) {
    return runCandidate(ctx, loop, plan, taskId, generation, stateDir);
  }
  const review: FailedReview = {
    disposition:
      finding.classification === "scorer"
        ? "review-scorer"
        : "review-benchmark",
    summary: [finding.summary, String(workflowInput.revisionSummary ?? "")]
      .filter(Boolean)
      .join(" "),
    proposedChange:
      String(workflowInput.revisionProposal ?? "").trim() || finding.summary,
    evidence: finding.evidence,
  };
  const scratchRoot = join(
    ctx.projectsRoot,
    "gym.app",
    ".state",
    "scratch",
    safeKey(taskId, "improve-may"),
    String(generation),
    "assessment-fix",
  );
  let fix: Awaited<ReturnType<typeof buildBenchmarkFix>>;
  try {
    fix = await buildBenchmarkFix(
      ctx,
      plan,
      review,
      stateDir,
      assessment.screening_run_dir,
      scratchRoot,
    );
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
  if (!fix) {
    const summary = "Gym could not build an isolated benchmark/scorer fix";
    return ctx.done(summary, {
      state: "needs-owner",
      summary,
      evidence: [assessmentPath, assessment.screening_run_dir],
    });
  }
  const approval = buildApprovalRequest({
    kind: "benchmark-fix",
    taskId,
    generation,
    artifactFingerprint: fix.fingerprint,
    packetPath: resultPath,
    requestedAction:
      "Approve this exact benchmark/scorer fix and a fresh baseline?",
    reason: `${finding.summary} ${fix.summary}`,
  });
  const summary = `Gym prepared an exact benchmark/scorer fix and is waiting for approval. ${fix.summary}`;
  const evidence = [
    resultPath,
    assessmentPath,
    assessment.screening_run_dir,
    fix.path,
    `benchmark-fix-${fix.fingerprint}`,
    ...finding.evidence,
    ...fix.evidence,
  ];
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    resultPath,
    `${JSON.stringify(
      {
        schema_version: 1,
        task_id: taskId,
        generation,
        assessment_path: assessmentPath,
        baseline_run_id: assessment.screening_run_id,
        focus: finding,
        artifact_path: fix.path,
        artifact_target_path: fix.targetPath,
        verification_run_dir: assessment.screening_run_dir,
        recommendation: review.disposition,
        review,
        summary,
        evidence,
        workflow_state: "waiting",
        actions: [],
        conditions: [approval.condition],
        approval,
        completed_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
  ctx.emit({
    type: "gym.improvement.reviewed",
    project: "gym",
    taskId,
    agent: assessment.agent,
    artifactFingerprint: fix.fingerprint,
    recommendation: review.disposition,
    resultPath,
  });
  dispatchApproval(ctx, approval);
  return ctx.done(summary, {
    state: "waiting",
    summary,
    evidence,
    actions: [],
    conditions: [approval.condition],
  });
}

async function runImprovementOnce(
  ctx: WorkflowContext,
  loop: GymLoopApi,
  input: Record<string, unknown>,
  taskId: string,
  generation: number,
  scope?: string,
): Promise<WorkflowResult> {
  const taskKey = safeKey(taskId, "improve-may");
  const scopeKey = scope ? safeKey(scope, "curriculum-track") : null;
  const stateDir = join(
    ctx.projectsRoot,
    "gym.app",
    ".state",
    "candidates",
    taskKey,
    String(generation),
    ...(scopeKey ? ["tracks", scopeKey] : []),
  );
  const assessmentPath = scopeKey
    ? join(
        ctx.projectsRoot,
        "gym.app",
        ".state",
        "assessments",
        taskKey,
        String(generation),
        `${scopeKey}.json`,
      )
    : join(
        ctx.projectsRoot,
        "gym.app",
        ".state",
        "assessments",
        taskKey,
        `${generation}.json`,
      );

  let plan = planFromInput(ctx, input);
  if (!plan) {
    try {
      const prepared = await prepareAssessment(
        ctx,
        input,
        assessmentPath,
        loop,
      );
      const assessment = prepared.assessment;
      if (prepared.problem) {
        return ctx.done(prepared.problem, {
          state: "needs-owner",
          summary: prepared.problem,
          evidence: [assessmentPath, assessment.screening_run_dir],
        });
      }
      if (!assessment.focus) {
        const evaluationFix = assessment.findings.find(
          (finding) =>
            finding.classification === "benchmark" ||
            finding.classification === "scorer",
        );
        if (evaluationFix) {
          return handleAssessmentBenchmarkFix(
            ctx,
            loop,
            assessment,
            evaluationFix,
            assessmentPath,
            taskId,
            generation,
            stateDir,
            input,
          );
        }
        const actionable = assessment.findings.filter(
          (finding) => finding.classification !== "noise",
        );
        const summary = actionable.length
          ? "Gym found evaluation issues but no approved May behavior gap to change."
          : "May has no actionable failures in the current approved evaluation.";
        return ctx.done(summary, {
          state: actionable.length ? "needs-owner" : "converged",
          summary,
          evidence: [assessmentPath, assessment.screening_run_dir],
        });
      }
      if (!assessment.baseline_run_id || !assessment.baseline_run_dir) {
        return ctx.blocked(
          "Assessment has no reproducible development baseline",
        );
      }
      plan = {
        agent: assessment.agent,
        benchmark: assessment.benchmark,
        releaseBenchmark: assessment.release_benchmark ?? assessment.benchmark,
        releaseScenarios: assessment.release_scenarios,
        baselineRunId: assessment.baseline_run_id,
        baselineDir: assessment.baseline_run_dir,
        focus: assessment.focus,
        assessmentPath,
        learningUnits: resolveLearningContexts(
          join(ctx.projectsRoot, "gym"),
          assessment.benchmark,
          assessment.focus.scenarios,
        ),
      };
    } catch (error) {
      const summary = error instanceof Error ? error.message : String(error);
      return ctx.done(summary, {
        state: "needs-owner",
        summary,
        evidence: [assessmentPath],
      });
    }
  }
  return runCandidate(ctx, loop, plan, taskId, generation, stateDir);
}

export async function runImprovement(
  ctx: WorkflowContext,
  loop: GymLoopApi = defaultLoopApi,
): Promise<WorkflowResult> {
  const gymRoot = join(ctx.projectsRoot, "gym");
  configureGymRoot(gymRoot);
  const packet = reconciliationPacket(ctx.task);
  const trigger = triggerDetails(ctx.task);
  const input = record(packet?.input ?? trigger);
  const taskId = String(packet?.taskId ?? "improve/may");
  const generation = Number(packet?.generation ?? 1);
  if (!Number.isInteger(generation) || generation < 1) {
    return ctx.blocked("Improvement task has no valid generation");
  }
  if (input.curriculumDrain !== true) {
    return runImprovementOnce(ctx, loop, input, taskId, generation);
  }

  try {
    const { targets, fingerprint } = loadCurriculumTargets(gymRoot);
    const agent = safeName(input.agent, "may");
    if (!agent) throw new Error("Invalid curriculum agent");
    const agentPath = join(dirname(ctx.projectsRoot), "agents", agent);
    const agentFingerprint = `sha256:${fingerprintAgentLearningSurface(agentPath)}`;
    const checkpointPath = join(
      ctx.projectsRoot,
      "gym.app",
      ".state",
      "learning",
      "training-drain.json",
    );
    const checkpoint = readJson<TrainingDrainCheckpoint>(checkpointPath);
    if (
      checkpoint?.curriculum_fingerprint === fingerprint &&
      checkpoint.agent_fingerprint === agentFingerprint
    ) {
      const summary = "May already passes every approved learning track.";
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: [checkpointPath, ...checkpoint.evidence],
        actions: [],
      });
    }

    const sequence = await runCurriculumSequence(
      targets,
      (target) =>
        runImprovementOnce(
          ctx,
          loop,
          {
            agent,
            benchmark: target.benchmark,
            scenarios: target.scenarios,
            trials: target.trials,
            reason: `curriculum-drain:${target.id}`,
          },
          taskId,
          generation,
          target.id,
        ) as Promise<Record<string, unknown>>,
    );
    if (sequence.state === "stopped") {
      return sequence.result as unknown as WorkflowResult;
    }
    const evidence = boundedEvidence(
      sequence.results.flatMap((result) => {
        const output = record(result.output);
        const values = Array.isArray(output.evidence)
          ? output.evidence
          : Array.isArray(result.evidence)
            ? result.evidence
            : [];
        return values.map(String);
      }),
    );
    writeJson(checkpointPath, {
      schema_version: 1,
      agent,
      curriculum_fingerprint: fingerprint,
      agent_fingerprint: agentFingerprint,
      exhausted_at: new Date().toISOString(),
      targets: targets.map(({ id }) => id),
      evidence,
    } satisfies TrainingDrainCheckpoint);
    const summary = `May passes all ${targets.length} approved learning tracks; training material is exhausted.`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [checkpointPath, ...evidence],
      actions: [],
    });
  } catch (error) {
    const summary = error instanceof Error ? error.message : String(error);
    return ctx.done(summary, {
      state: "needs-owner",
      summary,
      evidence: [],
    });
  }
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  return runImprovement(ctx);
}
