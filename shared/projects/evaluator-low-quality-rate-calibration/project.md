---
id: evaluator-low-quality-rate-calibration
owner: evaluator
status: active
type: milestone
priority: P1
workflow: project
iteration: 1
---

# Evaluator Low-Quality Rate Calibration

**Status**: active
**Iteration**: 1
## Goal
Reduce `evaluator.low-quality-rate-24h` by separating (a) fixable agent behavior failures from (b) pipeline/guard false-penalties, and ensure evaluator scoring produces low false-good overturns.

## Signals
- Metric: `evaluator.low-quality-rate-24h` current 0.543 (threshold 0.3, target 0.1) repeating alert.
- Metric: `evaluator.false-good-rate-sample` current 0.5714 (threshold 0.2, target 0.05) but denominator only 7 reviewed sessions (sample instability).

## Current State
Evidence from DB (2026-05-08 ~19:50Z):
- `evaluator.low-quality-rate-24h` snapshots are stable and breaching (0.521 → 0.543 over the last hour).
- 24h NI rates by agent are high across the board (may/scout/arc/dev all >0.5), suggesting systemic factors rather than a single-agent regression.
- Top NI issue drivers (counts in last 24h):
  - `schema/query error in transcript` (56)
  - `finish blocked by uncommitted changes` (50)
  - `finish blocked... + broad may/shared commit during session` (40)
  - terminal interruptions/clean-start: `terminal status: interrupted` + `error: Clean start (fresh)` (13)
- Liveness: evaluations are being produced (MAX(evaluations.createdAt)=2026-05-08 19:46Z; n=453 in 24h). Legacy `.state/evaluations/task_tree_*.json` artifacts are stale (mtime Mar 2026) but DB is canonical.

## Plan
1. **Metric decomposition proposal**: draft a split of low-quality-rate into sub-metrics by issue class (schema errors, finish/uncommitted, terminal interruptions) to avoid conflating agent quality with infra/guard friction.
2. **Criteria calibration**: review evaluator criteria for (a) terminal interrupted sessions (Clean start) and (b) finish-blocked sessions; decide whether to classify as NI vs excluded/exception.
3. **False-good stabilization**: increase denominator requirement (already noted in metric blocker: require reviewed_good_count>=30) and/or change sampling method so the metric isn’t dominated by small-N variance.
4. **Notify owners**: send evidence to may (system owner) + tech-lead (guard/workflow owner) with actionable top drivers.

## Validation
- `evaluator.low-quality-rate-24h` < 0.3 for 3 consecutive snapshots, and trend toward target 0.1.
- `evaluator.false-good-rate-sample` < 0.2 once reviewed_good_count>=30 (or replacement metric adopted).
- A follow-up DB query shows reduced counts in the top issue buckets (schema/query errors; finish blocked).

## Journal
- 2026-05-08: Updated project with current breach evidence and top NI drivers; confirmed eval pipeline is live via DB even though `.state/evaluations/` artifacts are stale.


## Artifacts
- outputs/iteration-1-diagnosis.md
- outputs/iteration-1-2026-05-08-pipeline-vs-behavior-split.md
- outputs/iteration-1-deliverable-heuristic-v2-calibration-plan.md
- outputs/iteration-3-impact-model-and-recommendation.md
- outputs/iteration-4-metric-split-implementation-plan.md
- outputs/iteration-1-deliverable.md
- outputs/iteration-2-mechanism-and-fix-options.md
- outputs/iteration-1-2026-05-08-evidence-refresh.md
- outputs/iteration-5-approval-packet.md
- outputs/iteration1-attribution-summary.md
