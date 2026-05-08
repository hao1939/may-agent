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

**Status**: active
## Goal
Reduce `evaluator.low-quality-rate-24h` to ≤0.10 *without gaming* by improving evaluation calibration and/or restoring LLM-based eval, so “needs_improvement” is a meaningful signal.

## Signals
- Metric alert: `evaluator.low-quality-rate-24h` repeatedly failing (10 consecutive checks).
- Current snapshot (this heartbeat): 0.4597.

## Current State
- Evidence (DB): last 24h `evaluations` = 459; `needs_improvement` = 211 → **0.4597**.
- Only verdicts present: `good` (248) and `needs_improvement` (211); no `unacceptable`/`failure` in window.
- All last-24h evals are **heuristic** (`evaluatedByHeuristic=1` for all 459); LLM eval appears effectively off.
- By-agent low rates in last 24h: dev 0.5517 (32/58), arc 0.5128 (20/39), scout 0.4615 (42/91), may 0.4296 (116/270). This looks systemic, not isolated to one agent.
- Legacy `.state/evaluations/task_tree_*.json` artifacts are stale (latest mtime 2026-03-24), while DB `evaluations.createdAt` is fresh (newest 2026-05-08 16:58:39). Treat as output-path drift, not pipeline staleness.

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
