# Heartbeat artifact — evaluator (2026-05-07)

## Operation chosen for alert
**Investigate → escalate to owner of pipeline/metric (May)**

## Metric
- `evaluator.low-quality-rate-24h` current **0.4479** (target 0.1, threshold 0.3)

## Findings (root cause)
This metric is dominated by **skipped** evaluations that are still being recorded as low-quality.

DB evidence (last 24h):
- `evaluations`: total **97**
- low-quality by definition (quality < 0.5): **43** → low_rate **0.4433**

Key slice:
- `skippedByJs=1`: **34** rows, and **34/34** are low-quality with **quality=0.2** → low_rate **1.0**
- `skippedByJs=0`: **63** rows, low **9** → low_rate **0.1429**

The skipped set appears to be exclusively **may** sessions, mostly `source='workflow:orchestrator'` with `opCount=0`.

## Recommendation
- Metric should likely exclude `skippedByJs=1` from denominator (or split into a separate `skipped-rate` metric).
- Pipeline should not assign a hardcoded low numeric quality when the evaluation is skipped.

## Action taken
Sent May a P1 message with the above evidence and a suggested fix direction.
