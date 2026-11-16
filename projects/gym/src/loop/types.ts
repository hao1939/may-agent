import type { ComparisonObjective } from "./objective";

export type MachineVerdict = "pass" | "fail" | "invalid";
export type HumanVerdict = "pass" | "fail";
export type ReviewClassification =
  "may_behavior" | "ground_truth" | "scorer" | "harness" | "unclear";
export type ReviewReasonCode =
  | "intent_misread"
  | "preference_missed"
  | "local_guidance_violated"
  | "unsafe_action"
  | "wrong_owner"
  | "unnecessary_work"
  | "missing_evidence"
  | "missing_verification"
  | "over_clarification"
  | "under_clarification"
  | "too_verbose"
  | "acceptable_alternative"
  | "ground_truth_wrong"
  | "scorer_false_positive"
  | "scorer_false_negative"
  | "fixture_problem"
  | "harness_problem";
export type LabelStatus = "draft" | "approved";
/** What this test can establish; never infer behavior from a decision artifact. */
export type EvaluationKind = "judgment" | "behavior";

export interface InlineBenchmarkCase {
  id: string;
  description?: string;
  evaluation_kind?: EvaluationKind;
  task: string;
  state?: string;
  files?: Record<string, string>;
  expected?: Record<string, unknown>;
  semantic_criteria?: string;
  semantic_controls?: Record<string, unknown>;
  agent_type?: string;
  tier?: string;
  timeout?: number;
  categories?: string[];
  tags?: string[];
  output_contract?: "task-agent-result";
  workflow_entry?: {
    agent: string;
    workflow: string;
    input?: unknown;
  };
  label?: Partial<GroundTruthLabel> & { status?: LabelStatus };
}

export interface BenchmarkSuite {
  /** Default for cases; individual cases may override it. Missing means unclassified. */
  evaluation_kind?: EvaluationKind;
  name: string;
  version: number;
  scenarios: string[];
  /** Reviewable core selection; other cases remain extended regression material. */
  core_scenarios?: string[];
  artifact?: string;
  labels_file?: string;
  evaluator?: string;
  defaults?: {
    agent_type?: string;
    tier?: string;
    timeout?: number;
    categories?: string[];
    tags?: string[];
    task_suffix?: string;
    output_contract?: "task-agent-result";
  };
  cases?: InlineBenchmarkCase[];
}

export interface GroundTruthLabel {
  status: LabelStatus;
  source: "synthetic" | "real-replay" | "adversarial";
  rationale: string;
  approved_by: string | null;
  approved_at: string | null;
  review_status?: "ready" | "withheld";
}

export interface GroundTruthCatalog {
  version: number;
  benchmark: string;
  labels: Record<string, GroundTruthLabel>;
}

export interface ScenarioCheck {
  name: string;
  passed: boolean;
  detail?: string;
  category?: string;
  code?: string;
  gate?: boolean;
}

export interface TrialUsageTelemetry {
  tokens_measured?: boolean;
  ops_measured?: boolean;
  turns: number;
  ops: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface ScenarioRunResult {
  scenario: string;
  agent: string;
  adapter?: string;
  lab_fork?: string | null;
  passed: boolean;
  checks: ScenarioCheck[];
  semantic_evaluation?: unknown;
  summary?: string;
  agent_status?: string;
  /** Exact subject execution error, distinct from scorer summary. */
  execution_error?: string;
  duration_ms?: number;
  usage?: TrialUsageTelemetry | null;
  session_id?: string;
  session_path?: string;
  work_dir?: string;
  gym_root?: string;
  prompt_hash?: string | null;
  prompt_text?: string | null;
  framework_sha?: string | null;
  model?: string | null;
}

export interface StoredTrial {
  scenario: string;
  trial: number;
  machine_verdict: MachineVerdict;
  invalid_reason: string | null;
  label_status: LabelStatus | "missing";
  result_path: string;
  artifact_path: string | null;
  transcript_path: string | null;
  /** Retained final workspace, separate from the original environment. */
  workspace_path?: string | null;
  duration_ms: number | null;
  usage?: TrialUsageTelemetry | null;
  provenance: {
    prompt_fingerprint: string | null;
    framework_revision: string | null;
    model: string | null;
  };
}

export interface LoopRunManifest {
  schema_version: 2;
  run_id: string;
  phase: "test" | "verify";
  benchmark: string;
  benchmark_version: number;
  baseline_run_id: string | null;
  /** Absent historical values mean quality. Frozen under inputs/ for new runs. */
  comparison_objective?: ComparisonObjective;
  candidate: string;
  agent: string;
  trials_per_scenario: number;
  scenarios: string[];
  /** Frozen case-level scope. Historical runs remain unclassified. */
  evaluation_kinds?: Record<string, EvaluationKind | null>;
  started_at: string;
  completed_at: string | null;
  proof: {
    input_fingerprint: string;
    label_set_fingerprint: string | null;
    /** Canonical content identity used to bind the supplied truth catalog. */
    label_catalog_fingerprint?: string | null;
    candidate_fingerprint: string | null;
    /** Absent on historical manifests, which remain readable but are not comparable. */
    semantic_judging?: boolean;
    semantic_judge_fingerprint?: string | null;
    /** Gym-owned runner/scoring implementation; absent on historical manifests. */
    harness_fingerprint?: string;
    agent_prompt_fingerprints: string[];
    framework_revisions: string[];
    models: string[];
  };
  source: {
    suite_path: string;
    labels_path: string | null;
    suite_snapshot: string;
    labels_snapshot: string | null;
    evaluator_snapshot: string | null;
    /** Frozen semantic judge agent definitions; absent on historical manifests. */
    semantic_judges_snapshot?: string | null;
    /** Frozen Gym runner/scoring sources; absent on historical manifests. */
    harness_snapshot?: string;
    scenarios_snapshot: string;
    candidate_snapshot: string | null;
  };
  trials: StoredTrial[];
}

export interface HumanAdjudication {
  schema_version?: 1;
  run_id: string;
  scenario: string;
  trial: number;
  verdict: HumanVerdict;
  classification?: ReviewClassification;
  reason_codes?: ReviewReasonCode[];
  reviewer: string;
  reason: string;
  created_at: string;
}

export interface DurationComparison {
  baseline: { measured_trials: number; total_trials: number; total_ms: number | null };
  candidate: { measured_trials: number; total_trials: number; total_ms: number | null };
  /** Null when coverage is incomplete or baseline duration is zero. */
  reduction_percent: number | null;
}

export interface UsageAggregate {
  measured_trials: number;
  total_trials: number;
  turns: number | null;
  ops: number | null;
  total_tokens: number | null;
}

export interface UsageComparison {
  baseline: UsageAggregate;
  candidate: UsageAggregate;
  token_reduction_percent: number | null;
  ops_reduction_percent: number | null;
  turns_reduction_percent: number | null;
}

export interface ScenarioComparison {
  scenario: string;
  baseline: { pass: number; fail: number; invalid: number };
  candidate: { pass: number; fail: number; invalid: number };
  delta_passes: number;
  regression: boolean;
  duration: DurationComparison;
  usage?: UsageComparison;
}

export interface RunComparison {
  baseline_run_id: string;
  candidate_run_id: string;
  labels_approved: boolean;
  same_framework_revision: boolean;
  no_invalid_runs: boolean;
  no_regressions: boolean;
  /** Quality improvement only; retained for existing readers. */
  improved: boolean;
  objective: ComparisonObjective;
  objective_met: boolean | null;
  duration: DurationComparison;
  usage?: UsageComparison;
  gate: "pass" | "fail" | "needs-human-review";
  scenarios: ScenarioComparison[];
}
