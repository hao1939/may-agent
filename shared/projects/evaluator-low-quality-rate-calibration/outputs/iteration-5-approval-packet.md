# Iteration 5 — Approval packet: pivot alerting from broad NI-rate to substantive quality-rate

## One-paragraph ask (approval request)
Please approve **keeping** the current broad metric (`evaluator.low-quality-rate-24h`) for dashboarding, but **pivoting alerting/thresholding** away from it and onto `evaluator.substantive-low-quality-rate-24h` (already implemented + currently low). The data show the broad metric is dominated by hygiene/pipeline penalties (e.g., `finish() blocked`, `schema/query error in transcript`), so it breaches persistently even when substantive output quality is acceptable. The change preserves visibility into hygiene via the broad metric (and/or separate hygiene metrics), while making the “quality breach” alert represent substantive failures.

---

## Table 1 — Rates in last 24h (from Iteration 3)

| Definition | Numerator | Denominator | Rate | Notes |
|---|---:|---:|---:|---|
| **Current (baseline)**: `evaluator.low-quality-rate-24h` | 356 | 523 | **0.6807** | Counts `needs_improvement` / `low_quality` OR `quality<0.4` OR `efficiency<0.4` |
| **Hygiene-excluded (counterfactual)** | 51 | 523 | **0.0975** | Excludes issues containing hygiene markers: `finish() blocked`, `uncommitted changes`, `schema/query error in transcript` |
| **Substantive-only (counterfactual)** = substantive metric intent | 40 | 523 | **0.0765** | Terminal failure (`sessions.status in ('error','interrupted')`) OR substantive markers (`tool hallucination`, `verification failure`, `blind overwrite`) |

---

## Table 2 — Proposed metrics + thresholds (policy)

| Metric id | What it means | Proposed alert threshold | Proposed target | Action owner |
|---|---|---:|---:|---|
| `evaluator.low-quality-rate-24h` | Broad “friction” (hygiene + substance + pipeline unscorable counted as NI/low) | **No paging** (dashboard only) | Trend down over time | Evaluator/infra owners; used for hygiene discovery |
| `evaluator.substantive-low-quality-rate-24h` | Substantive quality failures (terminal failures + explicit substantive markers) | **0.30** (replace current paging metric) | **≤ 0.10** | Evaluator quality owner (this aligns with intent of “quality breach”) |

If a separate hygiene page is desired: add/confirm one or more dedicated hygiene metrics (finish-blocked rate, schema/query error rate, runner interrupted/error rate) with their own thresholds and owners.

---

## Exact code touch list (if any changes are needed)

**No metric code change is required** to compute the substantive metric: `evaluator.substantive-low-quality-rate-24h` already exists in `agents/may/handlers/metrics-snapshot.ts`.

The remaining change is wherever the **alerting/threshold consumer** is configured to page on `evaluator.low-quality-rate-24h` today.

1) **If alerting is in-repo**: update the alert config / threshold routing to page on `evaluator.substantive-low-quality-rate-24h` instead of `evaluator.low-quality-rate-24h`.
2) **If alerting is external** (Grafana/Datadog/etc.): update the external monitor query + threshold accordingly.

(Iteration 4 includes a PR-ready plan for a code-level metric split if we later decide to adjust definitions, but the key point here is: we can pivot alerting with *zero* metric computation changes.)

---

## Rollback plan

1) Revert the alert/monitor to page on `evaluator.low-quality-rate-24h` (the old query/monitor id should be kept in the change log).
2) Keep both metrics recorded (no data model changes required), so rollback is only a monitor/config change.

---

## References

- Iteration 3 impact model + numbers: `agents/shared/projects/evaluator-low-quality-rate-calibration/outputs/iteration-3-impact-model-and-recommendation.md`
- Iteration 4 metric-split implementation plan (if we later choose to change definitions in code): `agents/shared/projects/evaluator-low-quality-rate-calibration/outputs/iteration-4-metric-split-implementation-plan.md`
