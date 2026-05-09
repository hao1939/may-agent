# Iteration 5 — Approval packet: pivot alerting from broad NI-rate to substantive-quality rate

## One-paragraph ask (approval needed)
Please approve an **alerting/policy pivot** for evaluator quality monitoring: keep collecting `evaluator.low-quality-rate-24h` as the broad friction signal, but **move paging/thresholding intent to `evaluator.substantive-low-quality-rate-24h`** so alerts represent substantive output-quality failures rather than mixed hygiene/process penalties. The quantitative impact model from Iteration 3 shows the current broad rate at **0.6807** (356/523), while a hygiene-excluded counterfactual is **0.0975** (51/523) and the substantive-only counterfactual is **0.0765** (40/523). The substantive metric is already present in `agents/may/handlers/metrics-snapshot.ts`; approval is needed to make it the primary alert target and to preserve the broad metric as a dashboard/secondary signal.

## Table 1 — Observed rates (last 24h; DB-backed in Iteration 3)

| Definition | Metric / counterfactual | Numerator / Denominator | Rate |
|---|---|---:|---:|
| **Current (baseline)** | `evaluator.low-quality-rate-24h` definition: `verdict IN ('needs_improvement','low_quality') OR quality < 0.4 OR efficiency < 0.4` | 356 / 523 | **0.6807** |
| **Hygiene-excluded (counterfactual)** | Baseline low-quality excluding issues containing hygiene markers: `finish() blocked`, `uncommitted changes`, `schema/query error in transcript` | 51 / 523 | **0.0975** |
| **Substantive-only (counterfactual)** | `sessions.status IN ('error','interrupted')` OR issues contain `tool hallucination`, `verification failure`, `blind overwrite` | 40 / 523 | **0.0765** |

Notes:
- In this 24h slice, the substantive-only count was driven entirely by **terminal failures**; the three substantive marker strings were 0 occurrences.
- This strongly suggests the current breach is dominated by **definition/aggregation**, not a broad collapse in substantive work quality.

## Table 2 — Proposed metrics + thresholds

| Metric id | Purpose | Recommended target | Recommended threshold | Recommended use |
|---|---|---:|---:|---|
| `evaluator.low-quality-rate-24h` | Broad friction rate: hygiene/process + substantive NI/low-score outcomes | 0.10 | 0.30 (or higher if retained) | Dashboard / secondary alert, not primary paging |
| `evaluator.substantive-low-quality-rate-24h` | Substantive evaluator quality failures only | 0.10 | **0.30** | **Primary paging / thresholded quality alert** |
| Optional follow-up metric family | Explicit hygiene or unscorable rate(s) | 0.05–0.10 | TBD | Route pipeline/process regressions to the right owner |

## Exact code touch list

### Confirmed current code state
The substantive metric is already registered and measured in `agents/may/handlers/metrics-snapshot.ts`:
- Registry entries: lines reported by grep at **70–71**
  - `evaluator.low-quality-rate-24h`
  - `evaluator.substantive-low-quality-rate-24h`
- Measurement calls: lines reported by grep at **541** and **563**
  - `record("evaluator.low-quality-rate-24h", ...)`
  - `record("evaluator.substantive-low-quality-rate-24h", ...)`

### Files that would change if alerting is in-repo
1. `agents/may/handlers/metrics-snapshot.ts`
   - **Only if needed for metadata/threshold alignment**; substantive metric measurement already exists.
   - Possible change: clarify naming/description so broad vs substantive intent is explicit.
2. **Alert consumer file(s), if any, discovered via metric-id usage search**
   - Repoint alerting from `evaluator.low-quality-rate-24h` to `evaluator.substantive-low-quality-rate-24h`.
   - If the consumer is not in-repo, no code change is required here.

### If alerting is external
- No repo code change is required to change paging behavior.
- Required action is an **owner-approved alert rule update** in the external alerting system.

## Rollback plan
1. Repoint paging/thresholding back to `evaluator.low-quality-rate-24h`.
2. Keep `evaluator.substantive-low-quality-rate-24h` collecting as a dashboard metric for comparison and future calibration.
3. No migration or destructive backfill is needed; both metrics are derived from existing `evaluations` and `sessions` data at snapshot time.

## Why approval is the right next step
- The blocker is now **governance/intent**, not analysis: should broad hygiene/process NI drive the same alert as substantive quality failures?
- The worker has already been stalled by repo hygiene traps around `agents/shared/projects/**` and accidental `project.md` edits; another planning loop is unlikely to change runtime behavior.
- Because the substantive metric already exists in code, approval can unlock a low-risk alert pivot without waiting for a larger implementation cycle.

## References
- Iteration 3 impact model: `agents/shared/projects/evaluator-low-quality-rate-calibration/outputs/iteration-3-impact-model-and-recommendation.md`
- Iteration 4 implementation plan: `agents/shared/projects/evaluator-low-quality-rate-calibration/outputs/iteration-4-metric-split-implementation-plan.md`
- Metric registry/measurement file: `agents/may/handlers/metrics-snapshot.ts`
