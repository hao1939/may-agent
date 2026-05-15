# Alert 287 — Raw Finish-Blocked Metric Triage

Time: 2026-05-11T06:18Z
Metric: `session.finish-blocked-uncommitted-count-24h`
Alert: `287`
Chosen operation: `waiting_with_evidence`

## Judgment

The raw finish-blocked breach is real (`current=54`, `threshold=50`, `target=0`, priority `P2`), but it is not evidence of a new unresolved dirty-exit root cause. The paired strict metric `session.finish-blocked-unresolved-count-24h` is healthy at `current=0`, with the latest ten snapshots all at `0`.

## Evidence checked

- Raw metric row: `current=54`, `threshold=50`, `target=0`, `status=active`, `project=finish-blocked-hygiene-reduction`.
- Latest raw snapshots: the last six snapshots are stable at `54` after rising from `51 -> 52 -> 53 -> 54`.
- Open alert: alert `287` is the only unresolved alert for this raw metric.
- Paired strict metric row: `session.finish-blocked-unresolved-count-24h current=0`, `threshold=0`, `priority=P1`.
- Paired strict snapshots: latest ten snapshots are all `0`.
- Current raw 24h classification query over `evaluations` + latest `session_digests` returned:
  - `51` repaired successful exits (`session.status='done'`, `session.outcome='done'`, latest digest `outcome='success'`)
  - `1` repaired partial digest
  - `2` interrupted rows already marked terminal no-recovery (`action='nothing'`, `action_reason LIKE '%No recoverable work worth resuming%'`)
  - `0` other unresolved rows

## Decision

Choosing `waiting_with_evidence`: the metric is a deliberately visible raw-friction monitor, and the current breach is explained by repaired or terminally classified historical rows inside the 24h window. No root-cause patch, calibration, downgrade, manual resolve, or escalation is indicated while the strict unresolved metric remains green and the raw bucket has no unrecovered rows.

## Next validation

Validate on the next metrics snapshot. Resume `finish-blocked-hygiene-reduction` immediately if `session.finish-blocked-unresolved-count-24h` breaches or if raw sampling exposes a fresh non-recovered source pattern.

## 2026-05-11T08:29Z heartbeat recheck

Repeated alert still warrants `waiting_with_evidence`, not a new fix or escalation. Fresh metric rows show raw `session.finish-blocked-uncommitted-count-24h current=58` over threshold `50`, while paired strict `session.finish-blocked-unresolved-count-24h current=0`; alert `287` remains the only open finish-blocked alert, and resolved strict alert `284` stayed recovered. The latest ten paired snapshots remain raw `58` / strict `0`.

Fresh raw 24h classification over `evaluations`, `sessions`, and latest `session_digests` found all `58` rows recovered or intentionally terminal:

- `55` repaired successful exits (`status=done`, `outcome=done`, latest digest `success`)
- `1` repaired partial digest
- `2` terminal no-recovery interrupted rows (`action=nothing`, `action_reason` includes `No recoverable work worth resuming`)
- `0` other unresolved rows

Source attribution is still repaired workflow friction, led by scout heartbeat/explore and may steward/heartbeat paths, with no new unrecovered bucket. Latest samples include successful scout rows evaluated `good`, successful may/steward rows with the separate `committed runtime handoff files` issue, and no strict dirty-exit cases.

Decision: keep `finish-blocked-hygiene-reduction` paused/monitoring. Do not calibrate or manually resolve the still-breaching raw metric; resume only if the strict unresolved metric breaches or future raw sampling exposes a new non-recovered source pattern.

## 2026-05-11T08:42Z heartbeat recheck

Repeated alert still warrants `waiting_with_evidence`. Fresh metric rows show raw `session.finish-blocked-uncommitted-count-24h current=57` over threshold `50`, while paired strict `session.finish-blocked-unresolved-count-24h current=0`; alert `287` remains the only open finish-blocked alert. The latest raw snapshots are `57, 57, 58, 58...` while the latest ten strict snapshots are all `0`.

Fresh raw 24h classification found all `58` rows recovered or intentionally terminal:

- `55` repaired successful exits
- `1` repaired partial exit
- `2` terminal no-recovery interrupted rows
- `0` other unresolved rows

Source attribution remains repaired scout/steward/may workflow friction rather than a fresh unrecovered dirty-exit pattern. Final operation: `waiting_with_evidence`; next validation is the next metrics snapshot, or immediate project resume if the strict metric breaches.

## 2026-05-11T08:29Z metric-alert triage recheck

Repeated alert `287` still warrants `waiting_with_evidence`, not calibration, manual resolve, or escalation. Fresh metric rows show raw `session.finish-blocked-uncommitted-count-24h current=58` over threshold `50`, while paired strict `session.finish-blocked-unresolved-count-24h current=0` with the latest ten strict snapshots all at `0`; alert `287` remains the only open alert for this raw metric.

Fresh raw 24h classification over `evaluations`, `sessions`, and latest `session_digests` found all `58` rows recovered or intentionally terminal:

- `55` repaired successful exits (`status=done`, `outcome=done`, latest digest `success`)
- `1` repaired partial exit
- `2` terminal no-recovery interrupted rows (`action=nothing`, `action_reason` includes `No recoverable work worth resuming`)
- `0` other unresolved rows

Source attribution remains repaired workflow friction, led by `workflow:scout-heartbeat` (`16` repaired success plus `1` terminal no-recovery), `workflow:scout-explore` (`15` repaired success), and `workflow:closed-loop-steward` (`9` repaired success); the latest samples are successful scout rows or successful may/steward rows with the separate `committed runtime handoff files` issue, not unrecovered source deliverables.

Decision: choose `waiting_with_evidence` and keep `finish-blocked-hygiene-reduction` paused/monitoring. Validate on the next metrics snapshot; resume immediately if the strict unresolved metric breaches or future raw sampling exposes a fresh non-recovered dirty-exit pattern.
