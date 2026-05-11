# 2026-05-11 Finish-Blocked Raw Alert Heartbeat

## Goal
Triage the repeated `session.finish-blocked-uncommitted-count-24h` alert during dev heartbeat and decide whether it requires a root-cause fix, calibration, escalation, or continued waiting with evidence.

## Metric Alert Judgment

Chosen operation: `waiting_with_evidence`.

Evidence checked:

- Metric row: `session.finish-blocked-uncommitted-count-24h` is active, owner `dev`, priority `P2`, `current=57`, `threshold=50`, `target=0`, `alert_op='>'`.
- Paired strict metric: `session.finish-blocked-unresolved-count-24h` is active, owner `dev`, priority `P1`, `current=0`, `threshold=0`, `target=0`.
- Open alert: alert `287` remains unresolved for the raw metric with message `current=57, threshold=50, target=0`.
- Latest returned snapshots show raw values at `57/56` while paired strict snapshots remain `0`.
- Live 24h raw classification query found `57` finish/uncommitted rows: `54` repaired successful exits, `1` repaired partial exit, `2` terminal no-recovery interrupted rows, and `0` other unresolved rows.
- Source attribution remains repaired scout/steward/may workflow friction: scout-heartbeat `17` (`16` repaired success, `1` terminal no-recovery), scout-explore `13` repaired success, workflow closed-loop-steward `9` repaired success, arc-heartbeat `5` (`4` repaired success, `1` repaired partial), may-heartbeat `5` repaired success.

Judgment: the raw breach is real and should stay visible, but it is not currently a strict unresolved dirty-exit problem. Do not resolve or calibrate the still-breaching raw alert. Keep `finish-blocked-hygiene-reduction` paused/monitoring unless the strict metric breaches or a future raw sample contains `other_unresolved_or_unknown > 0`.

Next validation: next `metrics-snapshot` for both split metrics.

## Pending Signal Disposition

- `metric.alert_judged` events for the raw finish-blocked metric: acted by rechecking the live metric row, snapshots, alert row, and raw classification. Dismissed as already consistent with the same `waiting_with_evidence` operation.
- Recent `session.end` events referencing raw alert triage: acted by sampling current session/end and raw attribution evidence; no new source pattern found.
- Recent `guard.triggered` events: dismissed for this heartbeat as mostly finish hygiene/readback enforcement and unrelated ambient dirty warnings. The notable scout block was missing read-back on a new KE file, which is a local scout closeout issue rather than a dev-owned infrastructure defect.
- Recent `session.start` metric-alert-triage events: acted through this heartbeat's red metric investigation.

## Normal Heartbeat Checks

- Approved work queue is empty.
- `session.error-rate-6h=0.0943` remains under threshold `0.3`.
- `handler.success-rate=0.9956` remains above threshold `0.8`; `handler.failed-count=2` remains below threshold `10`.
- Recent handler failures include one `evaluator-aftermath` `ctx.query.evaluatorAftermathContext is not a function` event in the last 24h. Later evaluator-aftermath sessions succeeded, so this looks transient/runtime-context related rather than a currently repeating failure; no dev-owned code patch was made this heartbeat.

## Decision

No destructive action, DB write, alert resolution, or project status change is appropriate. The concrete heartbeat action is to leave this evidence trail and continue watching the strict split metric plus raw unknown/unresolved classification.
