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
