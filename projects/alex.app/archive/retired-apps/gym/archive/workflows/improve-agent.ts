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
  Condition,
  ExecutionResult,
  TaskAction,
  WorkflowContext,
} from "@may-agent/sdk";
import {
  callGymAgent,
  emitGymEvent,
  gymEvent,
  gymProjectsRoot,
} from "./lib/context";
import { reconciliationPacket, safeKey, triggerDetails } from "./lib/trigger";
import {
  readGuidedPracticeResult,
  runGuidedPractice,
} from "./lib/guided-practice";

export const name = "improve-agent";
export const description =
  "Evaluate May, classify each finding, and iterate one isolated candidate at a time until progress stops or one verified proposal is ready.";
export const workspace = "shared";
export const executionTimeoutMs = 120 * 60_000;

type GymExecutionResult = ExecutionResult<any>;

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
  state: "converged" | "waiting" | "needs-agent";
  evidence: string[];
  actions: TaskAction[];
  conditions: Condition[];
  approval: ApprovalRequest | null;
}

type CampaignNext = "done" | "wait-for-approval" | "ask-owner";
type TrackState = "complete" | "issue";
type CompletionKind =
  | "no-actionable-failure"
  | "non-may-disposition"
  | "artifact-applied";

interface AssessmentProblem {
  kind: "missing-manifest" | "invalid-run" | "not-reproduced";
  summary: string;
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
  schema_version: 2;
  agent: string;
  campaign_id: string;
  curriculum_fingerprint: string;
  agent_fingerprint: string;
  updated_at: string;
  exhausted_at: string | null;
  tracks: Array<{
    id: string;
    state: "complete" | "issue";
    summary: string;
    evidence: string[];
  }>;
  evidence: string[];
}

interface CurriculumExperiment {
  target: CurriculumTarget;
  input: Record<string, unknown>;
  scope: string;
  assessmentPath: string;
  assessmentWasFresh: boolean;
  assessment: Assessment;
  problem?: AssessmentProblem;
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
  condition: Condition;
}

interface EvaluationOnlyAdjustment {
  schema_version: 1;
  kind: "verify-candidate";
  candidateFingerprint: string;
  benchmark: string;
  scenarios: "active-suite";
  freshBaseline: true;
}

interface ApprovalResponse {
  decision: "approve" | "adjust" | "decline";
  message: string;
  adjustment?: EvaluationOnlyAdjustment;
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
  const rows = (Array.isArray(config.tracks) ? config.tracks : []).filter(
    (value) => record(value).enabled !== false,
  );
  const targets = rows.flatMap((value) => {
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
      .filter((scenario) => {
        const label = record(labels[String(scenario)]);
        return (
          label.status === "approved" &&
          String(label.approved_by ?? "").trim().length > 0 &&
          String(label.approved_at ?? "").trim().length > 0
        );
      })
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
    const approved = (scenarios as string[]).filter((scenario) =>
      approvedScenarios.includes(scenario),
    );
    return approved.length
      ? [{ id, benchmark, scenarios: approved, trials }]
      : [];
  });
  if (new Set(targets.map(({ id }) => id)).size !== targets.length) {
    throw new Error("Autonomous May training tracks must be unique");
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
  let deferredIssue: T | null = null;
  for (const target of targets) {
    const result = await runTarget(target);
    results.push(result);
    const output = record(result.output);
    const state = String(output.state ?? result.state ?? "");
    const summary = String(output.summary ?? result.summary ?? "");
    if (state !== "converged") {
      return { state: "stopped", result, results };
    }
    if (
      summary !==
      "May has no actionable failures in the current approved evaluation."
    ) {
      deferredIssue ??= result;
    }
  }
  if (deferredIssue)
    return { state: "stopped", result: deferredIssue, results };
  return { state: "exhausted", results };
}

export function learningPromptLines(
  units: LearningUnitContext[],
  guidedPracticeResultPath?: string,
): string[] {
  if (!units.length) return [];
  return [
    "Use these reviewed learning resources to generalize the candidate. Do not copy benchmark-specific names or expected answer wording into the agent:",
    ...units.flatMap((unit) => [
      `Learning unit: ${unit.id} v${unit.version} — ${unit.title}`,
      `Competencies: ${unit.competencies.join(", ")}`,
      `Lesson: ${unit.lessonPath}`,
      `Practice: ${unit.practicePath}`,
      ...(unit.guidedPracticePath
        ? [`Guided practice plan: ${unit.guidedPracticePath}`]
        : []),
      `Reviewed evidence: ${unit.evidencePath}`,
      `Canonical sources: ${unit.sourcePaths.join(", ")}`,
    ]),
    ...(guidedPracticeResultPath
      ? [
          `Observed guided practice: ${guidedPracticeResultPath}`,
          "Use the real calls, lifecycle evidence, result review, and reflection in that record. Repair the mechanism behind missed practice; do not merely restate the lesson.",
          "A lifecycle.invalid entry means runtime/evidence could not support an assessment, not an agent behavior failure. Do not train or score the agent against that invalid attempt.",
        ]
      : []),
  ];
}

function readManifest(runDir: string): LoopRunManifest {
  return JSON.parse(
    readFileSync(join(runDir, "manifest.json"), "utf8"),
  ) as LoopRunManifest;
}

export function verificationBenchmark(
  verificationDir: string,
  fallback: string,
): string {
  const benchmark = safeName(readManifest(verificationDir).benchmark, fallback);
  if (!benchmark) {
    throw new Error("Failed verification has an invalid benchmark name");
  }
  return benchmark;
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
    if (observed.size === 0) {
      result.invalid.push(scenario);
      continue;
    }
    if (observed.has("fail")) result.fail.push(scenario);
    if (observed.has("invalid")) result.invalid.push(scenario);
    if (!observed.has("fail") && !observed.has("invalid"))
      result.pass.push(scenario);
  }
  return result;
}

export function authoritativeAssessmentProblems(
  screening: LoopRunManifest,
  retry: LoopRunManifest | null,
): { failing: string[]; invalid: string[] } {
  const screened = scenarioVerdicts(screening);
  const retried = retry ? scenarioVerdicts(retry) : null;
  const failing = new Set([...screened.fail, ...(retried?.fail ?? [])]);
  const invalid = (retried?.invalid ?? screened.invalid).filter(
    (scenario) => !failing.has(scenario),
  );
  return {
    failing: [...failing].sort(),
    invalid: [...new Set(invalid)].sort(),
  };
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
  const metricsDir = join(gymProjectsRoot(ctx), "gym.app", ".state", "metrics");
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
    comparison.same_framework_revision &&
    comparison.no_invalid_runs &&
    comparison.no_regressions
  );
}

export function isFrameworkOnlyComparisonFailure(
  comparison: RunComparison,
): boolean {
  return (
    comparison.gate === "fail" &&
    comparison.labels_approved === true &&
    comparison.same_framework_revision === false &&
    comparison.no_invalid_runs === true &&
    comparison.no_regressions === true &&
    comparison.improved === true
  );
}

export function isBaselineInvalidOnlyComparisonFailure(
  checkpoint: VerificationCheckpoint,
): boolean {
  const { comparison, manifest } = checkpoint;
  return (
    manifest.trials.length > 0 &&
    manifest.trials.every((trial) => trial.machine_verdict === "pass") &&
    comparison.gate === "fail" &&
    comparison.labels_approved === true &&
    comparison.same_framework_revision === true &&
    comparison.no_invalid_runs === false &&
    comparison.no_regressions === true &&
    comparison.improved === true
  );
}

export function isCandidateInvalidOnlyComparisonFailure(
  checkpoint: VerificationCheckpoint,
  baseline: LoopRunManifest,
): boolean {
  const { comparison, manifest } = checkpoint;
  return (
    manifest.trials.some((trial) => trial.machine_verdict === "invalid") &&
    manifest.trials.every((trial) => trial.machine_verdict !== "fail") &&
    baseline.trials.length > 0 &&
    baseline.trials.every((trial) => trial.machine_verdict !== "invalid") &&
    comparison.gate === "fail" &&
    comparison.labels_approved === true &&
    comparison.same_framework_revision === true &&
    comparison.no_invalid_runs === false
  );
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function nextResultRevisionPath(resultPath: string): string {
  const revisionsDir = join(dirname(resultPath), "result-revisions");
  mkdirSync(revisionsDir, { recursive: true });
  const next =
    readdirSync(revisionsDir, { withFileTypes: true }).reduce(
      (maximum, entry) => {
        const match = entry.isFile() ? entry.name.match(/^(\d+)\.json$/) : null;
        return match ? Math.max(maximum, Number(match[1])) : maximum;
      },
      0,
    ) + 1;
  return join(revisionsDir, `${String(next).padStart(6, "0")}.json`);
}

/**
 * Preserve each emitted workflow result before updating result.json. The
 * generation-level path intentionally remains the mutable compatibility
 * pointer; callers asserting terminal evidence must cite the returned path.
 */
export function writeWorkflowResultRevision(
  resultPath: string,
  value: unknown,
): string {
  const revisionPath = nextResultRevisionPath(resultPath);
  const result = record(value);
  const evidence = Array.isArray(result.evidence)
    ? result.evidence
        .map(String)
        .map((item) => (item === resultPath ? revisionPath : item))
    : undefined;
  const approval = result.approval ? record(result.approval) : null;
  const durable = {
    ...result,
    result_revision_path: revisionPath,
    result_latest_path: resultPath,
    ...(evidence ? { evidence } : {}),
    ...(approval
      ? {
          approval: {
            ...approval,
            packetRevisionPath: revisionPath,
            packetLatestPath: resultPath,
          },
        }
      : {}),
  };
  const bytes = `${JSON.stringify(durable, null, 2)}\n`;
  // A revision path is allocated once and never renamed or replaced.
  writeFileSync(revisionPath, bytes, { flag: "wx" });
  mkdirSync(dirname(resultPath), { recursive: true });
  const temporary = `${resultPath}.tmp`;
  writeFileSync(temporary, bytes);
  renameSync(temporary, resultPath);
  return revisionPath;
}

function writeJson(path: string, value: unknown): string {
  if (path.endsWith(`${sep}result.json`)) {
    return writeWorkflowResultRevision(path, value);
  }
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, path);
  return path;
}

async function classifyFailures(
  ctx: WorkflowContext,
  failing: string[],
  runDirs: string[],
): Promise<Finding[] | null> {
  if (!failing.length) return [];
  const result = await callGymAgent(
    ctx,
    "gym",
    [
      "Classify every listed failing Gym scenario from immutable evidence.",
      "Return each scenario exactly once. Group scenarios only when they show the same responsible failure family.",
      "Choose agent only when approved evidence establishes May behavior. Use benchmark, scorer, runtime, or noise for the responsible alternative.",
      "A passing deterministic check proves only the objective contract, structure, or safety rule it checks. It does not prove that open-ended meaning or communication is good.",
      "When calibrated semantic judges reject a valid Task result, classify May unless the evidence identifies a concrete rubric, control, judge, or evaluator defect. Cite the exact semantic rule and relevant candidate language either way.",
      "Use scorer only for a demonstrated evaluator defect, such as semantically equivalent wording receiving different results from a literal token check. Judge disagreement by itself is not proof that the scorer is wrong.",
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

async function completeFocusedBaseline(
  ctx: WorkflowContext,
  input: Record<string, unknown>,
  assessmentPath: string,
  assessment: Assessment,
  loop: GymLoopApi,
  sourceRuns: Array<{ runDir: string; manifest: LoopRunManifest }> = [],
): Promise<{ assessment: Assessment; problem?: AssessmentProblem }> {
  if (!assessment.focus) return { assessment };
  const storedBaseline = Boolean(assessment.baseline_run_dir);
  let baseline = assessment.baseline_run_dir
    ? {
        runDir: assessment.baseline_run_dir,
        manifest: readJson<LoopRunManifest>(
          join(assessment.baseline_run_dir, "manifest.json"),
        ),
      }
    : sourceRuns.find(
        (run) =>
          sameScenarios(run.manifest.scenarios, assessment.focus!.scenarios) &&
          scenarioVerdicts(run.manifest).invalid.length === 0,
      );
  if (baseline && !baseline.manifest) {
    return {
      assessment,
      problem: {
        kind: "missing-manifest",
        summary: "The stored development baseline is missing its manifest.",
      },
    };
  }
  if (storedBaseline) {
    const storedVerdicts = scenarioVerdicts(baseline!.manifest!);
    if (storedVerdicts.invalid.length) {
      return {
        assessment,
        problem: {
          kind: "invalid-run",
          summary:
            "The focused May failure remained invalid after one bounded retry.",
        },
      };
    }
    if (!storedVerdicts.fail.length) {
      return {
        assessment,
        problem: {
          kind: "not-reproduced",
          summary:
            "The focused May failure did not reproduce in the frozen development baseline.",
        },
      };
    }
    return { assessment };
  }
  const trials = requestedTrials(input.trials);
  const agentsRoot = join(dirname(gymProjectsRoot(ctx)), "agents");
  if (!baseline) {
    baseline = await loop.run({
      phase: "test",
      benchmark: assessment.benchmark,
      scenarios: assessment.focus.scenarios,
      agent: assessment.agent,
      candidate: "baseline",
      trials,
      agentsRoot,
    });
  }
  let baselineVerdicts = scenarioVerdicts(baseline.manifest!);
  if (baselineVerdicts.invalid.length) {
    baseline = await loop.run({
      phase: "test",
      benchmark: assessment.benchmark,
      scenarios: assessment.focus.scenarios,
      agent: assessment.agent,
      candidate: "baseline",
      trials,
      agentsRoot,
    });
    baselineVerdicts = scenarioVerdicts(baseline.manifest!);
  }
  assessment.baseline_run_id = baseline.manifest!.run_id;
  assessment.baseline_run_dir = baseline.runDir;
  writeAssessment(assessmentPath, assessment);
  if (baselineVerdicts.invalid.length) {
    return {
      assessment,
      problem: {
        kind: "invalid-run",
        summary:
          "The focused May failure remained invalid after one bounded retry.",
      },
    };
  }
  if (!baselineVerdicts.fail.length) {
    return {
      assessment,
      problem: {
        kind: "not-reproduced",
        summary:
          "The focused May failure did not reproduce in the frozen development baseline.",
      },
    };
  }
  return { assessment };
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
): Promise<{ assessment: Assessment; problem?: AssessmentProblem }> {
  if (existsSync(assessmentPath)) {
    const assessment = JSON.parse(
      readFileSync(assessmentPath, "utf8"),
    ) as Assessment;
    return completeFocusedBaseline(
      ctx,
      input,
      assessmentPath,
      assessment,
      loop,
    );
  }

  const benchmark = safeName(input.benchmark, "may-alignment");
  const agent = safeName(input.agent, "may");
  if (!benchmark || !agent) throw new Error("Invalid benchmark or agent name");
  const trials = requestedTrials(input.trials);
  const gymRoot = join(gymProjectsRoot(ctx), "gym");
  const gate = approvalGate(gymRoot, benchmark, requestedScenarios(input));
  if (gate.unapproved.length) {
    throw new Error(
      `Benchmark truth is not approved: ${gate.unapproved.join(", ")}`,
    );
  }
  const agentsRoot = join(dirname(gymProjectsRoot(ctx)), "agents");
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

  const { failing, invalid } = authoritativeAssessmentProblems(
    screening.manifest,
    retry?.manifest ?? null,
  );
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
  // Classification is a durable stage boundary. Recovery may resume the
  // focused reproducibility baseline without repeating broad screening.
  writeAssessment(assessmentPath, assessment);
  return completeFocusedBaseline(
    ctx,
    input,
    assessmentPath,
    assessment,
    loop,
    sourceRuns,
  );
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
    gymProjectsRoot(ctx),
    "gym",
    ".state",
    "benchmarks",
    baselineRunId,
  );
  if (!existsSync(join(baselineDir, "manifest.json"))) return null;
  const suite = record(
    JSON.parse(
      readFileSync(
        join(
          gymProjectsRoot(ctx),
          "gym",
          "benchmarks",
          benchmark,
          "suite.json",
        ),
        "utf8",
      ),
    ),
  );
  const suiteScenarios = Array.isArray(suite.scenarios)
    ? suite.scenarios.map(String)
    : [];
  const learningUnits = resolveLearningContexts(
    join(gymProjectsRoot(ctx), "gym"),
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
  return gymEvent("gym.improvement.requested", {
    agent: input.agent,
    benchmark: input.benchmark,
    scenarios: [...input.scenarios],
    trials: 3,
    reason: "approved-benchmark-fix-applied",
    artifactFingerprint: input.artifactFingerprint,
    taskId: input.taskId,
    taskGeneration: input.taskGeneration,
    approvalId: input.approvalId,
  });
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
  const storedPacket = readJson<Record<string, unknown>>(request.packetPath);
  const packetRevisionPath = String(
    (request as ApprovalRequest & { packetRevisionPath?: string })
      .packetRevisionPath ??
      storedPacket?.result_revision_path ??
      request.packetPath,
  );
  const approval = {
    ...request,
    packetRevisionPath,
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

  void emitGymEvent(
    ctx,
    gymEvent("project.approval.requested", {
      taskId: request.taskId,
      taskGeneration: request.taskGeneration,
      approvalKind: request.kind,
      approvalId: request.approvalId,
      waitId: request.waitId,
      artifactFingerprint: request.artifactFingerprint,
      packetPath: request.packetPath,
      packetRevisionPath,
      requestedAction: request.requestedAction,
      reason: request.reason,
      expectedResponse,
    }),
  );
  void emitGymEvent(
    ctx,
    gymEvent(
      "message.created",
      {
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
          `Immutable review packet: ${packetRevisionPath}`,
          `Latest-state compatibility pointer: ${request.packetPath}`,
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
        packetRevisionPath,
        pathId: request.taskId,
        requestedAction: request.requestedAction,
        reason: request.reason,
        expectedResponse,
        dedupKey: request.approvalId,
      },
      { target: { human: true } },
    ),
  );
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
  const approval = approvalFromStored(value);
  const recoverableInterruption =
    !approval && value.stop_reason === "runtime-interrupted";
  if (recoverableInterruption) return null;
  const safetyStop = value.stop_reason === "candidate-safety-limit";
  if (safetyStop) {
    value.stop_reason = "candidate-safety-limit";
    value.next = "ask-owner";
    value.conditions = [];
    value.approval = null;
    writeJson(path, value);
  }
  const next = String(value.next ?? "") as CampaignNext;
  const legacyState = String(value.workflow_state ?? "");
  const recognized =
    next === "done" ||
    next === "wait-for-approval" ||
    next === "ask-owner" ||
    legacyState === "converged" ||
    legacyState === "waiting" ||
    legacyState === "needs-agent" ||
    Boolean(approval);
  if (!recognized) {
    value.next = "ask-owner";
    value.conditions = [];
    value.approval = null;
    writeJson(path, value);
  }
  return {
    summary,
    state:
      safetyStop || next === "ask-owner" || legacyState === "needs-agent"
        ? "needs-agent"
        : next === "wait-for-approval" || legacyState === "waiting" || approval
          ? "waiting"
          : next === "done" || legacyState === "converged"
            ? "converged"
            : "needs-agent",
    evidence: boundedEvidence(
      Array.isArray(value.evidence)
        ? [path, ...value.evidence.map(String)]
        : [path],
    ),
    actions: Array.isArray(value.actions)
      ? (value.actions as TaskAction[])
      : [],
    conditions: Array.isArray(value.conditions)
      ? (value.conditions as Condition[])
      : [],
    approval,
  };
}

function requestedCandidateRetry(
  input: Record<string, unknown>,
  stored: Record<string, unknown>,
): boolean {
  if (String(input.reason ?? "") !== "retry-candidate-verification") {
    return false;
  }
  const requested = String(input.candidateFingerprint ?? "").replace(
    /^sha256:/,
    "",
  );
  const actual = String(stored.candidate_fingerprint ?? "").replace(
    /^sha256:/,
    "",
  );
  return Boolean(requested && actual && requested === actual);
}

interface CandidateRetryLocation {
  scope?: string;
  resultPath?: string;
  error?: string;
  evidence: string[];
}

interface CandidateRetryCheckpoint {
  iteration: number;
  candidatePath: string;
  candidateFingerprint: string;
}

function candidateRetryCheckpoint(
  stateDir: string,
  requested: string,
): CandidateRetryCheckpoint | null {
  const iterationsDir = join(stateDir, "iterations");
  if (!existsSync(iterationsDir)) return null;
  const matches = readdirSync(iterationsDir, { withFileTypes: true }).flatMap(
    (entry) => {
      if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) return [];
      const iteration = Number(entry.name);
      const iterationDir = join(iterationsDir, entry.name);
      const retry = readJson<Record<string, unknown>>(
        join(iterationDir, "verification-retry.json"),
      );
      const candidate = readJson<CandidateCheckpoint>(
        join(iterationDir, "candidate.json"),
      );
      if (
        String(retry?.candidate_fingerprint ?? "").replace(/^sha256:/, "") !==
          requested ||
        candidate?.candidateFingerprint !== requested ||
        !candidate.candidatePath ||
        !existsSync(candidate.candidatePath) ||
        fingerprintTree(candidate.candidatePath) !== requested
      ) {
        return [];
      }
      return [
        {
          iteration,
          candidatePath: candidate.candidatePath,
          candidateFingerprint: requested,
        },
      ];
    },
  );
  return matches.length === 1 ? matches[0]! : null;
}

export function locateCandidateRetry(
  projectsRoot: string,
  taskId: string,
  generation: number,
  input: Record<string, unknown>,
): CandidateRetryLocation | null {
  if (String(input.reason ?? "") !== "retry-candidate-verification") {
    return null;
  }
  const requested = String(input.candidateFingerprint ?? "")
    .replace(/^sha256:/, "")
    .trim();
  if (!/^[a-f0-9]{64}$/.test(requested)) {
    return {
      error: "Exact candidate retry requires a valid candidate fingerprint",
      evidence: [],
    };
  }

  const generationDir = join(
    projectsRoot,
    "gym.app",
    ".state",
    "candidates",
    safeKey(taskId, "improve-may"),
    String(generation),
  );
  const resultPaths = [join(generationDir, "result.json")];
  const tracksDir = join(generationDir, "tracks");
  if (existsSync(tracksDir)) {
    resultPaths.push(
      ...readdirSync(tracksDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(tracksDir, entry.name, "result.json")),
    );
  }

  const matches = resultPaths.filter((resultPath) => {
    const stored = readJson<Record<string, unknown>>(resultPath);
    if (
      String(stored?.candidate_fingerprint ?? "").replace(/^sha256:/, "") ===
      requested
    ) {
      return true;
    }
    return candidateRetryCheckpoint(dirname(resultPath), requested) !== null;
  });
  if (matches.length !== 1) {
    return {
      error:
        matches.length === 0
          ? "Exact candidate retry found no matching result in this generation"
          : "Exact candidate retry found multiple matching results in this generation",
      evidence: matches.length ? matches : resultPaths.filter(existsSync),
    };
  }

  const resultPath = matches[0]!;
  const relativeResult = relative(generationDir, resultPath).split(sep);
  return {
    ...(relativeResult[0] === "tracks" ? { scope: relativeResult[1] } : {}),
    resultPath,
    evidence: [resultPath],
  };
}

function adjudicationChildCloseActions(
  ctx: WorkflowContext,
  taskId: string,
): TaskAction[] {
  const packet = reconciliationPacket(ctx);
  const live = record(packet?.children).live;
  if (!Array.isArray(live)) return [];
  return live.flatMap((value) => {
    const child = record(value);
    const childId = String(child.taskId ?? "");
    const generation = Number(child.generation);
    if (
      !childId.startsWith(`${taskId}/adjudicate-`) ||
      !Number.isInteger(generation) ||
      generation < 1
    ) {
      return [];
    }
    return [
      {
        kind: "close-task" as const,
        taskId: childId,
        expectedGeneration: generation,
        summary:
          "Retired nested adjudication state; the exact candidate retry stays on improve/may.",
      },
    ];
  });
}

function appendTaskActions(
  result: GymExecutionResult,
  actions: TaskAction[],
): GymExecutionResult {
  if (result.status !== "done" || !actions.length) return result;
  if (result.output && typeof result.output === "object") {
    const output = record(result.output);
    return {
      ...result,
      output: {
        ...output,
        actions: [
          ...(Array.isArray(output.actions)
            ? (output.actions as TaskAction[])
            : []),
          ...actions,
        ],
      },
    };
  }
  return Object.assign(result, { actions });
}

function evaluationOnlyAdjustmentFromValue(
  value: unknown,
): EvaluationOnlyAdjustment | null {
  const raw = record(value);
  const candidateFingerprint = String(raw.candidateFingerprint ?? "").replace(
    /^sha256:/,
    "",
  );
  const benchmark = safeName(raw.benchmark, "");
  if (
    raw.schema_version !== 1 ||
    raw.kind !== "verify-candidate" ||
    !/^[a-f0-9]{64}$/.test(candidateFingerprint) ||
    !benchmark ||
    raw.scenarios !== "active-suite" ||
    raw.freshBaseline !== true
  ) {
    return null;
  }
  return {
    schema_version: 1,
    kind: "verify-candidate",
    candidateFingerprint,
    benchmark,
    scenarios: "active-suite",
    freshBaseline: true,
  };
}

export function evaluationOnlyAdjustmentFromResponse(
  response: ApprovalResponse,
): EvaluationOnlyAdjustment | null {
  return response.decision === "adjust" && response.adjustment
    ? evaluationOnlyAdjustmentFromValue(response.adjustment)
    : null;
}

function approvalResponse(
  trigger: Record<string, unknown> | null,
  request: ApprovalRequest,
): ApprovalResponse | null {
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
  const response: ApprovalResponse = {
    decision,
    message: String(trigger.message ?? decision),
  };
  const adjustment = evaluationOnlyAdjustmentFromValue(trigger.adjustment);
  if (decision === "adjust" && adjustment) response.adjustment = adjustment;
  return response;
}

function approvalDecision(
  ctx: WorkflowContext,
  request: ApprovalRequest,
  stateDir?: string,
): ApprovalResponse | null {
  const live = approvalResponse(triggerDetails(ctx), request);
  if (live || !stateDir) return live;
  const decisionKey = safeKey(request.artifactFingerprint, "artifact");
  for (const path of [
    join(stateDir, "decisions", decisionKey, "decision.json"),
    join(stateDir, "approval-decision.json"),
  ]) {
    const stored = readJson<Record<string, unknown>>(path);
    if (!stored) continue;
    const response = approvalResponse(
      {
        type: "project.approval.submitted",
        ...stored,
      },
      request,
    );
    if (response) return response;
  }
  return null;
}

function preserveApprovalDecision(
  stateDir: string,
  stored: Record<string, unknown>,
  request: ApprovalRequest,
  response: ApprovalResponse,
): { decisionPath: string; proposalPath: string; artifactPath: string | null } {
  const decisionDir = join(
    stateDir,
    "decisions",
    safeKey(request.artifactFingerprint, "artifact"),
  );
  mkdirSync(decisionDir, { recursive: true });
  const proposalPath = join(decisionDir, "proposal.json");
  const decisionPath = join(decisionDir, "decision.json");
  let artifactPath: string | null = null;
  const currentArtifact = String(stored.artifact_path ?? "");
  if (currentArtifact && existsSync(currentArtifact)) {
    artifactPath = join(decisionDir, "artifact");
    if (!existsSync(artifactPath)) {
      cpSync(currentArtifact, artifactPath, { recursive: true });
    }
  }
  if (!existsSync(proposalPath)) {
    writeJson(proposalPath, {
      ...stored,
      ...(artifactPath ? { artifact_path: artifactPath } : {}),
      preserved_at: new Date().toISOString(),
    });
  }
  writeJson(decisionPath, {
    schema_version: 1,
    ...response,
    ...request,
    proposalPath,
    recorded_at: new Date().toISOString(),
  });
  return { decisionPath, proposalPath, artifactPath };
}

function preservedEvaluationAdjustment(
  stateDir: string,
  trigger: Record<string, unknown> | null,
): {
  request: ApprovalRequest;
  response: ApprovalResponse;
  adjustment: EvaluationOnlyAdjustment;
  decisionPath: string;
  proposalPath: string;
} | null {
  if (trigger?.type !== "project.approval.submitted") return null;
  const artifactFingerprint = String(trigger.artifactFingerprint ?? "");
  if (!artifactFingerprint) return null;
  const decisionDir = join(
    stateDir,
    "decisions",
    safeKey(artifactFingerprint, "artifact"),
  );
  const decisionPath = join(decisionDir, "decision.json");
  const proposalPath = join(decisionDir, "proposal.json");
  const decision = readJson<Record<string, unknown>>(decisionPath);
  const proposal = readJson<Record<string, unknown>>(proposalPath);
  if (!decision || !proposal) return null;
  const request = approvalFromStored(proposal);
  if (!request || request.kind !== "benchmark-fix") return null;
  const liveResponse = approvalResponse(trigger, request);
  const storedResponse = approvalResponse(
    { type: "project.approval.submitted", ...decision },
    request,
  );
  if (
    !liveResponse ||
    !storedResponse ||
    liveResponse.decision !== storedResponse.decision ||
    liveResponse.message !== storedResponse.message
  ) {
    return null;
  }
  const adjustment = evaluationOnlyAdjustmentFromResponse(liveResponse);
  if (!adjustment) return null;
  return {
    request,
    response: liveResponse,
    adjustment,
    decisionPath,
    proposalPath,
  };
}

function recoverableStoredEvaluationAdjustment(
  stateDir: string,
  stored: Record<string, unknown>,
  taskId: string,
  generation: number,
): {
  request: ApprovalRequest;
  adjustment: EvaluationOnlyAdjustment;
  decisionPath: string;
} | null {
  if (stored.next !== "ask-owner" || stored.approval) return null;
  const review = record(stored.review);
  const proposedChange = String(review.proposedChange ?? "").trim();
  const evidence = Array.isArray(review.evidence)
    ? review.evidence.map(String)
    : [];
  if (!proposedChange) return null;
  const candidates = evidence.flatMap((rawPath) => {
    const decisionPath = resolve(rawPath);
    const decisionRelative = relative(
      join(stateDir, "decisions"),
      decisionPath,
    );
    if (
      decisionRelative === ".." ||
      decisionRelative.startsWith(`..${sep}`) ||
      !decisionPath.endsWith(`${sep}decision.json`)
    ) {
      return [];
    }
    const proposalPath = join(dirname(decisionPath), "proposal.json");
    const decision = readJson<Record<string, unknown>>(decisionPath);
    const proposal = readJson<Record<string, unknown>>(proposalPath);
    if (!decision || !proposal) return [];
    const request = approvalFromStored(proposal);
    if (
      !request ||
      request.kind !== "benchmark-fix" ||
      request.taskId !== taskId ||
      request.taskGeneration !== generation ||
      request.packetPath !== join(stateDir, "result.json")
    ) {
      return [];
    }
    const response = approvalResponse(
      { type: "project.approval.submitted", ...decision },
      request,
    );
    if (
      !response ||
      response.decision !== "adjust" ||
      response.message !== proposedChange
    ) {
      return [];
    }
    const adjustment = evaluationOnlyAdjustmentFromResponse(response);
    if (
      !adjustment ||
      String(stored.candidate_fingerprint ?? "").replace(/^sha256:/, "") !==
        adjustment.candidateFingerprint
    ) {
      return [];
    }
    return [{ request, adjustment, decisionPath }];
  });
  return candidates.length === 1 ? candidates[0]! : null;
}

function locateStoredEvaluationAdjustment(
  projectsRoot: string,
  taskId: string,
  generation: number,
  input: Record<string, unknown>,
):
  | { stateDir: string; resultPath: string; evidence: string[] }
  | { error: string; evidence: string[] }
  | null {
  if (
    String(input.reason ?? "") !== "resume-preserved-evaluation-only-adjustment"
  ) {
    return null;
  }

  const generationDir = join(
    projectsRoot,
    "gym.app",
    ".state",
    "candidates",
    safeKey(taskId, "improve-may"),
    String(generation),
  );
  const resultPaths = [join(generationDir, "result.json")];
  const tracksDir = join(generationDir, "tracks");
  if (existsSync(tracksDir)) {
    resultPaths.push(
      ...readdirSync(tracksDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(tracksDir, entry.name, "result.json")),
    );
  }

  const matches = resultPaths.flatMap((resultPath) => {
    const stored = readJson<Record<string, unknown>>(resultPath);
    if (!stored) return [];
    const recovery = recoverableStoredEvaluationAdjustment(
      dirname(resultPath),
      stored,
      taskId,
      generation,
    );
    return recovery
      ? [{ stateDir: dirname(resultPath), resultPath, recovery }]
      : [];
  });
  if (matches.length !== 1) {
    return {
      error:
        matches.length === 0
          ? "No preserved evaluation-only adjustment matches this campaign"
          : "Multiple preserved evaluation-only adjustments match this campaign",
      evidence: matches.length
        ? matches.flatMap(({ resultPath, recovery }) => [
            resultPath,
            recovery.decisionPath,
          ])
        : resultPaths.filter(existsSync),
    };
  }
  const match = matches[0]!;
  return {
    stateDir: match.stateDir,
    resultPath: match.resultPath,
    evidence: [match.resultPath, match.recovery.decisionPath],
  };
}

export function locateApprovalPacket(
  projectsRoot: string,
  taskId: string,
  generation: number,
  trigger: Record<string, unknown> | null,
):
  | { stateDir: string; resultPath: string }
  | { error: string; evidence: string[] }
  | null {
  if (trigger?.type !== "project.approval.submitted") return null;
  const rawPacketPath = String(trigger.packetPath ?? "").trim();
  if (!rawPacketPath) return null;
  const campaignRoot = resolve(
    projectsRoot,
    "gym.app",
    ".state",
    "candidates",
    safeKey(taskId, "improve-may"),
    String(generation),
  );
  const resultPath = resolve(rawPacketPath);
  const packetRelative = relative(campaignRoot, resultPath);
  if (
    packetRelative === ".." ||
    packetRelative.startsWith(`..${sep}`) ||
    !resultPath.endsWith(`${sep}result.json`)
  ) {
    return {
      error: "Exact approval packet is outside the campaign state",
      evidence: [resultPath, campaignRoot],
    };
  }
  if (!existsSync(resultPath)) {
    return {
      error: "Exact approval packet is missing",
      evidence: [resultPath],
    };
  }
  let stored: Record<string, unknown>;
  try {
    stored = record(JSON.parse(readFileSync(resultPath, "utf8")));
  } catch (error) {
    return {
      error: `Exact approval packet is invalid: ${error instanceof Error ? error.message : String(error)}`,
      evidence: [resultPath],
    };
  }
  const approval = approvalFromStored(stored);
  const preserved = preservedEvaluationAdjustment(dirname(resultPath), trigger);
  if ((!approval || !approvalResponse(trigger, approval)) && !preserved) {
    return {
      error: "Approval does not match the exact stored packet",
      evidence: [resultPath],
    };
  }
  return { stateDir: dirname(resultPath), resultPath };
}

function planFromApprovalPacket(
  ctx: WorkflowContext,
  resultPath: string,
): CandidatePlan | null {
  const stored = record(JSON.parse(readFileSync(resultPath, "utf8")));
  const assessmentPath = String(stored.assessment_path ?? "");
  if (!assessmentPath || !existsSync(assessmentPath)) return null;
  const assessment = JSON.parse(
    readFileSync(assessmentPath, "utf8"),
  ) as Assessment;
  const rawFocus = record(stored.focus);
  const classification = String(rawFocus.classification ?? "") as FindingClass;
  const scenarios = Array.isArray(rawFocus.scenarios)
    ? rawFocus.scenarios.map(String)
    : [];
  if (
    !["agent", "benchmark", "scorer", "runtime", "noise"].includes(
      classification,
    ) ||
    !scenarios.length
  ) {
    return null;
  }
  const focus: Finding = {
    classification,
    scenarios,
    ...(String(rawFocus.failureFamily ?? "")
      ? { failureFamily: String(rawFocus.failureFamily) }
      : {}),
    summary: String(rawFocus.summary ?? "Approved evaluation fix"),
    evidence: Array.isArray(rawFocus.evidence)
      ? rawFocus.evidence.map(String)
      : [],
  };
  const baselineRunId = String(
    stored.baseline_run_id ??
      assessment.baseline_run_id ??
      assessment.screening_run_id,
  );
  const baselineDir = String(
    assessment.baseline_run_dir ?? assessment.screening_run_dir,
  );
  if (
    !assessment.agent ||
    !assessment.benchmark ||
    !baselineRunId ||
    !baselineDir
  ) {
    return null;
  }
  const approval = approvalFromStored(stored);
  const learningUnits =
    approval?.kind === "benchmark-fix"
      ? []
      : resolveLearningContexts(
          join(gymProjectsRoot(ctx), "gym"),
          assessment.benchmark,
          scenarios,
        );
  return {
    agent: assessment.agent,
    benchmark: assessment.benchmark,
    releaseBenchmark: assessment.release_benchmark ?? assessment.benchmark,
    releaseScenarios: assessment.release_scenarios,
    baselineRunId,
    baselineDir,
    focus,
    assessmentPath,
    learningUnits,
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
  confirmationBenchmark: string;
  confirmationScenarios: string[];
} | null> {
  const gymRoot = join(gymProjectsRoot(ctx), "gym");
  const consumerBenchmark = verificationBenchmark(
    verificationDir,
    plan.benchmark,
  );
  const failedManifest = readManifest(verificationDir);
  const failedScenarios = [
    ...new Set(
      failedManifest.trials
        .filter((trial) => trial.machine_verdict !== "pass")
        .map((trial) => trial.scenario),
    ),
  ];
  const target = benchmarkFixTarget({
    gymRoot,
    benchmark: consumerBenchmark,
    disposition: review.disposition,
    scenario: failedScenarios.length === 1 ? failedScenarios[0] : undefined,
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
  const result = await callGymAgent(
    ctx,
    "gym-implementer",
    [
      "Build one narrow isolated benchmark/scorer fix from this reviewed Gym evidence.",
      `Responsible layer: ${review.disposition}`,
      `Consumer benchmark: ${consumerBenchmark}`,
      `Writable artifact: ${target.path}`,
      ...(target.evaluatorPath
        ? [`Resolved evaluator: ${target.evaluatorPath}`]
        : []),
      `Review: ${review.summary}`,
      `Proposed change: ${review.proposedChange}`,
      `Failed verification: ${verificationDir}`,
      `Writable benchmark snapshot: ${workspacePath}`,
      "Edit only that snapshot. Do not edit production, agent files, run evidence, task state, or Git state.",
      "Keep the change minimal. Preserve approved truth unless the proposal explicitly identifies truth that requires Hao's approval.",
      "Use deterministic checks for objective structure and safety. Use calibrated semantic criteria with positive and negative controls for open-ended meaning.",
      "Reject synonym lists, phrase normalization, and exact-word matching as fixes for open-ended meaning.",
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
    confirmationBenchmark: consumerBenchmark,
    confirmationScenarios: failedScenarios,
  };
}

function benchmarkFixConfirmationTarget(
  stored: Record<string, unknown>,
  plan: CandidatePlan,
): { benchmark: string; scenarios: string[] } {
  const storedBenchmark = safeName(stored.confirmation_benchmark, "");
  const storedScenarios = Array.isArray(stored.confirmation_scenarios)
    ? stored.confirmation_scenarios
        .map((scenario) => safeName(scenario, ""))
        .filter((scenario): scenario is string => Boolean(scenario))
    : [];
  if (storedBenchmark && storedScenarios.length) {
    return { benchmark: storedBenchmark, scenarios: storedScenarios };
  }

  const verificationDir = String(stored.verification_run_dir ?? "").trim();
  const manifestPath = join(verificationDir, "manifest.json");
  if (verificationDir && existsSync(manifestPath)) {
    const manifest = readManifest(verificationDir);
    const benchmark = safeName(manifest.benchmark, plan.benchmark);
    const scenarios = [
      ...new Set(
        manifest.trials
          .filter((trial) => trial.machine_verdict !== "pass")
          .map((trial) => trial.scenario),
      ),
    ];
    if (benchmark && scenarios.length) return { benchmark, scenarios };
  }

  return { benchmark: plan.benchmark, scenarios: [...plan.focus.scenarios] };
}

export function benchmarkFixTarget(input: {
  gymRoot: string;
  benchmark: string;
  disposition: FailedReview["disposition"];
  scenario?: string;
}): { benchmark: string; path: string; evaluatorPath: string | null } {
  const benchmarksRoot = resolve(input.gymRoot, "benchmarks");
  const consumerPath = join(benchmarksRoot, input.benchmark);
  if (input.disposition === "review-benchmark" && input.scenario) {
    const scenario = safeName(input.scenario, "");
    const scenarioPath = scenario
      ? join(resolve(input.gymRoot, "scenarios"), scenario)
      : "";
    if (scenario && existsSync(scenarioPath)) {
      return {
        benchmark: scenario,
        path: scenarioPath,
        evaluatorPath: null,
      };
    }
  }
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

export function recoverCompletedReleaseBaseline(
  gymRoot: string,
  benchmark: string,
  agent: string,
  releaseScenarios: string[],
  notBefore: string | null,
): { runDir: string; manifest: LoopRunManifest } | null {
  const runsRoot = join(gymRoot, ".state", "benchmarks");
  if (!existsSync(runsRoot)) return null;
  const minimumStartedAt = Date.parse(notBefore ?? "");
  const recovered = readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const runDir = join(runsRoot, entry.name);
      const manifest = readJson<LoopRunManifest>(join(runDir, "manifest.json"));
      if (
        !manifest?.completed_at ||
        manifest.phase !== "test" ||
        manifest.candidate !== "baseline" ||
        !isReleaseBaseline(
          manifest,
          gymRoot,
          benchmark,
          agent,
          releaseScenarios,
        ) ||
        (Number.isFinite(minimumStartedAt) &&
          Date.parse(manifest.started_at) < minimumStartedAt)
      ) {
        return [];
      }
      return [{ runDir, manifest }];
    })
    .sort(
      (left, right) =>
        Date.parse(right.manifest.completed_at!) -
        Date.parse(left.manifest.completed_at!),
    );
  return recovered[0] ?? null;
}

function hasCompleteTrialSet(
  manifest: LoopRunManifest,
  scenarios: string[],
  trials: number,
): boolean {
  if (manifest.trials.length !== scenarios.length * trials) return false;
  const expected = new Set(
    scenarios.flatMap((scenario) =>
      Array.from({ length: trials }, (_, index) => `${scenario}\n${index + 1}`),
    ),
  );
  for (const trial of manifest.trials) {
    if (!expected.delete(`${trial.scenario}\n${trial.trial}`)) return false;
  }
  return expected.size === 0;
}

export function recoverCompletedVerification(input: {
  gymRoot: string;
  baselineRunId: string;
  benchmark: string;
  agent: string;
  candidate: string;
  candidateFingerprint: string;
  scenarios: string[];
  trials: number;
  notBefore: string | null;
}): VerificationCheckpoint | null {
  const runsRoot = join(input.gymRoot, ".state", "benchmarks");
  if (!existsSync(runsRoot)) return null;
  const minimumStartedAt = Date.parse(input.notBefore ?? "");
  const recovered = readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const runDir = join(runsRoot, entry.name);
      const manifest = readJson<LoopRunManifest>(join(runDir, "manifest.json"));
      const comparison = readJson<RunComparison>(
        join(runDir, "comparison.json"),
      );
      if (
        !manifest?.completed_at ||
        !comparison ||
        manifest.phase !== "verify" ||
        manifest.baseline_run_id !== input.baselineRunId ||
        manifest.benchmark !== input.benchmark ||
        manifest.agent !== input.agent ||
        manifest.candidate !== input.candidate ||
        manifest.proof.candidate_fingerprint !== input.candidateFingerprint ||
        manifest.trials_per_scenario !== input.trials ||
        !sameScenarios(manifest.scenarios, input.scenarios) ||
        !hasCompleteTrialSet(manifest, input.scenarios, input.trials) ||
        comparison.baseline_run_id !== input.baselineRunId ||
        comparison.candidate_run_id !== manifest.run_id ||
        (Number.isFinite(minimumStartedAt) &&
          Date.parse(manifest.started_at) < minimumStartedAt)
      ) {
        return [];
      }
      return [{ runDir, manifest, comparison }];
    })
    .sort(
      (left, right) =>
        Date.parse(right.manifest.completed_at!) -
        Date.parse(left.manifest.completed_at!),
    );
  return recovered[0] ?? null;
}

async function reviewFailedCandidate(
  ctx: WorkflowContext,
  plan: CandidatePlan,
  verificationDir: string,
): Promise<FailedReview | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await callGymAgent(
      ctx,
      "gym",
      [
        "Review this failed May candidate before deciding what changes next.",
        "Read the baseline, comparison, failed decisions, approved expected answers, scorer checks, prompt/model provenance, and runtime evidence.",
        "Read the exact candidate snapshot preserved by the verification manifest. Use the skill.loaded trace to distinguish model retrieval failure from a loaded-skill policy failure; never infer activation from task wording.",
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
): string {
  return writeJson(resultPath, {
    schema_version: 1,
    ...value,
    actions: [],
    completed_at: new Date().toISOString(),
  });
}

function saveAttentionResult(
  ctx: WorkflowContext,
  resultPath: string,
  summary: string,
  evidence: string[],
  details: Record<string, unknown> = {},
): GymExecutionResult {
  const bounded = boundedEvidence([resultPath, ...evidence]);
  const previous = readJson<Record<string, unknown>>(resultPath) ?? {};
  const revisionPath = saveWorkflowResult(resultPath, {
    ...previous,
    ...details,
    summary,
    evidence: bounded,
    completion_kind: null,
    track_state: null,
    next: "ask-owner",
    conditions: [],
    approval: null,
  });
  return ctx.done(summary, {
    state: "needs-agent",
    summary,
    evidence: boundedEvidence([revisionPath, ...evidence]),
  });
}

function saveCompletedResult(
  resultPath: string,
  input: {
    taskId: string;
    generation: number;
    summary: string;
    evidence: string[];
    completionKind: CompletionKind;
    trackState: TrackState;
    details?: Record<string, unknown>;
  },
): string[] {
  const evidence = boundedEvidence([resultPath, ...input.evidence]);
  const revisionPath = saveWorkflowResult(resultPath, {
    task_id: input.taskId,
    generation: input.generation,
    ...input.details,
    summary: input.summary,
    evidence,
    completion_kind: input.completionKind,
    track_state: input.trackState,
    next: "done",
    conditions: [],
    approval: null,
  });
  return boundedEvidence([revisionPath, ...input.evidence]);
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
): Promise<GymExecutionResult | IterationRevision> {
  const productionAgentsRoot = join(dirname(gymProjectsRoot(ctx)), "agents");
  const sourceMay = join(productionAgentsRoot, plan.agent);
  if (!existsSync(sourceMay)) {
    return saveAttentionResult(
      ctx,
      resultPath,
      `Agent not found: ${sourceMay}`,
      [sourceMay],
      { task_id: taskId, generation, iteration },
    );
  }
  const workspaceAgentsRoot = join(scratchRoot, "agents");
  const workspaceMay = join(workspaceAgentsRoot, plan.agent);
  const candidateId = `gym/${plan.agent}/g${generation}-i${iteration}`;
  const candidateDir = join(workspaceAgentsRoot, ".lab", candidateId);
  const guidedPracticePath = join(iterationDir, "guided-practice.json");
  rmSync(scratchRoot, { recursive: true, force: true });
  mkdirSync(workspaceAgentsRoot, { recursive: true });
  cpSync(sourceMay, workspaceMay, { recursive: true });

  const durableCandidate = join(iterationDir, plan.agent);
  const candidateCheckpointPath = join(iterationDir, "candidate.json");
  let candidateCheckpoint = readJson<CandidateCheckpoint>(
    candidateCheckpointPath,
  );
  if (!candidateCheckpoint || !existsSync(durableCandidate)) {
    const hasGuidedPractice = plan.learningUnits.some(
      ({ guidedPracticeCases }) => guidedPracticeCases.length > 0,
    );
    let guidedPractice = hasGuidedPractice
      ? readGuidedPracticeResult(guidedPracticePath)
      : null;
    if (!guidedPractice && hasGuidedPractice) {
      guidedPractice = await runGuidedPractice({
        ctx,
        agent: plan.agent,
        units: plan.learningUnits,
      });
      writeJson(guidedPracticePath, guidedPractice);
    }
    mkdirSync(candidateDir, { recursive: true });
    if (baseCandidatePath && existsSync(baseCandidatePath)) {
      cpSync(baseCandidatePath, candidateDir, { recursive: true });
    }
    const result = await callGymAgent(
      ctx,
      "gym-implementer",
      [
        "Build one narrow isolated May candidate for this approved Gym finding.",
        `Failure family: ${plan.focus.failureFamily}`,
        `Scenarios: ${JSON.stringify(plan.focus.scenarios)}`,
        `Finding: ${plan.focus.summary}`,
        `Immutable baseline: ${plan.baselineDir}`,
        ...learningPromptLines(
          plan.learningUnits,
          guidedPractice ? guidedPracticePath : undefined,
        ),
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
        "When repeated valid trials show model-selected skill retrieval is unreliable, improve the skill name, description, catalog visibility, or the calling workflow's explicit skill selection. Do not add keyword or regex activation over task prose.",
        "Require an opposite control so improved discoverability or explicit selection does not make May over-apply the skill.",
        "Before finishing, validate candidate agent.json and every changed skill package with the May-agent loaders.",
        `Candidate overlay directory: ${candidateDir}`,
        ...(plan.revision
          ? [
              "The candidate overlay already contains the exact previous failed candidate. Revise it in place and preserve every unrelated earlier candidate change.",
              "Do not repopulate the overlay from production May or the prepared workspace May. Remove or replace a prior candidate rule or skill only when the failed review explicitly identifies that same mechanism for removal.",
            ]
          : []),
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
      return saveAttentionResult(
        ctx,
        resultPath,
        "Candidate implementation failed",
        [result.sessionId, result.lastAssistantText ?? result.status],
        { task_id: taskId, generation, iteration },
      );
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
    return saveAttentionResult(
      ctx,
      resultPath,
      "Durable candidate changed after it was checkpointed",
      [candidateCheckpointPath, durableCandidate],
      { task_id: taskId, generation, iteration },
    );
  }
  if (plan.revision?.previousCandidateFingerprint === candidateFingerprint) {
    const summary = `Candidate iteration ${iteration} made no artifact change; autonomous progress stopped.`;
    return saveAttentionResult(
      ctx,
      resultPath,
      summary,
      [candidateCheckpointPath, durableCandidate],
      { task_id: taskId, generation, iteration },
    );
  }

  let baselineManifest = readManifest(plan.baselineDir);
  let developmentBaselineDir = plan.baselineDir;
  let developmentBaselineRunId = plan.baselineRunId;
  const requestedVerificationRetry = readJson<Record<string, unknown>>(
    join(iterationDir, "verification-retry.json"),
  );
  const freshBaselineCheckpointPath = join(
    iterationDir,
    "development-baseline-retry.json",
  );
  let freshBaseline = readJson<{
    runDir: string;
    manifest: LoopRunManifest;
  }>(freshBaselineCheckpointPath);
  if (
    requestedVerificationRetry?.fresh_baseline_required === true &&
    !freshBaseline
  ) {
    freshBaseline = await loop.run({
      phase: "test",
      benchmark: plan.benchmark,
      scenarios: plan.focus.scenarios,
      agent: plan.agent,
      candidate: "baseline",
      trials: baselineManifest.trials_per_scenario,
      agentsRoot: workspaceAgentsRoot,
    });
    writeJson(freshBaselineCheckpointPath, freshBaseline);
  }
  if (freshBaseline) {
    baselineManifest = freshBaseline.manifest;
    developmentBaselineDir = freshBaseline.runDir;
    developmentBaselineRunId = freshBaseline.manifest.run_id;
  }
  const developmentCheckpointPath = join(
    iterationDir,
    "development-verification.json",
  );
  let development = readJson<VerificationCheckpoint>(developmentCheckpointPath);
  if (!development) {
    development = await loop.verify({
      baseline: developmentBaselineRunId,
      candidate: candidateId,
      trials: baselineManifest.trials_per_scenario,
      agentsRoot: workspaceAgentsRoot,
    });
    writeJson(developmentCheckpointPath, development);
  }
  if (
    development.manifest.proof.candidate_fingerprint !== candidateFingerprint
  ) {
    return saveAttentionResult(
      ctx,
      resultPath,
      "Candidate fingerprint does not match verification",
      [durableCandidate, development.runDir],
      { task_id: taskId, generation, iteration },
    );
  }
  recordVerificationMetrics(ctx, development);

  const gymRoot = join(gymProjectsRoot(ctx), "gym");
  let comparison = development.comparison;
  if (isFrameworkOnlyComparisonFailure(comparison) && !freshBaseline) {
    freshBaseline = await loop.run({
      phase: "test",
      benchmark: plan.benchmark,
      scenarios: plan.focus.scenarios,
      agent: plan.agent,
      candidate: "baseline",
      trials: baselineManifest.trials_per_scenario,
      agentsRoot: workspaceAgentsRoot,
    });
    writeJson(freshBaselineCheckpointPath, freshBaseline);
    baselineManifest = freshBaseline.manifest;
    developmentBaselineDir = freshBaseline.runDir;
    development = await loop.verify({
      baseline: freshBaseline.manifest.run_id,
      candidate: candidateId,
      trials: freshBaseline.manifest.trials_per_scenario,
      agentsRoot: workspaceAgentsRoot,
    });
    writeJson(developmentCheckpointPath, development);
    if (
      development.manifest.proof.candidate_fingerprint !== candidateFingerprint
    ) {
      return saveAttentionResult(
        ctx,
        resultPath,
        "Candidate fingerprint does not match same-framework verification",
        [durableCandidate, development.runDir],
        { task_id: taskId, generation, iteration },
      );
    }
    recordVerificationMetrics(ctx, development);
    comparison = development.comparison;
  }
  const cleanBaselineCheckpointPath = join(
    iterationDir,
    "development-baseline-invalid-retry.json",
  );
  let cleanBaseline = readJson<{
    runDir: string;
    manifest: LoopRunManifest;
  }>(cleanBaselineCheckpointPath);
  if (
    cleanBaseline &&
    development.comparison.baseline_run_id === cleanBaseline.manifest.run_id
  ) {
    baselineManifest = cleanBaseline.manifest;
    developmentBaselineDir = cleanBaseline.runDir;
    developmentBaselineRunId = cleanBaseline.manifest.run_id;
  }
  if (
    isBaselineInvalidOnlyComparisonFailure(development) &&
    development.comparison.baseline_run_id !== cleanBaseline?.manifest.run_id
  ) {
    cleanBaseline ??= await loop.run({
      phase: "test",
      benchmark: plan.benchmark,
      scenarios: plan.focus.scenarios,
      agent: plan.agent,
      candidate: "baseline",
      trials: baselineManifest.trials_per_scenario,
      agentsRoot: workspaceAgentsRoot,
    });
    writeJson(cleanBaselineCheckpointPath, cleanBaseline);
    baselineManifest = cleanBaseline.manifest;
    developmentBaselineDir = cleanBaseline.runDir;
    developmentBaselineRunId = cleanBaseline.manifest.run_id;
    development = await loop.verify({
      baseline: developmentBaselineRunId,
      candidate: candidateId,
      trials: baselineManifest.trials_per_scenario,
      agentsRoot: workspaceAgentsRoot,
    });
    writeJson(developmentCheckpointPath, development);
    if (
      development.manifest.proof.candidate_fingerprint !== candidateFingerprint
    ) {
      return saveAttentionResult(
        ctx,
        resultPath,
        "Candidate fingerprint does not match clean-baseline verification",
        [durableCandidate, development.runDir],
        { task_id: taskId, generation, iteration },
      );
    }
    recordVerificationMetrics(ctx, development);
    comparison = development.comparison;
  }
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
        ? { runDir: developmentBaselineDir, manifest: baselineManifest }
        : (recoverCompletedReleaseBaseline(
            gymRoot,
            plan.releaseBenchmark,
            plan.agent,
            plan.releaseScenarios,
            development.manifest.completed_at,
          ) ??
          (await loop.run({
            phase: "test",
            benchmark: plan.releaseBenchmark,
            scenarios: plan.releaseScenarios,
            agent: plan.agent,
            candidate: "baseline",
            trials: RELEASE_TRIALS,
            agentsRoot: workspaceAgentsRoot,
          })));
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
    const releaseRetryCheckpointPath = join(
      iterationDir,
      "release-verification-invalid-retry.json",
    );
    const storedReleaseRetry = readJson<VerificationCheckpoint>(
      releaseRetryCheckpointPath,
    );
    if (storedReleaseRetry) {
      release = storedReleaseRetry;
    } else if (
      isCandidateInvalidOnlyComparisonFailure(release, releaseBaseline.manifest)
    ) {
      release = await loop.verify({
        baseline: releaseBaseline.manifest.run_id,
        candidate: candidateId,
        trials: releaseBaseline.manifest.trials_per_scenario,
        agentsRoot: workspaceAgentsRoot,
      });
      writeJson(releaseRetryCheckpointPath, release);
    }
    if (release.manifest.proof.candidate_fingerprint !== candidateFingerprint) {
      return saveAttentionResult(
        ctx,
        resultPath,
        "Release fingerprint does not match candidate",
        [durableCandidate, release.runDir],
        { task_id: taskId, generation, iteration },
      );
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
    return saveAttentionResult(
      ctx,
      resultPath,
      "Gym could not review the failed candidate",
      [durableCandidate, verificationDir],
      { task_id: taskId, generation, iteration },
    );
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
    return saveAttentionResult(
      ctx,
      resultPath,
      "Gym could not build an isolated benchmark/scorer fix",
      [verificationDir, ...(review?.evidence ?? [])],
      { task_id: taskId, generation, iteration },
    );
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
  const workflowState = approval
    ? "waiting"
    : review?.disposition === "needs-human"
      ? "needs-agent"
      : "converged";
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
  const resultRevisionPath = saveWorkflowResult(resultPath, {
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
    confirmation_benchmark: benchmarkFix?.confirmationBenchmark ?? null,
    confirmation_scenarios: benchmarkFix?.confirmationScenarios ?? null,
    development_verification_run_dir: development.runDir,
    release_baseline_run_dir: releaseBaselineDir,
    verification_run_dir: verificationDir,
    gate: verificationPassed ? "pass" : comparison.gate,
    recommendation,
    review,
    summary,
    evidence,
    ...(workflowState === "converged"
      ? {
          completion_kind: "non-may-disposition" satisfies CompletionKind,
          track_state: "issue" satisfies TrackState,
        }
      : {}),
    next:
      workflowState === "waiting"
        ? "wait-for-approval"
        : workflowState === "needs-agent"
          ? "ask-owner"
          : "done",
    conditions: approval ? [approval.condition] : [],
    approval,
  });
  void emitGymEvent(
    ctx,
    gymEvent("gym.improvement.reviewed", {
      taskId,
      agent: plan.agent,
      candidateId,
      candidateFingerprint,
      verificationDir,
      recommendation,
      resultPath,
    }),
  );
  const resultEvidence = boundedEvidence([
    resultRevisionPath,
    ...evidence.filter((item) => item !== resultPath),
  ]);
  const durableApproval = approval
    ? (approvalFromStored(
        readJson<Record<string, unknown>>(resultPath) ?? {},
      ) ?? approval)
    : null;
  if (durableApproval) dispatchApproval(ctx, durableApproval);
  if (!approval) {
    return ctx.done(summary, {
      state: workflowState,
      summary,
      evidence: resultEvidence,
      ...(workflowState === "converged" ? { actions: [] } : {}),
    });
  }
  return ctx.done(summary, {
    state: "waiting",
    summary,
    evidence: resultEvidence,
    actions: [],
    conditions: [approval.condition],
  });
}

async function runEvaluationOnlyAdjustment(
  ctx: WorkflowContext,
  loop: GymLoopApi,
  plan: CandidatePlan,
  adjustment: EvaluationOnlyAdjustment,
  sourceApproval: ApprovalRequest,
  stored: Record<string, unknown>,
  stateDir: string,
  taskId: string,
  generation: number,
  decisionPath: string,
): Promise<GymExecutionResult> {
  const resultPath = join(stateDir, "result.json");
  const iteration = Number(stored.iteration);
  const candidatePath = resolve(String(stored.candidate_path ?? ""));
  const storedFingerprint = String(stored.candidate_fingerprint ?? "").replace(
    /^sha256:/,
    "",
  );
  const candidateRelative = relative(stateDir, candidatePath);
  const candidateCheckpointPath = join(
    stateDir,
    "iterations",
    String(iteration),
    "candidate.json",
  );
  const candidateCheckpoint = readJson<CandidateCheckpoint>(
    candidateCheckpointPath,
  );
  if (
    !Number.isInteger(iteration) ||
    iteration < 1 ||
    !candidatePath ||
    candidateRelative === ".." ||
    candidateRelative.startsWith(`..${sep}`) ||
    !existsSync(candidatePath) ||
    storedFingerprint !== adjustment.candidateFingerprint ||
    candidateCheckpoint?.candidatePath !== candidatePath ||
    candidateCheckpoint.candidateFingerprint !==
      adjustment.candidateFingerprint ||
    fingerprintTree(candidatePath) !== adjustment.candidateFingerprint
  ) {
    return saveAttentionResult(
      ctx,
      resultPath,
      "Evaluation-only adjustment does not match the exact durable candidate",
      [decisionPath, candidateCheckpointPath, candidatePath],
      { task_id: taskId, generation, evaluation_adjustment: adjustment },
    );
  }

  const gymRoot = join(gymProjectsRoot(ctx), "gym");
  let gate: ReturnType<typeof approvalGate>;
  try {
    gate = approvalGate(gymRoot, adjustment.benchmark, []);
  } catch (error) {
    return saveAttentionResult(
      ctx,
      resultPath,
      error instanceof Error ? error.message : String(error),
      [decisionPath],
      { task_id: taskId, generation, evaluation_adjustment: adjustment },
    );
  }
  if (gate.unapproved.length) {
    return saveAttentionResult(
      ctx,
      resultPath,
      `Evaluation-only adjustment includes unapproved truth: ${gate.unapproved.join(", ")}`,
      [decisionPath, gate.labelsPath],
      { task_id: taskId, generation, evaluation_adjustment: adjustment },
    );
  }

  const protectedPath = String(stored.artifact_target_path ?? "").trim();
  if (protectedPath && !existsSync(protectedPath)) {
    return saveAttentionResult(
      ctx,
      resultPath,
      "Benchmark kept by the adjustment is missing",
      [decisionPath, protectedPath],
      { task_id: taskId, generation, evaluation_adjustment: adjustment },
    );
  }
  const protectedFingerprint = protectedPath
    ? fingerprintTree(protectedPath)
    : null;
  const adjustmentKey = safeKey(
    sourceApproval.artifactFingerprint,
    "verification-adjustment",
  );
  const adjustmentDir = join(
    stateDir,
    "iterations",
    String(iteration),
    "adjustments",
    adjustmentKey,
  );
  const requestPath = join(adjustmentDir, "request.json");
  const baselinePath = join(adjustmentDir, "baseline.json");
  const verificationPath = join(adjustmentDir, "verification.json");
  mkdirSync(adjustmentDir, { recursive: true });
  if (!existsSync(requestPath)) {
    writeJson(requestPath, {
      schema_version: 1,
      task_id: taskId,
      generation,
      source_approval_id: sourceApproval.approvalId,
      source_artifact_fingerprint: sourceApproval.artifactFingerprint,
      decision_path: decisionPath,
      adjustment,
      candidate_path: candidatePath,
      scenarios: gate.scenarios,
      trials: RELEASE_TRIALS,
      protected_path: protectedPath || null,
      protected_fingerprint: protectedFingerprint,
      requested_at: new Date().toISOString(),
    });
  }
  const request = readJson<Record<string, unknown>>(requestPath);
  const requestAdjustment = evaluationOnlyAdjustmentFromValue(
    request?.adjustment,
  );
  const requestScenarios = Array.isArray(request?.scenarios)
    ? request.scenarios.map(String)
    : [];
  if (
    request?.schema_version !== 1 ||
    request.task_id !== taskId ||
    Number(request.generation) !== generation ||
    request.source_approval_id !== sourceApproval.approvalId ||
    request.source_artifact_fingerprint !==
      sourceApproval.artifactFingerprint ||
    request.decision_path !== decisionPath ||
    request.candidate_path !== candidatePath ||
    JSON.stringify(requestAdjustment) !== JSON.stringify(adjustment) ||
    !sameScenarios(requestScenarios, gate.scenarios) ||
    Number(request.trials) !== RELEASE_TRIALS ||
    request.protected_path !== (protectedPath || null) ||
    request.protected_fingerprint !== protectedFingerprint
  ) {
    return saveAttentionResult(
      ctx,
      resultPath,
      "Durable evaluation-only request no longer matches its protected inputs",
      [decisionPath, requestPath, candidatePath, protectedPath].filter(Boolean),
      { task_id: taskId, generation, evaluation_adjustment: adjustment },
    );
  }

  const productionAgentsRoot = join(dirname(gymProjectsRoot(ctx)), "agents");
  const sourceMay = join(productionAgentsRoot, plan.agent);
  if (!existsSync(sourceMay)) {
    return saveAttentionResult(
      ctx,
      resultPath,
      `Agent not found: ${sourceMay}`,
      [decisionPath, sourceMay],
      { task_id: taskId, generation, evaluation_adjustment: adjustment },
    );
  }
  const scratchRoot = join(
    gymProjectsRoot(ctx),
    "gym.app",
    ".state",
    "scratch",
    safeKey(taskId, "improve-may"),
    String(generation),
    `evaluation-only-${adjustmentKey}`,
  );
  const workspaceAgentsRoot = join(scratchRoot, "agents");
  const candidateId = `gym/${plan.agent}/g${generation}-i${iteration}-adjustment-${adjustmentKey}`;
  const candidateDir = join(workspaceAgentsRoot, ".lab", candidateId);

  try {
    rmSync(scratchRoot, { recursive: true, force: true });
    mkdirSync(workspaceAgentsRoot, { recursive: true });
    cpSync(sourceMay, join(workspaceAgentsRoot, plan.agent), {
      recursive: true,
    });
    mkdirSync(dirname(candidateDir), { recursive: true });
    cpSync(candidatePath, candidateDir, { recursive: true });

    let baseline = readJson<{
      runDir: string;
      manifest: LoopRunManifest;
    }>(baselinePath);
    if (!baseline) {
      baseline = await loop.run({
        phase: "test",
        benchmark: adjustment.benchmark,
        scenarios: gate.scenarios,
        agent: plan.agent,
        candidate: "baseline",
        trials: RELEASE_TRIALS,
        agentsRoot: workspaceAgentsRoot,
      });
      writeJson(baselinePath, baseline);
    }
    if (
      baseline.manifest.phase !== "test" ||
      baseline.manifest.candidate !== "baseline" ||
      baseline.manifest.benchmark !== adjustment.benchmark ||
      baseline.manifest.agent !== plan.agent ||
      baseline.manifest.trials_per_scenario !== RELEASE_TRIALS ||
      !sameScenarios(baseline.manifest.scenarios, gate.scenarios)
    ) {
      return saveAttentionResult(
        ctx,
        resultPath,
        "Fresh baseline does not match the evaluation-only adjustment",
        [requestPath, baselinePath, baseline.runDir],
        { task_id: taskId, generation, evaluation_adjustment: adjustment },
      );
    }

    let verification = readJson<VerificationCheckpoint>(verificationPath);
    if (!verification) {
      verification =
        recoverCompletedVerification({
          gymRoot,
          baselineRunId: baseline.manifest.run_id,
          benchmark: adjustment.benchmark,
          agent: plan.agent,
          candidate: candidateId,
          candidateFingerprint: adjustment.candidateFingerprint,
          scenarios: gate.scenarios,
          trials: RELEASE_TRIALS,
          notBefore: baseline.manifest.completed_at,
        }) ??
        (await loop.verify({
          baseline: baseline.manifest.run_id,
          candidate: candidateId,
          trials: RELEASE_TRIALS,
          agentsRoot: workspaceAgentsRoot,
        }));
      writeJson(verificationPath, verification);
    }
    recordVerificationMetrics(ctx, verification);
    const candidateMatches =
      Boolean(verification.manifest.completed_at) &&
      verification.manifest.phase === "verify" &&
      verification.manifest.baseline_run_id === baseline.manifest.run_id &&
      verification.manifest.benchmark === adjustment.benchmark &&
      verification.manifest.agent === plan.agent &&
      verification.manifest.candidate === candidateId &&
      verification.manifest.proof.candidate_fingerprint ===
        adjustment.candidateFingerprint &&
      verification.manifest.trials_per_scenario === RELEASE_TRIALS &&
      sameScenarios(verification.manifest.scenarios, gate.scenarios) &&
      hasCompleteTrialSet(
        verification.manifest,
        gate.scenarios,
        RELEASE_TRIALS,
      ) &&
      verification.comparison.baseline_run_id === baseline.manifest.run_id &&
      verification.comparison.candidate_run_id === verification.manifest.run_id;
    const protectedUnchanged =
      !protectedPath ||
      (existsSync(protectedPath) &&
        fingerprintTree(protectedPath) === protectedFingerprint);
    if (!candidateMatches || !protectedUnchanged) {
      return saveAttentionResult(
        ctx,
        resultPath,
        !candidateMatches
          ? "Candidate verification does not match the exact adjustment"
          : "A benchmark that the adjustment kept unchanged was modified",
        [
          requestPath,
          baselinePath,
          verificationPath,
          verification.runDir,
          ...(protectedPath ? [protectedPath] : []),
        ],
        { task_id: taskId, generation, evaluation_adjustment: adjustment },
      );
    }

    if (!qualifiesHeldBackRelease(verification)) {
      const summary =
        "The fresh approved-suite comparison did not pass every promotion gate";
      const evidence = saveCompletedResult(resultPath, {
        taskId,
        generation,
        summary,
        evidence: [
          decisionPath,
          requestPath,
          baselinePath,
          verificationPath,
          verification.runDir,
          join(verification.runDir, "comparison.json"),
        ],
        completionKind: "non-may-disposition",
        trackState: "issue",
        details: {
          ...stored,
          task_id: taskId,
          generation,
          candidate_path: candidatePath,
          candidate_fingerprint: adjustment.candidateFingerprint,
          evaluation_adjustment: adjustment,
          gate: verification.comparison.gate,
          recommendation: "verification-failed",
        },
      });
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence,
        actions: [],
      });
    }

    const approval = buildApprovalRequest({
      kind: "agent-improvement",
      taskId,
      generation,
      artifactFingerprint: `sha256:${adjustment.candidateFingerprint}`,
      packetPath: resultPath,
      requestedAction:
        "Approve this exact freshly verified May candidate for production promotion?",
      reason:
        "The exact candidate passed every active approved scenario against a fresh same-framework baseline, with no invalid runs or regressions.",
    });
    const summary =
      "The exact May candidate passed the requested fresh approved-suite comparison and is waiting for promotion approval.";
    const evidence = boundedEvidence([
      resultPath,
      decisionPath,
      requestPath,
      candidateCheckpointPath,
      candidatePath,
      `candidate-sha256:${adjustment.candidateFingerprint}`,
      gate.labelsPath,
      baselinePath,
      baseline.runDir,
      verificationPath,
      verification.runDir,
      join(verification.runDir, "comparison.json"),
      ...(protectedPath ? [protectedPath] : []),
    ]);
    const resultRevisionPath = saveWorkflowResult(resultPath, {
      ...stored,
      task_id: taskId,
      generation,
      iteration,
      candidate_id: candidateId,
      candidate_path: candidatePath,
      candidate_fingerprint: adjustment.candidateFingerprint,
      artifact_path: candidatePath,
      artifact_target_path: null,
      confirmation_benchmark: null,
      confirmation_scenarios: null,
      development_verification_run_dir: verification.runDir,
      release_baseline_run_dir: baseline.runDir,
      verification_run_dir: verification.runDir,
      evaluation_adjustment: adjustment,
      gate: "pass",
      recommendation: "promote",
      review: null,
      summary,
      evidence,
      next: "wait-for-approval",
      conditions: [approval.condition],
      approval,
    });
    await emitGymEvent(
      ctx,
      gymEvent("gym.improvement.reviewed", {
        taskId,
        agent: plan.agent,
        candidateId,
        candidateFingerprint: adjustment.candidateFingerprint,
        verificationDir: verification.runDir,
        recommendation: "promote",
        resultPath,
      }),
    );
    dispatchApproval(ctx, approval);
    return ctx.done(summary, {
      state: "waiting",
      summary,
      evidence: boundedEvidence([
        resultRevisionPath,
        ...evidence.filter((item) => item !== resultPath),
      ]),
      actions: [],
      conditions: [approval.condition],
    });
  } catch (error) {
    return saveAttentionResult(
      ctx,
      resultPath,
      `Evaluation-only adjustment failed: ${error instanceof Error ? error.message : String(error)}`,
      [decisionPath, requestPath, baselinePath, verificationPath],
      { task_id: taskId, generation, evaluation_adjustment: adjustment },
    );
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

async function prepareBenchmarkFixProposal(
  ctx: WorkflowContext,
  plan: CandidatePlan,
  review: FailedReview,
  stateDir: string,
  taskId: string,
  generation: number,
  priorEvidence: string[] = [],
): Promise<GymExecutionResult> {
  const resultPath = join(stateDir, "result.json");
  const revisionKey = createHash("sha256")
    .update(`${review.disposition}\n${review.proposedChange}`)
    .digest("hex")
    .slice(0, 16);
  const scratchRoot = join(
    gymProjectsRoot(ctx),
    "gym.app",
    ".state",
    "scratch",
    safeKey(taskId, "improve-may"),
    String(generation),
    `benchmark-fix-${revisionKey}`,
  );
  let fix: Awaited<ReturnType<typeof buildBenchmarkFix>>;
  try {
    fix = await buildBenchmarkFix(
      ctx,
      plan,
      review,
      stateDir,
      plan.baselineDir,
      scratchRoot,
    );
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
  if (!fix) {
    const summary =
      "Gym could not build a new benchmark/scorer proposal from the reviewed evidence.";
    return saveAttentionResult(
      ctx,
      resultPath,
      summary,
      [
        plan.assessmentPath,
        plan.baselineDir,
        ...priorEvidence,
        ...review.evidence,
      ],
      {
        task_id: taskId,
        generation,
        assessment_path: plan.assessmentPath,
        baseline_run_id: plan.baselineRunId,
        focus: plan.focus,
        recommendation: review.disposition,
        review,
      },
    );
  }

  const approval = buildApprovalRequest({
    kind: "benchmark-fix",
    taskId,
    generation,
    artifactFingerprint: fix.fingerprint,
    packetPath: resultPath,
    requestedAction:
      "Approve this exact benchmark/scorer fix and a fresh baseline?",
    reason: `${review.summary} ${fix.summary}`,
  });
  const summary = `Gym prepared an exact benchmark/scorer fix and is waiting for approval. ${fix.summary}`;
  const evidence = boundedEvidence([
    resultPath,
    plan.assessmentPath,
    plan.baselineDir,
    fix.path,
    `benchmark-fix-${fix.fingerprint}`,
    ...priorEvidence,
    ...plan.focus.evidence,
    ...review.evidence,
    ...fix.evidence,
  ]);
  const resultRevisionPath = saveWorkflowResult(resultPath, {
    task_id: taskId,
    generation,
    assessment_path: plan.assessmentPath,
    baseline_run_id: plan.baselineRunId,
    focus: plan.focus,
    artifact_path: fix.path,
    artifact_target_path: fix.targetPath,
    confirmation_benchmark: fix.confirmationBenchmark,
    confirmation_scenarios: fix.confirmationScenarios,
    verification_run_dir: plan.baselineDir,
    recommendation: review.disposition,
    review,
    summary,
    evidence,
    next: "wait-for-approval",
    conditions: [approval.condition],
    approval,
  });
  await emitGymEvent(
    ctx,
    gymEvent("gym.improvement.reviewed", {
      taskId,
      agent: plan.agent,
      artifactFingerprint: fix.fingerprint,
      recommendation: review.disposition,
      resultPath,
    }),
  );
  dispatchApproval(ctx, approval);
  return ctx.done(summary, {
    state: "waiting",
    summary,
    evidence: boundedEvidence([
      resultRevisionPath,
      ...evidence.filter((item) => item !== resultPath),
    ]),
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
  input: Record<string, unknown>,
): Promise<GymExecutionResult> {
  const resultPath = join(candidateStateDir, "result.json");
  migrateLegacyRevision(candidateStateDir);
  let previous = existingResult(resultPath);
  let plan = initialPlan;
  let startIteration = 1;
  let resumedCandidatePath: string | null = null;
  let retryCloseActions: TaskAction[] = [];
  const recoveringRetry = candidateRetryCheckpoint(
    candidateStateDir,
    String(input.candidateFingerprint ?? "").replace(/^sha256:/, ""),
  );
  if (!previous && recoveringRetry) {
    startIteration = recoveringRetry.iteration;
    retryCloseActions = adjudicationChildCloseActions(ctx, taskId);
  }
  if (previous && !previous.approval) {
    const stored = record(JSON.parse(readFileSync(resultPath, "utf8")));
    const recovery =
      preservedEvaluationAdjustment(candidateStateDir, triggerDetails(ctx)) ??
      recoverableStoredEvaluationAdjustment(
        candidateStateDir,
        stored,
        taskId,
        generation,
      );
    if (recovery) {
      return runEvaluationOnlyAdjustment(
        ctx,
        loop,
        plan,
        recovery.adjustment,
        recovery.request,
        stored,
        candidateStateDir,
        taskId,
        generation,
        recovery.decisionPath,
      );
    }
  }
  if (previous?.state === "needs-agent" || previous?.state === "converged") {
    const stored = record(JSON.parse(readFileSync(resultPath, "utf8")));
    const retryableRuntimeReview =
      previous.state === "needs-agent" ||
      String(stored.recommendation ?? "") === "review-runtime";
    if (retryableRuntimeReview && requestedCandidateRetry(input, stored)) {
      const iteration = Number(stored.iteration);
      const candidatePath = String(stored.candidate_path ?? "");
      const candidateFingerprint = String(stored.candidate_fingerprint ?? "");
      if (
        !Number.isInteger(iteration) ||
        iteration < 1 ||
        !candidatePath ||
        !existsSync(candidatePath) ||
        fingerprintTree(candidatePath) !== candidateFingerprint
      ) {
        return saveAttentionResult(
          ctx,
          resultPath,
          "Exact candidate retry evidence is incomplete",
          [candidatePath].filter(Boolean),
          { task_id: taskId, generation },
        );
      }
      const iterationDir = join(
        candidateStateDir,
        "iterations",
        String(iteration),
      );
      writeJson(join(iterationDir, "verification-retry.json"), {
        schema_version: 1,
        candidate_fingerprint: candidateFingerprint,
        previous_verification_run_dir: String(
          stored.verification_run_dir ?? "",
        ),
        reason: String(input.reason),
        fresh_baseline_required:
          String(stored.recommendation ?? "") === "review-runtime",
        requested_at: new Date().toISOString(),
      });
      for (const file of [
        "development-baseline-retry.json",
        "development-baseline-invalid-retry.json",
        "development-verification.json",
        "release-baseline.json",
        "release-verification.json",
        "release-verification-invalid-retry.json",
        "failed-review.json",
      ]) {
        rmSync(join(iterationDir, file), { force: true });
      }
      rmSync(resultPath, { force: true });
      previous = null;
      startIteration = iteration;
      retryCloseActions = adjudicationChildCloseActions(ctx, taskId);
    }
  }
  if (previous) {
    if (previous.state !== "waiting" || !previous.approval) {
      return ctx.done(previous.summary, {
        state: previous.state,
        summary: previous.summary,
        evidence: previous.evidence,
      });
    }
    const response = approvalDecision(
      ctx,
      previous.approval,
      candidateStateDir,
    );
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
    const preserved = preserveApprovalDecision(
      candidateStateDir,
      stored,
      previous.approval,
      response,
    );
    const { decisionPath } = preserved;
    const evaluationAdjustment =
      previous.approval.kind === "benchmark-fix"
        ? evaluationOnlyAdjustmentFromResponse(response)
        : null;
    if (evaluationAdjustment) {
      return runEvaluationOnlyAdjustment(
        ctx,
        loop,
        plan,
        evaluationAdjustment,
        previous.approval,
        stored,
        candidateStateDir,
        taskId,
        generation,
        decisionPath,
      );
    }
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
              dirname(gymProjectsRoot(ctx)),
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
        return saveAttentionResult(ctx, resultPath, summary, [artifactPath], {
          task_id: taskId,
          generation,
        });
      }
      recordOperatingMetrics(ctx, {
        id: `approval:${previous.approval.approvalId}`,
        stage: "approval",
        proposalAccepted: true,
        evidence: [resultPath, decisionPath, artifactPath],
      });
      await emitGymEvent(
        ctx,
        previous.approval.kind === "agent-improvement"
          ? gymEvent("agent.revision.changed", {
              agent: plan.agent,
              revision: previous.approval.artifactFingerprint,
              scenarios: [...plan.focus.scenarios],
              trials: 3,
              taskId,
              taskGeneration: generation,
              approvalId: previous.approval.approvalId,
            })
          : buildBenchmarkFixRetryEvent({
              agent: plan.agent,
              ...benchmarkFixConfirmationTarget(stored, plan),
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
      writeJson(resultPath, {
        ...stored,
        next: "done",
        summary,
        evidence: boundedEvidence([
          ...(Array.isArray(stored.evidence)
            ? stored.evidence.map(String)
            : []),
          decisionPath,
          artifactPath,
        ]),
        conditions: [],
        approval: null,
        completion_kind: "artifact-applied" satisfies CompletionKind,
        track_state: "complete" satisfies TrackState,
        applied_at: new Date().toISOString(),
      });
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: boundedEvidence([...previous.evidence, decisionPath]),
        actions: [],
      });
    }
    if (previous.approval.kind !== "agent-improvement") {
      const priorReview = record(stored.review);
      const disposition =
        priorReview.disposition === "review-benchmark" ||
        priorReview.disposition === "review-scorer"
          ? priorReview.disposition
          : plan.focus.classification === "scorer"
            ? "review-scorer"
            : "review-benchmark";
      return prepareBenchmarkFixProposal(
        ctx,
        plan,
        {
          disposition,
          summary: `Hao ${response.decision === "decline" ? "rejected" : "adjusted"} the previous benchmark/scorer proposal: ${response.message}`,
          proposedChange: response.message,
          evidence: boundedEvidence([
            decisionPath,
            preserved.proposalPath,
            ...(preserved.artifactPath ? [preserved.artifactPath] : []),
          ]),
        },
        candidateStateDir,
        taskId,
        generation,
        previous.evidence,
      );
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
    gymProjectsRoot(ctx),
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
      if (revision.kind !== "revise") {
        return appendTaskActions(
          outcome as GymExecutionResult,
          retryCloseActions,
        );
      }
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
  return saveAttentionResult(ctx, resultPath, summary, accumulatedEvidence, {
    task_id: taskId,
    generation,
    stop_reason: "candidate-safety-limit",
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
): Promise<GymExecutionResult> {
  const plan: CandidatePlan = {
    agent: assessment.agent,
    benchmark: assessment.benchmark,
    releaseBenchmark: assessment.release_benchmark ?? assessment.benchmark,
    releaseScenarios: assessment.release_scenarios,
    baselineRunId: assessment.screening_run_id,
    baselineDir: assessment.screening_run_dir,
    assessmentPath,
    learningUnits: resolveLearningContexts(
      join(gymProjectsRoot(ctx), "gym"),
      assessment.benchmark,
      finding.scenarios,
    ),
    focus: finding,
  };
  const resultPath = join(stateDir, "result.json");
  if (existingResult(resultPath)) {
    return runCandidate(
      ctx,
      loop,
      plan,
      taskId,
      generation,
      stateDir,
      workflowInput,
    );
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
  return prepareBenchmarkFixProposal(
    ctx,
    plan,
    review,
    stateDir,
    taskId,
    generation,
  );
}

function improvementStatePaths(
  ctx: WorkflowContext,
  taskId: string,
  generation: number,
  scope?: string,
): { stateDir: string; assessmentPath: string } {
  const taskKey = safeKey(taskId, "improve-may");
  const scopeKey = scope ? safeKey(scope, "curriculum-track") : null;
  return {
    stateDir: join(
      gymProjectsRoot(ctx),
      "gym.app",
      ".state",
      "candidates",
      taskKey,
      String(generation),
      ...(scopeKey ? ["tracks", scopeKey] : []),
    ),
    assessmentPath: scopeKey
      ? join(
          gymProjectsRoot(ctx),
          "gym.app",
          ".state",
          "assessments",
          taskKey,
          String(generation),
          `${scopeKey}.json`,
        )
      : join(
          gymProjectsRoot(ctx),
          "gym.app",
          ".state",
          "assessments",
          taskKey,
          `${generation}.json`,
        ),
  };
}

async function runImprovementOnce(
  ctx: WorkflowContext,
  loop: GymLoopApi,
  input: Record<string, unknown>,
  taskId: string,
  generation: number,
  scope?: string,
): Promise<GymExecutionResult> {
  const { stateDir, assessmentPath } = improvementStatePaths(
    ctx,
    taskId,
    generation,
    scope,
  );
  const resultPath = join(stateDir, "result.json");

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
        if (prepared.problem.kind === "missing-manifest") {
          return saveAttentionResult(
            ctx,
            resultPath,
            prepared.problem.summary,
            [assessmentPath, assessment.screening_run_dir],
            { task_id: taskId, generation },
          );
        }
        const trackState: TrackState =
          prepared.problem.kind === "not-reproduced" ? "complete" : "issue";
        const evidence = saveCompletedResult(resultPath, {
          taskId,
          generation,
          summary: prepared.problem.summary,
          evidence: [assessmentPath, assessment.screening_run_dir],
          completionKind:
            trackState === "complete"
              ? "no-actionable-failure"
              : "non-may-disposition",
          trackState,
          details: { assessment_path: assessmentPath },
        });
        return ctx.done(prepared.problem.summary, {
          state: "converged",
          summary: prepared.problem.summary,
          evidence,
          actions: [],
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
        const trackState: TrackState = actionable.length ? "issue" : "complete";
        const evidence = saveCompletedResult(resultPath, {
          taskId,
          generation,
          summary,
          evidence: [assessmentPath, assessment.screening_run_dir],
          completionKind: actionable.length
            ? "non-may-disposition"
            : "no-actionable-failure",
          trackState,
          details: { assessment_path: assessmentPath },
        });
        return ctx.done(summary, {
          state: "converged",
          summary,
          evidence,
          actions: [],
        });
      }
      if (!assessment.baseline_run_id || !assessment.baseline_run_dir) {
        return saveAttentionResult(
          ctx,
          resultPath,
          "Assessment has no reproducible development baseline",
          [assessmentPath],
          { task_id: taskId, generation },
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
          join(gymProjectsRoot(ctx), "gym"),
          assessment.benchmark,
          assessment.focus.scenarios,
        ),
      };
    } catch (error) {
      const summary = error instanceof Error ? error.message : String(error);
      return saveAttentionResult(ctx, resultPath, summary, [assessmentPath], {
        task_id: taskId,
        generation,
      });
    }
  }
  return runCandidate(ctx, loop, plan, taskId, generation, stateDir, input);
}

function workflowOutcome(result: GymExecutionResult): {
  state: string;
  summary: string;
  evidence: string[];
} {
  const value = record(result);
  const output = record(value.output);
  const evidence = Array.isArray(output.evidence)
    ? output.evidence.map(String)
    : Array.isArray(value.evidence)
      ? value.evidence.map(String)
      : [];
  return {
    state: String(output.state ?? value.state ?? value.type ?? ""),
    summary: String(output.summary ?? value.summary ?? ""),
    evidence,
  };
}

function curriculumInput(
  agent: string,
  target: CurriculumTarget,
): Record<string, unknown> {
  return {
    agent,
    benchmark: target.benchmark,
    scenarios: target.scenarios,
    trials: target.trials,
    reason: `curriculum-drain:${target.id}`,
  };
}

function curriculumCampaignId(
  curriculumFingerprint: string,
  agentFingerprint: string,
): string {
  return `sha256:${createHash("sha256")
    .update(curriculumFingerprint)
    .update("\0")
    .update(agentFingerprint)
    .digest("hex")}`;
}

function curriculumScope(campaignId: string, targetId: string): string {
  return `${targetId}-${campaignId.slice("sha256:".length, "sha256:".length + 16)}`;
}

async function prepareCurriculumExperiment(
  ctx: WorkflowContext,
  loop: GymLoopApi,
  target: CurriculumTarget,
  agent: string,
  campaignId: string,
  taskId: string,
  generation: number,
): Promise<CurriculumExperiment> {
  const input = curriculumInput(agent, target);
  const scope = curriculumScope(campaignId, target.id);
  const { assessmentPath } = improvementStatePaths(
    ctx,
    taskId,
    generation,
    scope,
  );
  const assessmentWasFresh = !existsSync(assessmentPath);
  const prepared = await prepareAssessment(ctx, input, assessmentPath, loop);
  return {
    target,
    input,
    scope,
    assessmentPath,
    assessmentWasFresh,
    assessment: prepared.assessment,
    ...(prepared.problem ? { problem: prepared.problem } : {}),
  };
}

export function experimentNeedsIntegration(
  experiment: CurriculumExperiment,
): boolean {
  if (experiment.problem) return false;
  return Boolean(
    experiment.assessment.focus ||
    experiment.assessment.findings.some(
      ({ classification }) =>
        classification === "benchmark" || classification === "scorer",
    ),
  );
}

function checkpointTrack(
  checkpoint: TrainingDrainCheckpoint,
  track: TrainingDrainCheckpoint["tracks"][number],
): void {
  checkpoint.tracks = [
    ...checkpoint.tracks.filter(({ id }) => id !== track.id),
    track,
  ];
  checkpoint.updated_at = new Date().toISOString();
  checkpoint.evidence = boundedEvidence([
    ...checkpoint.evidence,
    ...track.evidence,
  ]);
}

function experimentPassiveResult(experiment: CurriculumExperiment): {
  state: "complete" | "issue";
  summary: string;
  evidence: string[];
} | null {
  const evidence = boundedEvidence([
    experiment.assessmentPath,
    experiment.assessment.screening_run_dir,
    ...(experiment.assessment.retry_run_dir
      ? [experiment.assessment.retry_run_dir]
      : []),
  ]);
  if (experiment.problem) {
    return {
      state:
        experiment.problem.kind === "not-reproduced" ? "complete" : "issue",
      summary: experiment.problem.summary,
      evidence,
    };
  }
  if (experimentNeedsIntegration(experiment)) return null;
  const actionable = experiment.assessment.findings.filter(
    ({ classification }) => classification !== "noise",
  );
  return actionable.length
    ? {
        state: "issue",
        summary:
          "Gym found an evaluator or runtime issue; it cannot establish a May behavior change from this track.",
        evidence,
      }
    : {
        state: "complete",
        summary:
          "May has no actionable failures in the current approved evaluation.",
        evidence,
      };
}

function shouldRetryIssues(input: Record<string, unknown>): boolean {
  return String(input.reason ?? "") !== "curriculum-continue";
}

function emitCurriculumContinuation(
  ctx: WorkflowContext,
  campaignId: string,
): void {
  void emitGymEvent(
    ctx,
    gymEvent("gym.improvement.requested", {
      agent: "may",
      curriculumDrain: true,
      reason: "curriculum-continue",
      campaignId,
    }),
  );
}

export function improvementInput(
  packet: Record<string, unknown> | null,
  trigger: Record<string, unknown> | null,
): Record<string, unknown> {
  const desired = record(packet?.input);
  if (!trigger?.type) return desired;
  const merged = { ...desired, ...trigger };
  if (
    trigger.type === "gym.improvement.requested" &&
    trigger.curriculumDrain !== true
  ) {
    delete merged.curriculumDrain;
  }
  return merged;
}

export function benchmarkFixConfirmationScope(
  input: Record<string, unknown>,
  taskId: string,
  generation: number,
): { scope: string } | { error: string } | null {
  if (String(input.reason ?? "") !== "approved-benchmark-fix-applied") {
    return null;
  }
  const fingerprint = String(input.artifactFingerprint ?? "").trim();
  if (!/^sha256:[a-f0-9]{64}$/.test(fingerprint)) {
    return {
      error:
        "Benchmark-fix confirmation requires the approved artifact fingerprint",
    };
  }
  if (String(input.approvalId ?? "").trim() === "") {
    return {
      error: "Benchmark-fix confirmation requires the exact approval id",
    };
  }
  if (String(input.taskId ?? "") !== taskId) {
    return {
      error:
        "Benchmark-fix confirmation task does not match the active campaign",
    };
  }
  if (Number(input.taskGeneration) !== generation) {
    return {
      error:
        "Benchmark-fix confirmation generation does not match the active campaign",
    };
  }
  if (!safeName(input.benchmark, "")) {
    return { error: "Benchmark-fix confirmation requires a valid benchmark" };
  }
  try {
    if (!requestedScenarios(input).length) {
      return {
        error: "Benchmark-fix confirmation requires its approved scenarios",
      };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  return {
    scope: `benchmark-fix-confirmation-${fingerprint.slice("sha256:".length)}`,
  };
}

export async function runImprovement(
  ctx: WorkflowContext,
  loop: GymLoopApi = defaultLoopApi,
): Promise<GymExecutionResult> {
  const gymRoot = join(gymProjectsRoot(ctx), "gym");
  configureGymRoot(gymRoot);
  const packet = reconciliationPacket(ctx);
  const trigger = triggerDetails(ctx);
  const input = improvementInput(packet, trigger);
  const taskId = String(packet?.taskId ?? "improve/may");
  const generation = Number(packet?.generation ?? 1);
  if (!Number.isInteger(generation) || generation < 1) {
    return ctx.blocked("Improvement task has no valid generation");
  }
  const campaignResultPath = join(
    improvementStatePaths(ctx, taskId, generation).stateDir,
    "result.json",
  );
  const approvalPacket = locateApprovalPacket(
    gymProjectsRoot(ctx),
    taskId,
    generation,
    trigger,
  );
  if (approvalPacket && "error" in approvalPacket) {
    return saveAttentionResult(
      ctx,
      campaignResultPath,
      approvalPacket.error,
      approvalPacket.evidence,
      { task_id: taskId, generation },
    );
  }
  if (approvalPacket && "resultPath" in approvalPacket) {
    try {
      const plan = planFromApprovalPacket(ctx, approvalPacket.resultPath);
      if (!plan) {
        const summary =
          "Exact approval packet cannot reconstruct its evaluation plan";
        return saveAttentionResult(
          ctx,
          approvalPacket.resultPath,
          summary,
          [approvalPacket.resultPath],
          { task_id: taskId, generation },
        );
      }
      return await runCandidate(
        ctx,
        loop,
        plan,
        taskId,
        generation,
        approvalPacket.stateDir,
        input,
      );
    } catch (error) {
      const summary = error instanceof Error ? error.message : String(error);
      return saveAttentionResult(
        ctx,
        approvalPacket.resultPath,
        summary,
        [approvalPacket.resultPath],
        { task_id: taskId, generation },
      );
    }
  }
  const storedAdjustment = locateStoredEvaluationAdjustment(
    gymProjectsRoot(ctx),
    taskId,
    generation,
    input,
  );
  if (storedAdjustment && "error" in storedAdjustment) {
    return saveAttentionResult(
      ctx,
      campaignResultPath,
      storedAdjustment.error,
      storedAdjustment.evidence,
      { task_id: taskId, generation },
    );
  }
  if (storedAdjustment && "resultPath" in storedAdjustment) {
    try {
      const plan = planFromApprovalPacket(ctx, storedAdjustment.resultPath);
      if (!plan) {
        return saveAttentionResult(
          ctx,
          storedAdjustment.resultPath,
          "Preserved adjustment cannot reconstruct its evaluation plan",
          storedAdjustment.evidence,
          { task_id: taskId, generation },
        );
      }
      return await runCandidate(
        ctx,
        loop,
        plan,
        taskId,
        generation,
        storedAdjustment.stateDir,
        input,
      );
    } catch (error) {
      const summary = error instanceof Error ? error.message : String(error);
      return saveAttentionResult(
        ctx,
        storedAdjustment.resultPath,
        summary,
        storedAdjustment.evidence,
        { task_id: taskId, generation },
      );
    }
  }
  if (input.curriculumDrain !== true) {
    try {
      const confirmation = benchmarkFixConfirmationScope(
        input,
        taskId,
        generation,
      );
      if (confirmation && "error" in confirmation) {
        return saveAttentionResult(
          ctx,
          campaignResultPath,
          confirmation.error,
          [],
          { task_id: taskId, generation },
        );
      }
      const retry = locateCandidateRetry(
        gymProjectsRoot(ctx),
        taskId,
        generation,
        input,
      );
      if (retry?.error) {
        return saveAttentionResult(
          ctx,
          campaignResultPath,
          retry.error,
          retry.evidence,
          { task_id: taskId, generation },
        );
      }
      return await runImprovementOnce(
        ctx,
        loop,
        input,
        taskId,
        generation,
        confirmation && "scope" in confirmation
          ? confirmation.scope
          : retry?.scope,
      );
    } catch (error) {
      const summary = error instanceof Error ? error.message : String(error);
      return saveAttentionResult(ctx, campaignResultPath, summary, [], {
        task_id: taskId,
        generation,
      });
    }
  }

  try {
    const { targets, fingerprint } = loadCurriculumTargets(gymRoot);
    const agent = safeName(input.agent, "may");
    if (!agent) throw new Error("Invalid curriculum agent");
    const agentPath = join(dirname(gymProjectsRoot(ctx)), "agents", agent);
    const agentFingerprint = `sha256:${fingerprintAgentLearningSurface(agentPath)}`;
    const campaignId = curriculumCampaignId(fingerprint, agentFingerprint);
    const checkpointPath = join(
      gymProjectsRoot(ctx),
      "gym.app",
      ".state",
      "learning",
      "training-drain.json",
    );
    const stored = readJson<TrainingDrainCheckpoint>(checkpointPath);
    const checkpoint: TrainingDrainCheckpoint =
      stored?.schema_version === 2 && stored.campaign_id === campaignId
        ? stored
        : {
            schema_version: 2,
            agent,
            campaign_id: campaignId,
            curriculum_fingerprint: fingerprint,
            agent_fingerprint: agentFingerprint,
            updated_at: new Date().toISOString(),
            exhausted_at: null,
            tracks: [],
            evidence: [],
          };
    if (checkpoint.exhausted_at) {
      const summary = "May already passes every approved learning track.";
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: boundedEvidence([checkpointPath, ...checkpoint.evidence]),
        actions: [],
      });
    }

    if (shouldRetryIssues(input)) {
      checkpoint.tracks = checkpoint.tracks.filter(
        ({ state }) => state !== "issue",
      );
    }
    const reviewedIds = new Set(checkpoint.tracks.map(({ id }) => id));
    const remaining = targets.filter(({ id }) => !reviewedIds.has(id));
    if (!remaining.length) {
      const issues = checkpoint.tracks.filter(({ state }) => state === "issue");
      if (issues.length) {
        writeJson(checkpointPath, checkpoint);
        const summary = `Gym reviewed every approved learning track; ${issues.length} evaluator or runtime issue${issues.length === 1 ? " remains" : "s remain"} for the next external wake.`;
        return ctx.done(summary, {
          state: "converged",
          summary,
          evidence: boundedEvidence([checkpointPath, ...checkpoint.evidence]),
          actions: [],
        });
      }
      checkpoint.exhausted_at = new Date().toISOString();
      checkpoint.updated_at = checkpoint.exhausted_at;
      writeJson(checkpointPath, checkpoint);
      const summary = `May passes all ${targets.length} approved learning tracks; training material is exhausted.`;
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: boundedEvidence([checkpointPath, ...checkpoint.evidence]),
        actions: [],
      });
    }

    // One wake advances one learning track. The continuation event moves the
    // next track forward without doubling peak load or leaving a sibling run
    // behind when an assessment fails.
    const selected = await prepareCurriculumExperiment(
      ctx,
      loop,
      remaining[0]!,
      agent,
      campaignId,
      taskId,
      generation,
    );
    const passive = experimentPassiveResult(selected);
    if (passive) {
      checkpointTrack(checkpoint, {
        id: selected.target.id,
        ...passive,
      });
    }

    const actionable = experimentNeedsIntegration(selected);
    if (actionable && selected.assessmentWasFresh) {
      writeJson(checkpointPath, checkpoint);
      emitCurriculumContinuation(ctx, campaignId);
      const summary =
        "Gym checkpointed one fresh assessment; integration will resume from that evidence on the next wake.";
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: boundedEvidence([checkpointPath, selected.assessmentPath]),
        actions: [],
      });
    }
    if (actionable) {
      const result = await runImprovementOnce(
        ctx,
        loop,
        selected.input,
        taskId,
        generation,
        selected.scope,
      );
      const outcome = workflowOutcome(result);
      if (outcome.state === "waiting" || outcome.state === "needs-agent") {
        writeJson(checkpointPath, checkpoint);
        return result;
      }
      const selectedResultPath = join(
        improvementStatePaths(ctx, taskId, generation, selected.scope).stateDir,
        "result.json",
      );
      const selectedCheckpoint =
        readJson<Record<string, unknown>>(selectedResultPath);
      const trackState = selectedCheckpoint?.track_state;
      if (trackState !== "complete" && trackState !== "issue") {
        writeJson(checkpointPath, checkpoint);
        return saveAttentionResult(
          ctx,
          selectedResultPath,
          "Gym completed a track without a structured track disposition.",
          [selected.assessmentPath, ...outcome.evidence],
          { task_id: taskId, generation },
        );
      }
      checkpointTrack(checkpoint, {
        id: selected.target.id,
        state: trackState,
        summary: outcome.summary,
        evidence: boundedEvidence([
          selected.assessmentPath,
          ...outcome.evidence,
        ]),
      });
    }

    writeJson(checkpointPath, checkpoint);
    const afterIds = new Set(checkpoint.tracks.map(({ id }) => id));
    const stillRemaining = targets.filter(({ id }) => !afterIds.has(id));
    if (stillRemaining.length) {
      emitCurriculumContinuation(ctx, campaignId);
      const summary = `Gym checkpointed this bounded training stage; ${stillRemaining.length} approved track${stillRemaining.length === 1 ? " remains" : "s remain"}.`;
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: boundedEvidence([checkpointPath, ...checkpoint.evidence]),
        actions: [],
      });
    }

    const issues = checkpoint.tracks.filter(({ state }) => state === "issue");
    if (issues.length) {
      const summary = `Gym reviewed every approved learning track; ${issues.length} evaluator, runtime, or no-progress issue${issues.length === 1 ? " remains" : "s remain"} for the next external wake.`;
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: boundedEvidence([checkpointPath, ...checkpoint.evidence]),
        actions: [],
      });
    }

    checkpoint.exhausted_at = new Date().toISOString();
    checkpoint.updated_at = checkpoint.exhausted_at;
    writeJson(checkpointPath, checkpoint);
    const summary = `May passes all ${targets.length} approved learning tracks; training material is exhausted.`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: boundedEvidence([checkpointPath, ...checkpoint.evidence]),
      actions: [],
    });
  } catch (error) {
    const summary = error instanceof Error ? error.message : String(error);
    return saveAttentionResult(ctx, campaignResultPath, summary, [], {
      task_id: taskId,
      generation,
    });
  }
}

export async function execute(
  ctx: WorkflowContext,
): Promise<GymExecutionResult> {
  return runImprovement(ctx);
}

export async function verify(
  context: unknown,
  result: unknown,
): Promise<{ accepted: boolean; summary: string; evidence: string[] }> {
  const verification = record(context);
  const output = record(result);
  if (output.state !== "converged") {
    return {
      accepted: true,
      summary: "Only converged Gym results require completion verification.",
      evidence: [],
    };
  }
  const taskId = String(verification.taskId ?? "");
  const generation = Number(verification.generation);
  const appDir = String(verification.appRoot ?? verification.appDir ?? "");
  if (taskId !== "improve/may" || !Number.isInteger(generation) || !appDir) {
    return {
      accepted: true,
      summary: "This result is outside the improve/may campaign.",
      evidence: [],
    };
  }
  const campaignDir = resolve(
    appDir,
    ".state",
    "candidates",
    safeKey(taskId, "improve-may"),
    String(generation),
  );
  const outputEvidence = Array.isArray(output.evidence)
    ? output.evidence.map(String)
    : [];
  const superseded = outputEvidence.some(
    (entry) => entry === `superseded:${taskId}@${generation}`,
  );
  if (superseded) {
    return {
      accepted: true,
      summary:
        "The superseded attempt cannot update the current task generation.",
      evidence: [`superseded:${taskId}@${generation}`],
    };
  }

  const trainingPath = resolve(
    appDir,
    ".state",
    "learning",
    "training-drain.json",
  );
  const citesTraining = outputEvidence.some(
    (entry) => entry === trainingPath || entry.startsWith(`${trainingPath}:`),
  );
  const training = citesTraining
    ? readJson<TrainingDrainCheckpoint>(trainingPath)
    : null;
  const campaignSuffix =
    training?.schema_version === 2 &&
    /^sha256:[a-f0-9]{64}$/.test(training.campaign_id)
      ? `-${training.campaign_id.slice("sha256:".length, "sha256:".length + 16)}`
      : null;
  const declaredPaths = outputEvidence
    .map(String)
    .flatMap((entry) => {
      const match = entry.match(/^([^:\n]*result\.json)(?::|$)/);
      return match?.[1] ? [resolve(match[1])] : [];
    })
    .filter((path) => {
      const relativePath = relative(campaignDir, path);
      return (
        relativePath !== ".." &&
        !relativePath.startsWith(`..${sep}`) &&
        existsSync(path)
      );
    });
  // A cited result is the exact checkpoint produced by this reconciliation.
  // Consult the generation-root result only for legacy outputs that did not
  // cite a checkpoint; otherwise stale pre-track state can veto newer proof.
  const campaignPaths =
    citesTraining || declaredPaths.length
      ? []
      : [join(campaignDir, "result.json")];
  const tracksDir = join(campaignDir, "tracks");
  if (campaignSuffix && existsSync(tracksDir)) {
    campaignPaths.push(
      ...readdirSync(tracksDir, { withFileTypes: true })
        .filter(
          (entry) => entry.isDirectory() && entry.name.endsWith(campaignSuffix),
        )
        .map((entry) => join(tracksDir, entry.name, "result.json")),
    );
  }
  const checkpointPaths = [
    ...new Set([...declaredPaths, ...campaignPaths.filter(existsSync)]),
  ];
  for (const path of checkpointPaths) {
    const checkpoint = readJson<Record<string, unknown>>(path);
    if (!checkpoint) continue;
    const next = String(checkpoint.next ?? "");
    const legacyState = String(checkpoint.workflow_state ?? "");
    if (
      next === "wait-for-approval" ||
      next === "ask-owner" ||
      legacyState === "waiting" ||
      legacyState === "needs-agent" ||
      checkpoint.approval != null
    ) {
      return {
        accepted: false,
        summary:
          "The campaign checkpoint still requires a decision or owner action, so improve/may is not converged.",
        evidence: [path],
      };
    }
    if (checkpoint.stop_reason === "candidate-safety-limit") {
      return {
        accepted: false,
        summary:
          "The campaign reached its candidate safety limit without a verified proposal.",
        evidence: [path],
      };
    }
    if (next === "done") {
      const completionKind = String(checkpoint.completion_kind ?? "");
      const trackState = String(checkpoint.track_state ?? "");
      if (
        ![
          "no-actionable-failure",
          "non-may-disposition",
          "artifact-applied",
        ].includes(completionKind) ||
        (trackState !== "complete" && trackState !== "issue")
      ) {
        return {
          accepted: false,
          summary:
            "The campaign checkpoint says done without a structured terminal disposition.",
          evidence: [path],
        };
      }
      continue;
    }
    if (legacyState === "converged") continue;
    return {
      accepted: false,
      summary:
        "The campaign checkpoint has no recognized completion or wait disposition.",
      evidence: [path],
    };
  }
  if (training?.schema_version === 2) {
    const projectDir = String(
      verification.projectRoot ?? verification.projectDir ?? "",
    );
    const targets = projectDir ? loadCurriculumTargets(projectDir).targets : [];
    const reviewed = new Set(training.tracks.map(({ id }) => id));
    const remaining = targets.filter(({ id }) => !reviewed.has(id));
    if (!remaining.length && targets.length > 0) {
      return {
        accepted: true,
        summary: "Every current curriculum track has a recorded disposition.",
        evidence: [trainingPath],
      };
    }
    if (record(verification.pendingTrigger).type) {
      return {
        accepted: true,
        summary:
          "The bounded curriculum stage is complete and a durable wake keeps improve/may pending.",
        evidence: [trainingPath],
      };
    }
    return {
      accepted: false,
      summary: `The curriculum still has ${remaining.length || "unknown"} unreviewed track(s) and no durable continuation wake.`,
      evidence: [trainingPath],
    };
  }
  if (checkpointPaths.length) {
    return {
      accepted: true,
      summary:
        "The campaign checkpoints contain positive terminal dispositions.",
      evidence: checkpointPaths,
    };
  }
  return {
    accepted: false,
    summary:
      "The workflow claimed convergence without a campaign or curriculum completion checkpoint.",
    evidence: [],
  };
}
