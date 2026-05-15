# 2026-05-11 Finish-Blocked Raw Alert Heartbeat Recheck

## Signal

- Metric: `session.finish-blocked-uncommitted-count-24h`
- Alert: `287`, unresolved
- Stored value at recheck: `current=60`, `threshold=50`, `target=0`, `priority=P2`
- Paired strict metric: `session.finish-blocked-unresolved-count-24h current=0`

## Operation

Chosen operation: **document_exception**.

The raw breach is real and should remain visible, but it is an accepted monitoring exception while the strict unresolved dirty-exit metric stays at zero. No destructive action is involved or indicated. No root-cause patch is indicated in this heartbeat because fresh classification found no unresolved dirty exits.

## Evidence

Read-only DB checks showed:

- Metric rows exist for both split metrics; raw is `60`, strict is `0`.
- Latest paired snapshots show raw fluctuating `60–64` while strict remains `0`.
- Open alerts: raw alert `287` is unresolved; prior strict alert `284` is resolved.
- Fresh live raw classification of the 24h finish/uncommitted slice found all `60` rows recovered or terminal:
  - `58` repaired successful exits
  - `1` repaired partial exit
  - `1` terminal no-recovery interrupted exit
  - `0` other unresolved rows
- Source attribution remains repaired workflow friction, not a new unresolved source pattern:
  - `workflow:scout-heartbeat`: 21 total, 20 repaired success, 1 terminal no-recovery
  - `workflow:scout-explore`: 18 repaired success
  - `workflow:closed-loop-steward`: 10 repaired success
  - other sources have no unresolved rows

## Pending Event Triage

- `handler.workflow_dispatched` / `metric.alert_judged` / recent metric-alert-triage `session.end`: acted; they are the existing alert-287 judgment chain and consistent with this recheck.
- `guard.triggered`: dismissed as watch/ambient dirty-worktree guard noise unless tied to this session's own deliverables.
- `session.start`: dismissed as lifecycle noise.
- Recent handler errors: noted for normal heartbeat awareness; the current red metric does not require a handler patch.

## Next Validation

Keep `finish-blocked-hygiene-reduction` paused. Resume immediately if `session.finish-blocked-unresolved-count-24h` breaches or a future raw sample has `other_unresolved > 0`; otherwise continue treating raw alert `287` as a documented project-level exception while strict stays zero.
