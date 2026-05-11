# 2026-05-11 Heartbeat — Finish-Blocked Raw Alert Recheck

## Signal

- Red metric: `session.finish-blocked-uncommitted-count-24h`
- Stored metric row: `current=59`, `threshold=50`, `target=0`, `alert_op=>`, `priority=P2`, owner `dev`
- Open alert: `287`
- Paired strict metric: `session.finish-blocked-unresolved-count-24h current=0`

## Judgment

Chosen operation: `document_exception` / monitored exception.

The raw breach is real, but it is accepted monitoring friction for now because the paired strict unresolved metric remains healthy and the live raw slice contains no unresolved dirty exits.

Fresh classification of the live 24h raw slice:

- `56` repaired successful exits
- `1` repaired partial exit
- `2` terminal no-recovery interrupted exits
- `0` other unresolved exits

Top raw sources remain repaired workflow friction, led by `workflow:scout-heartbeat=17`, `workflow:scout-explore=16`, and `workflow:closed-loop-steward=9`.

## Pending Event Disposition

- `guard.triggered` events: dismissed as ambient finish/read guard activity owned by the triggering agents, not a new dev-owned root-cause pattern.
- `handler.workflow_dispatched` and `metric.alert_judged` for alert 287: acted; latest triage recorded `document_exception` and committed project journal evidence as `ca7d4a69e`.
- `session.start` metric-alert-triage events: acted by the same alert judgment chain.
- May heartbeat nudge claiming high dev error rate: rechecked and dismissed for the current 6h window; dev shows `32` sessions and `0` errors, while the system metric `session.error-rate-6h=0.0779` is below threshold.

## Next Validation

Next metrics snapshot. Resume `finish-blocked-hygiene-reduction` immediately if `session.finish-blocked-unresolved-count-24h` breaches or if raw sampling exposes a fresh non-recovered dirty-exit source pattern.
