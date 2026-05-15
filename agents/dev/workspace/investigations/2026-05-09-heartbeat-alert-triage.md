# 2026-05-09 Dev Heartbeat Alert Triage

## Signal reviewed
- Approved work queue is empty.
- Runtime metrics table has 31 active metrics; core dev-relevant health is green (`session.error-rate-6h` 0.0444 vs threshold 0.3, `handler.success-rate` 1.0 vs threshold 0.8).
- Open metric alerts are owned by evaluator/scout, not dev: `evaluator.low-quality-rate-24h`, `scout.good-session-rate-24h`, and `scout.operational-friction-rate-24h`.

## Finding
`evaluator.low-quality-rate-24h` remains open at the broad rate while the already-implemented substantive companion metric is green. Latest snapshot evidence during this heartbeat showed:

| metric | value | sample_size |
| --- | ---: | ---: |
| evaluator.low-quality-rate-24h | 0.6823 | 491 |
| evaluator.substantive-low-quality-rate-24h | 0.0855 | 491 |

This confirms the evaluator calibration project’s central diagnosis: the broad metric is measuring hygiene/process `needs_improvement` volume, while the substantive-only metric is below the 0.30 alert threshold.

## Action taken
No runtime/code fix was applied in this heartbeat because the alert owner is evaluator and the active project is already iterating on the calibration/alert-repointing decision. I verified the exact recomputation queries are schema-valid against the live DB (`sessions.sessionId`, not `sessions.id`) and match the snapshot values.

## Follow-up recommendation
Evaluator/May should decide whether to close or downgrade the broad `evaluator.low-quality-rate-24h` alert and make `evaluator.substantive-low-quality-rate-24h` the page-worthy metric. Until that policy decision lands, dev should not mask the alert by changing thresholds ad hoc.
