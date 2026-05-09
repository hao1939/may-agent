# Iteration 5 — Approval packet: pivot alerting from broad NI-rate to substantive-quality rate

## One-paragraph ask (approval needed)
Please approve an **alerting/policy pivot**: keep collecting `evaluator.low-quality-rate-24h` (broad: includes hygiene/process “needs_improvement” outcomes), but **move paging/thresholding to `evaluator.substantive-low-quality-rate-24h`** (substantive: terminal failures and core correctness/safety markers). This aligns the alert with “real quality collapse” rather than pipeline/hygiene friction, while preserving separate visibility into hygiene regressions.

---

## Table 1 — Observed rates (last 24h; DB-backed in Iteration 3)

| Definition | Metric / counterfactual | Numerator / Denominator | Rate |
|---|---|---:|---:|
| **Current (baseline)** | `evaluator.low-quality-rate-24h` definition (NI/low_quality OR quality<0.4 OR efficiency<0.4) | 356 / 523 | **0.6807** |
| **Hygiene-excluded (counterfactual)** | Baseline low-quality **excluding** issues containing hygiene markers (`finish() blocked`, `uncommitted changes`, `schema/query error in transcript`) | 51 / 523 | **0.0975** |
| **Substantive-only (counterfactual)** | Terminal failure (`sessions.status IN ('error','interrupted')`) OR issues contain (`tool hallucination`,`verification failure`,`blind overwrite`) | 40 / 523 | **0.0765** |

Notes:
- In the sampled 24h slice, substantive flags were **entirely driven by terminal failures**; the three substantive marker strings were 0 occurrences.
- This implies the current breach is primarily definition/aggregation: hygiene/unscorable outcomes are being treated as “low quality.”

---

## Table 2 — Proposed metrics + thresholds (policy/alert intent)

| Metric id | What it represents | Recommended target | Recommended paging threshold | Actionability / owner |
|---|---|---:|---:|---|
| `evaluator.low-quality-rate-24h` | **Broad friction rate**: any NI/low_quality or low quality/efficiency score (includes hygiene/process and unscorable outcomes) | 0.10 (info) | **Not primary paging** (dashboard / secondary alert) | Mixed owners (agent behavior + pipeline) |
| `evaluator.substantive-low-quality-rate-24h` | **Substantive evaluator quality failures**: terminal failures and core correctness/safety markers | 0.10 | **0.30 (primary paging)** | Primary “quality collapse” signal |
| (optional follow-up) `evaluator.unscorable-rate-24h` / `evaluator.hygiene-failure-rate-24h` | Explicitly track pipeline/hygiene causes separately (e.g., interrupted, transcript query errors, finish blocked) | 0.05–0.10 | TBD | Pipeline/workflow owners |

---

## Exact code touch list (surgical)

No changes are proposed to `agents/shared/projects/**` (gitignored; causes workflow/finish guards).

If alerting is configured **in-repo**:
1) **Potentially** update the metric registry/measurement (only if needed):
   - `agents/may/handlers/metrics-snapshot.ts`
     - Confirm `evaluator.substantive-low-quality-rate-24h` is **recorded** every snapshot run (it appears to already exist).
2) Update whatever alert/threshold consumer watches `evaluator.low-quality-rate-24h` to instead watch `evaluator.substantive-low-quality-rate-24h`.
   - (Discovery needed if not already known; search for `evaluator.low-quality-rate-24h` usage outside metrics snapshot.)

If alerting is configured **externally** (Grafana/Alertmanager/etc.):
- No code change needed; this packet is requesting the **policy decision and the alert rule change** in that external system.

---

## Rollback plan

Rollback is straightforward and low-risk:
1) Repoint paging/threshold back to `evaluator.low-quality-rate-24h` (original behavior).
2) Keep `evaluator.substantive-low-quality-rate-24h` collecting as a dashboard metric for future analysis.
3) No data migration is required; these are derived metrics computed from `evaluations`/`sessions` each snapshot.

---

## References
- Iteration 3 (impact model + numbers): `agents/shared/projects/evaluator-low-quality-rate-calibration/outputs/iteration-3-impact-model-and-recommendation.md`
- Iteration 4 (metric-split implementation plan + SQL): `agents/shared/projects/evaluator-low-quality-rate-calibration/outputs/iteration-4-metric-split-implementation-plan.md`
