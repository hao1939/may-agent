# Metric alert 3695 — resolve_stale

## Judgment
Choose `resolve_stale`.

The alert was real briefly, but it was already recovered by the time this triage ran. The latest metric row is back in range (`current=0`, `threshold=0`), the alert row is resolved, and the only offender task now carries an explicit fallback contract in the live task tree.

## Evidence checked
- Metric `aks-rp-e2e.process.blocked.missing-fallback-count` currently reports `current=0`, `priority=P0`, `updated_at=1784050696065`.
- Alert row `3695` has `resolved_at=1784050702784`.
- Recent snapshots show the transient breach and recovery:
  - `1784050404662`: `value=1`, offender `focus-blocked-frontier-writeback-and-holder-normalization-20260714`
  - `1784050696065`: `value=0`, offenders `[]`
- Live task tree entry `.state/tasks/tree.json` for `focus-blocked-frontier-writeback-and-holder-normalization-20260714` now includes:
  - `next_check_at: 2026-07-14T17:47:49.296Z`
  - `fallback_at: 2026-07-15T17:37:49.296Z`
  - `fallback_action: If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence.`
  - `trace.blocked_contract_repaired_at: 2026-07-14T17:37:49.296Z`

## Theory
The breach came from a short-lived task-tree drift while the focus-plan blocker contract was being refreshed. Planner/app-ops repaired the missing fallback on the offending blocked focus task, and the next May metrics snapshot observed zero offenders and resolved the alert.

## Why this is not `fix_root_cause`
No additional runtime change was needed in this session: the safe fix had already landed in the live task tree before triage completed. The correct operator action now is to record that the alert is stale/transient rather than reopen or mutate runtime state again.

## Next validation
Accept the next `metrics-snapshot` that still reports `offenderTaskIds=[]` for `aks-rp-e2e.process.blocked.missing-fallback-count` as confirmation that the recovery held.
