# Iteration 5 — Approval packet: pivot paging from broad NI-rate to substantive-quality rate

## One-paragraph ask (approval needed)
Please approve an **alerting / ownership decision** for evaluator quality monitoring: keep collecting `evaluator.low-quality-rate-24h` as the broad friction signal, but **treat `evaluator.substantive-low-quality-rate-24h` as the primary thresholded / paging quality metric** so alerts represent substantive output-quality failures rather than mixed hygiene/process penalties. Iteration 3’s DB-backed impact model showed the broad rate at **0.6807** (356/523), versus **0.0975** when hygiene-only cases are excluded and **0.0765** for substantive-only failures. In current runtime metrics, the broad metric remains high at **0.6809** while the substantive metric is much lower at **0.1586**. The substantive metric is already registered and measured in `agents/may/handlers/metrics-snapshot.ts`; approval is needed mainly to confirm policy intent and repoint any alerting/attention from the broad metric to the substantive one.

## Table 1 — Observed rates and counterfactuals

| Definition | Source | Numerator / Denominator | Rate |
|---|---|---:|---:|
| Current broad low-quality rate | Iteration 3 recomputation of `evaluator.low-quality-rate-24h` | 356 / 523 | **0.6807** |
| Hygiene-excluded counterfactual | Iteration 3 recomputation excluding `finish() blocked`, `uncommitted changes`, `schema/query error in transcript` | 51 / 523 | **0.0975** |
| Substantive-only counterfactual | Iteration 3 recomputation using `sessions.status IN ('error','interrupted')` or issues containing `tool hallucination`, `verification failure`, `blind overwrite` | 40 / 523 | **0.0765** |
| Current runtime broad metric | `metrics` table snapshot | n/a | **0.6809** |
| Current runtime substantive metric | `metrics` table snapshot | n/a | **0.1586** |

Notes:
- The runtime numbers drift slightly from Iteration 3 because the 24h window moved, but the separation remains large.
- The broad metric is still dominated by non-substantive friction; the substantive metric is materially lower and better aligned with “actual quality failure” intent.

## Table 2 — Proposed metrics and thresholds

| Metric id | Purpose | Target | Threshold | Recommended use |
|---|---|---:|---:|---|
| `evaluator.low-quality-rate-24h` | Broad friction rate: hygiene/process + substantive NI/low-score outcomes | 0.10 | 0.80 | Dashboard / secondary signal only |
| `evaluator.substantive-low-quality-rate-24h` | Substantive evaluator quality failures only | 0.10 | 0.30 | **Primary thresholded / paging quality metric** |
| Follow-up hygiene metrics (optional) | Explicit process / pipeline regressions | TBD | TBD | Route operational hygiene issues to the right owner without conflating them with quality |

## Exact code touch list

### Already verified in repo
`agents/may/handlers/metrics-snapshot.ts` already contains both the registry entries and the measurement logic:
- Registry entries: lines `72`–`73`
  - `evaluator.low-quality-rate-24h`
  - `evaluator.substantive-low-quality-rate-24h`
- Measurement calls: lines `618` and `640`
  - `record("evaluator.low-quality-rate-24h", ...)`
  - `record("evaluator.substantive-low-quality-rate-24h", ...)`

### Files that would need to change
1. **If alert routing is in-repo:** the file that currently consumes `evaluator.low-quality-rate-24h` for paging/thresholding should be repointed to `evaluator.substantive-low-quality-rate-24h`.
2. `agents/may/handlers/metrics-snapshot.ts` — **only if** we want metadata cleanup (for example, keeping the broad metric explicitly labeled dashboard-only, which is already true in the registry text).
3. **If alerting is external:** no repo code change is required; the owner just updates the alert rule to watch `evaluator.substantive-low-quality-rate-24h` instead of the broad metric.

## Rollback plan
1. Switch the alert/threshold consumer back to `evaluator.low-quality-rate-24h`.
2. Continue collecting `evaluator.substantive-low-quality-rate-24h` as a comparison/dashboard metric.
3. No migration, backfill, or destructive DB change is needed because both metrics are derived from existing `evaluations` and `sessions` data at snapshot time.

## Why approval is the right next step
- The blocker is now **governance / metric intent**, not analysis: should hygiene/process NI page the same way as substantive output-quality failures?
- The worker stall pattern was operational (`project.md` edits, ignored files, commit/finish guard failures), so another planning-only loop is unlikely to change runtime behavior.
- Because the substantive metric already exists in runtime code and in the `metrics` table, approval can unlock a low-risk alert pivot without waiting for a larger implementation cycle.

## References
- Iteration 3 impact model: `agents/shared/projects/evaluator-low-quality-rate-calibration/outputs/iteration-3-impact-model-and-recommendation.md`
- Iteration 4 implementation plan: `agents/shared/projects/evaluator-low-quality-rate-calibration/outputs/iteration-4-metric-split-implementation-plan.md`
- Metric implementation: `agents/may/handlers/metrics-snapshot.ts`
