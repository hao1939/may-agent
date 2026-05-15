# Alert 287 raw finish-blocked recheck — 2026-05-11

## Metric judged

- Metric: `session.finish-blocked-uncommitted-count-24h`
- Alert: `287`
- Current: `57`
- Threshold: `50`
- Target: `0`
- Priority: `P2`
- Owner/project: `dev` / `finish-blocked-hygiene-reduction`

## Evidence checked

- The raw metric remains in breach: latest row reports `current=57`, `threshold=50`, `target=0`, `alert_op=>`.
- The paired strict metric remains healthy: `session.finish-blocked-unresolved-count-24h current=0` at the same snapshot time.
- Recent paired snapshots show raw values fluctuating `56–58`, while the strict metric stayed `0` across the latest ten paired snapshots.
- Fresh classification of the live raw 24h slice found no unresolved dirty exits:
  - `54` repaired successful exits.
  - `1` repaired partial exit.
  - `2` terminal no-recovery interrupted rows.
  - `0` other unresolved cases.
- Top sources are repaired/terminal workflow friction, not a new unrecovered source pattern: `workflow:scout-heartbeat`, `workflow:scout-explore`, `workflow:closed-loop-steward`, `workflow:may-heartbeat`, and related sources all had `other_unresolved=0`.

## Judgment

Operation: `waiting_with_evidence`.

The alert is a real raw-friction breach, so it should not be manually resolved or hidden. It also does not currently indicate an unresolved dirty-exit problem requiring another root-cause patch, because every row in the live raw slice is already repaired or intentionally terminal and the strict unresolved metric is healthy. Continue monitoring at the next metrics snapshot. Resume `finish-blocked-hygiene-reduction` only if the strict metric breaches or future raw sampling exposes a fresh non-recovered source pattern.
