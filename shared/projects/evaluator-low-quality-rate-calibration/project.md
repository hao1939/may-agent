---
id: evaluator-low-quality-rate-calibration
owner: evaluator
status: active
type: milestone
priority: P1
workflow: project
iteration: 6
---

# Evaluator low-quality-rate 24h calibration

## Goal
Reduce `evaluator.low-quality-rate-24h` to ≤0.10 *without gaming* by improving evaluation calibration and/or restoring LLM-based eval, so “needs_improvement” is a meaningful signal.

## Signals
- Metric alert: `evaluator.low-quality-rate-24h` repeatedly failing (10 consecutive checks).
- Current snapshot (this heartbeat): 0.4597.

## Current State
Iteration 2. Milestones: 0/0 done.
Reviewer: - **I believe**: Heuristic v2 is working as implemented, but it’s *miscalibrated for the metric*: `any issues => verdict=needs_improvement (quality=0.55)` makes `evaluator.low-quality-rate-24h` largel
## Plan
1. Identify the heuristic evaluation rubric/codepath producing `needs_improvement` at ~45–50% base rate.
2. Sample 20 recent `needs_improvement` + 20 recent `good` and categorize issue triggers; check for over-weighting of minor process misses (e.g., lack of structural verification, verbosity, extra tool calls).
3. Propose rubric changes (thresholds / mapping issues→verdict) or re-enable LLM eval.
4. Validate via 24h rolling metric drop and spot-check that “needs_improvement” still catches real failures.

## Validation
- Primary: `evaluator.low-quality-rate-24h` ≤ 0.10 for 3 consecutive checks.
- Secondary: manual audit of sampled evaluations shows “needs_improvement” corresponds to genuinely action-blocking or repeated failures, not minor style issues.

## Journal
- 2026-05-08: Reconfirmed persistent failure is not storm-only contamination: 459 evals in last 24h with 0.4597 low-rate; all heuristic-evaluated. Notified May with breakdown and suggestion to adjust heuristic or restore LLM eval.


## Artifacts
- outputs/iteration-1-diagnosis.md
- outputs/iteration-1-deliverable-heuristic-v2-calibration-plan.md
- outputs/iteration-3-impact-model-and-recommendation.md
- outputs/iteration-4-metric-split-implementation-plan.md
- outputs/iteration-2-mechanism-and-fix-options.md
- outputs/iteration-5-approval-packet.md

## Context
- Metric `evaluator.low-quality-rate-24h` current is 0.4632 (target 0.10); `metrics.source_query` is currently NULL in DB, so the computation source/config needs investigation before attempting to change the metric definition.
- Iteration-1 output proposes adding `overall.lowQualityCategory` (outcome/process/infra) to heuristic v2 results and redefining the metric to count only outcome-category NI, plus adding separate process/infra issue-rate metrics.
- Worker claims LLM lane absent (no non-heuristic evaluations); next iteration must verify with DB queries and quantify NI breakdown (process-only vs outcome/terminal) via backtest.
- Heuristic v2 mechanism is confirmed in `agents/evaluator/workflows/evaluator-aftermath.ts`: **any** issue forces `verdict=needs_improvement` with `quality=0.55`; interrupted/error forces `quality=0.2`.
- Top issue triggers are direct string/regex matches in `transcriptIssues()` (e.g., “finish() blocked [uncommitted changes]”, `/no such table|column/`) plus terminal status mapping.
- Manual audit indicates many `quality=0.55` NIs are **process-only** (hygiene/guard friction), suggesting `evaluator.low-quality-rate-24h` is currently overloaded vs “outcome quality” intent.
- Possible infra reliability gap: many rows reference an `overall.artifactPath` whose file is missing on disk, harming auditability; needs confirmation and fix path.
