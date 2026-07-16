export type MachineVerdict = "pass" | "fail" | "invalid";
export type HumanVerdict = "pass" | "fail" | "invalid";
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
}

export interface ScenarioRunResult {
  scenario: string;
  agent: string;
  adapter?: string;
  lab_fork?: string | null;
  passed: boolean;
  checks: ScenarioCheck[];
  summary?: string;
  agent_status?: string;
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
}

export interface LoopRunManifest {
  schema_version: 1;
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
  source: {
    suite_path: string;
    labels_path: string | null;
    suite_snapshot: string;
    labels_snapshot: string | null;
    evaluator_snapshot: string | null;
    scenarios_snapshot: string;
  };
  trials: StoredTrial[];
}

export interface HumanAdjudication {
  run_id: string;
  scenario: string;
  trial: number;
  verdict: HumanVerdict;
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
  no_invalid_runs: boolean;
  no_regressions: boolean;
  improved: boolean;
  gate: "pass" | "fail" | "needs-human-review";
  scenarios: ScenarioComparison[];
}
