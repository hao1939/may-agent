// Preserve explicit retirement when the former Evaluation App is removed.
// Activation retains history and resolves stale alerts; it does not restart collection.
export const retiredEvaluationMetrics = [
  ["session.failed-triage-rate-3h", "Failed session triage rate (3h)", "ratio"],
  [
    "evaluator.project-feedback-pending-age-h",
    "Oldest pending evaluation finding delivery (hours)",
    "hours",
  ],
  [
    "evaluator.project-finding-delivery-rate-24h",
    "Evaluation findings handled by target owner workflows (24h)",
    "ratio",
  ],
  [
    "evaluator.false-good-rate-sample",
    "Reviewed good sessions overturned (24h)",
    "ratio",
  ],
  [
    "evaluator.triage-closure-rate-24h",
    "Evaluator triage closure rate (24h)",
    "ratio",
  ],
  [
    "evaluator.meaningful-review-rate-24h",
    "Evaluator meaningful review rate (24h)",
    "ratio",
  ],
  [
    "evaluator.substantive-low-quality-rate-24h",
    "Substantive evaluator quality failures (24h)",
    "ratio",
  ],
  [
    "evaluator.low-quality-rate-24h",
    "Broad needs-improvement/low-score evaluated sessions (24h, dashboard only)",
    "ratio",
  ],
  ["eval.llm-evals-24h", "LLM-evaluated sessions (24h)", "count"],
  [
    "eval.llm-coverage-lag-h",
    "LLM evaluation lag (hours since last non-heuristic eval)",
    "hours",
  ],
  [
    "evaluator.aftermath-coverage-rate-3h",
    "Evaluator aftermath liveness (3h)",
    "ratio",
  ],
].map(([id, name, unit]) => ({
  id,
  name,
  unit,
  owner: "evaluator",
  project: "alex",
  status: "retired" as const,
  description:
    "Retired session-era evaluation metric; current Task and metric reviews use App-owned evidence.",
}));
