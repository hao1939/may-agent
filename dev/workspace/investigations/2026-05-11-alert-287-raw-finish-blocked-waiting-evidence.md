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
