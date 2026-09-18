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

export interface BenchmarkSuite {
  name: string;
  version: number;
  scenarios: string[];
  artifact?: string;
  labels_file?: string;
  evaluator?: string;
}

export interface GroundTruthLabel {
  status: LabelStatus;
  source: "synthetic" | "real-replay" | "adversarial";
  rationale: string;
  approved_by: string | null;
  approved_at: string | null;
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
  duration_ms: number | null;
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
  candidate: string;
  agent: string;
  trials_per_scenario: number;
  scenarios: string[];
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

export interface ScenarioComparison {
  scenario: string;
  baseline: { pass: number; fail: number; invalid: number };
  candidate: { pass: number; fail: number; invalid: number };
  delta_passes: number;
  regression: boolean;
}

export interface RunComparison {
  baseline_run_id: string;
  candidate_run_id: string;
  labels_approved: boolean;
  same_framework_revision: boolean;
  no_invalid_runs: boolean;
  no_regressions: boolean;
  improved: boolean;
  gate: "pass" | "fail" | "needs-human-review";
  scenarios: ScenarioComparison[];
}
