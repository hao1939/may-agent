# Finish-Blocked Raw Alert Churn

## Signal

`session.finish-blocked-uncommitted-count-24h` is a real raw-friction breach at `current=53`, `threshold=50`, with open alert `304`. The paired strict metric `session.finish-blocked-unresolved-count-24h` is healthy at `current=0`.

## Evidence Checked

- Metric rows: raw metric is dev-owned, active, P2, `alert_op='>'`, project `finish-blocked-hygiene-reduction`; strict unresolved metric is active and `current=0`.
- Recent snapshots: latest ten paired snapshots show raw `52-54/53` while strict unresolved remains `0` throughout.
- Live classification of the raw 24h slice found no unresolved dirty exits: `52` repaired-success rows and `1` terminal no-recovery row.
- Source attribution is repaired workflow friction, not a new unrecovered source pattern: `workflow:scout-heartbeat=18 repaired_success + 1 terminal_no_recovery`, `workflow:scout-explore=18 repaired_success`, `workflow:closed-loop-steward=9 repaired_success`, plus small repaired buckets.
- Recent `metric.alert_judged` events show repeated `document_exception` judgments for alert `304` with the same evidence, including sessions `s_1778542875944_631` and `s_1778544076042_644`.

## Judgment

Chosen metric-alert operation: `document_exception`. The breach is real and should stay visible as raw finish-block friction, but it is accepted while the strict unresolved metric remains zero. No root-cause patch, destructive action, manual alert resolution, or metric recalibration is warranted from this heartbeat.

## Follow-up Condition

Resume `finish-blocked-hygiene-reduction` immediately if `session.finish-blocked-unresolved-count-24h` breaches or if raw sampling exposes any `other_unresolved` row. Otherwise, the next useful system-level improvement is a safe-write/runtime policy decision: record a formal metric exception/downgrade/review condition for the raw metric, or teach alert dispatch to suppress repeated owner sessions when a same-alert `document_exception` was already recorded recently and the paired strict metric remains healthy.
