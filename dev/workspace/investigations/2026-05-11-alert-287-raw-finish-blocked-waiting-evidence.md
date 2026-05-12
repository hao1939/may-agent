# Alert 287 raw finish-blocked waiting evidence

## Alert

- Metric: `session.finish-blocked-uncommitted-count-24h`
- Alert: `287`
- Operation: `waiting_with_evidence`
- Triage time: 2026-05-11T06:43Z

## Goal/context

This metric is the raw 24h count of evaluations whose issues include `finish blocked by uncommitted changes`. It intentionally tracks finish-block friction, while the paired strict metric `session.finish-blocked-unresolved-count-24h` tracks unrecovered dirty exits that should resume the `finish-blocked-hygiene-reduction` project.

## Facts checked

- Current raw metric row: `current=56`, `threshold=50`, `target=0`, `priority=P2`, `alert_op=>`, project `finish-blocked-hygiene-reduction`.
- Recent snapshots show the raw metric rose from `54` to `55` to `56` and is still breaching.
- Paired strict metric row is healthy: `session.finish-blocked-unresolved-count-24h current=0`, `threshold=0`, `target=0`, `priority=P1`.
- Recent paired snapshots show strict remains `0` for the latest ten samples while raw is `54-56`.
- Current raw 24h classification query returns `total=56`, `repaired_success=53`, `repaired_partial=1`, `terminal_no_recovery=2`, `other_unresolved=0`.
- Source attribution is dominated by repaired successful exits: `workflow:scout-heartbeat=16`, `workflow:scout-explore=13`, `workflow:closed-loop-steward=8`, `workflow:may-heartbeat=5`, `workflow:arc-heartbeat=4`, plus smaller repaired sources. The only terminal-no-recovery rows are one `closed-loop-steward` and one `workflow:scout-heartbeat` row.
- Latest raw samples are recovered or intentionally terminal: newest rows include `status=done`/`outcome=done`/latest digest `success`; the fresh interrupted scout row has `action=nothing` with `No recoverable work worth resuming`.

## Judgment

The alert is real but currently represents raw friction rather than a new unresolved dirty-exit source. Because the strict unresolved metric is healthy and the raw slice has `other_unresolved=0`, no owner-local root-cause patch, metric calibration, manual resolve, downgrade, or escalation is indicated now.

## Operation

Choosing `waiting_with_evidence`: keep the project paused/monitoring and validate on the next metrics snapshot. Resume `finish-blocked-hygiene-reduction` immediately if the strict unresolved metric breaches or if a newer raw slice contains non-recovered rows (`other_unresolved > 0`) indicating a fresh source pattern.

## 2026-05-11T08:30Z recheck — alert 304

- Open alert: `304` for `session.finish-blocked-uncommitted-count-24h`, message `current=52, threshold=50, target=0`.
- Current metric row still breaches raw friction: `current=52`, `threshold=50`, `target=0`, `priority=P2`, `owner=dev`.
- Paired strict metric remains healthy: `session.finish-blocked-unresolved-count-24h current=0`, `threshold=0`, `target=0`.
- Latest ten paired snapshots show raw `52-53` while strict remains `0` throughout.
- Live raw source query returns `52` rows in the last 24h.
- Current classification with latest `session_digests`: `51` rows are `status=done`/`outcome=done` with digest `success`, and the only non-done row is interrupted scout heartbeat `s_1778474482404_6` with `action=nothing` / `No recoverable work worth resuming`; there are `0` other unresolved rows.
- Source/verdict attribution remains repaired workflow friction, led by scout heartbeat/explore and closed-loop-steward rows; recent samples are completed sessions except the already terminal no-recovery interrupted row.

Judgment for alert 304: choose `document_exception` / monitoring hold with evidence. The raw breach is real but still intentionally accepted while the strict unresolved metric stays at `0`; no root-cause patch, calibration, manual resolve, or emergency escalation is indicated unless the strict metric breaches or raw classification exposes a new non-recovered source pattern.
