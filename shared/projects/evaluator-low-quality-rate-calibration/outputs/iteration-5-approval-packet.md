# Iteration 5 — Approval packet: split “broad NI” from “substantive low quality” and pivot alerting

## One-paragraph ask (approval requested)

Please approve **pivoting alert interpretation/thresholding away from** `evaluator.low-quality-rate-24h` (broad: includes hygiene/process NI) **to** `evaluator.substantive-low-quality-rate-24h` (substantive: terminal failures + severe evaluator/process failures). The current alert is dominated by hygiene/pipeline triggers (uncommitted changes, transcript/schema errors, runner interruptions) that do not reliably represent “agent output quality.” The substantive metric is already implemented in-repo and better matches the intended meaning of “quality regression,” while we keep the broad metric for operational hygiene visibility.

## Table 1 — Rates (last-24h impact model)

Numbers from Iteration 3 recomputation (see linked artifact below for query details and caveats):

| Definition | Numerator | Denominator | Rate |
|---|---:|---:|---:|
| **Current / broad** (`evaluator.low-quality-rate-24h`) | 292 | 471 | **0.6200** |
| **Hygiene-excluded (lower bound)** (exclude only `schema/query error in transcript`) | 167 | 468 | **0.3568** |
| **Substantive-only** (`evaluator.substantive-low-quality-rate-24h`) | 39 | 469 | **0.0832** |

Interpretation:
- Broad NI-rate is far above 0.30 largely due to hygiene/pipeline issues.
- Substantive-only is ~0.08, consistent with “page-worthy quality regression” being much rarer than the current alert suggests.

## Table 2 — Proposed metrics + thresholds / alerting intent

| Metric id | Meaning (intent) | Proposed threshold/alert posture |
|---|---|---|
| `evaluator.low-quality-rate-24h` | **Broad**: any NI/low-score or low quality/efficiency (includes hygiene/process) | Keep recorded; **do not page** on this as a “quality regression” signal. If desired, track as ops hygiene with a higher threshold and/or lower priority.
| `evaluator.substantive-low-quality-rate-24h` | **Substantive**: terminal failures + severe evaluator issues (`tool hallucination`, `verification failure`, `blind overwrite`) | Make this the **primary paging/thresholded** “quality regression” metric. Suggested threshold: **0.30** initially (same as current), then ratchet down after a week of observation (e.g., 0.15 → 0.10).

## Exact code touch list (what would change)

This approval packet is specifically to unblock an alert/intent decision. If approved, the minimal code change set to align behavior is expected to be:

1) **If alerting is in-repo (likely):**
- `agents/may/handlers/metrics-snapshot.ts`
  - Update the *threshold/priority metadata* so paging/interpretation uses `evaluator.substantive-low-quality-rate-24h` as the primary breach signal.
  - Keep `evaluator.low-quality-rate-24h` recorded but reduce its paging priority or raise its threshold.

2) **If alerting is external (possible):**
- No code change required; update the external alert rule to page on `evaluator.substantive-low-quality-rate-24h` instead of the broad metric.

Notes:
- The substantive metric computation already exists in `agents/may/handlers/metrics-snapshot.ts` (Iteration 3 excerpt shows exact SQL).
- No evaluator heuristic changes are required for this pivot.

## Rollback plan

Rollback is straightforward and low-risk:
- Revert the alert rule (or the metric registry metadata) to page on `evaluator.low-quality-rate-24h`.
- No data migration needed; both metrics can continue to be computed.

## Linked evidence (prior iterations)

- Iteration 3 (impact model + metric mechanism):
  - `agents/shared/projects/evaluator-low-quality-rate-calibration/outputs/iteration-3-impact-model-and-recommendation.md`
- Iteration 4 (metric-split implementation plan / PR-ready SQL):
  - `agents/shared/projects/evaluator-low-quality-rate-calibration/outputs/iteration-4-metric-split-implementation-plan.md`
