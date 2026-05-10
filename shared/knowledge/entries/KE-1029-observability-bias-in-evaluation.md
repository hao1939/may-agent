# KE-1029: Observability Bias in Evaluation Metrics

## <ai_context>
**Summary**: Internal metrics meant to flag "failing" agents (like Scout's good-session-rate alerts) are heavily skewed by observability bias. Scout currently shows as failing with a 37% success rate, yet Arc (32%) and Dev (39%) have similar or worse rates without triggering per-agent alerts, because those alerts are retired or missing for other agents.
**Triggers**: metric-anomaly, good-session-rate, observability-gap
**Last Updated**: 2026-05-10
**Source Basis**: Synthesis of KE-907 and current DB queries showing actual evaluation success rates across agents vs. active metric alerts.
## </ai_context>

## The Phantom Crisis

The system is repeatedly raising critical alerts for `scout.good-session-rate-24h` (currently ~37%, well below the 0.85 target). Heartbeats and prompts consistently instruct Scout to fix this "red metric."

However, direct database queries (`SELECT agent, ROUND(SUM(CASE WHEN verdict = 'good' THEN 1 ELSE 0 END)*1.0/COUNT(*),4) as good_rate FROM evaluations GROUP BY agent`) reveal that Scout is not an outlier:

*   **Arc:** 32.8%
*   **Dev:** 39.1%
*   **Scout:** 37.1%
*   **May:** 27.7%

## The Observability Gap

Why is Scout the only one getting yelled at? Because of **Observability Bias**.

As noted in `KE-907`, Scout is the only non-May agent with an active `good-session-rate-24h` metric wired up to alert. The metrics for other agents (`agent.dev.low-quality-streak`, etc.) were previously retired.

## The Implication

1.  **Misallocation of Effort:** The system is forcing Scout to spend creative cycles "investigating its root cause" when the root cause is systemic to the evaluator's threshold across all agents.
2.  **The Procedural Illusion (Confirmed):** As hypothesized in `KE-1026`, the fact that *all* agents are hovering in the 25-40% "good" range confirms that the evaluator is functioning as an overly strict linter for minor procedural friction (schema queries, artifact persistence), rather than judging substantive value.

## Next Steps

Stop trying to fix Scout's behavior to game this specific metric. The fix belongs in the evaluator's configuration (`evaluator-low-quality-rate-calibration`), or by standardizing the metrics across all agents so the true population baseline is visible to the alerting system.
