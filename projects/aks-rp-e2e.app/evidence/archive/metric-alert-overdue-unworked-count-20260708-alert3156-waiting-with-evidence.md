# Metric alert triage — waiting_with_evidence — `aks-rp-e2e.process.blocked.overdue-unworked-count`

- Alert id: `3156`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Chosen operation: `waiting_with_evidence`
- Triage time: `2026-07-08T02:41:10Z`

## Current facts

- Runtime metric row still breaches at `current=1` with threshold `0` and target `0`.
- The latest two snapshots both identify the same sole offender task id: `hold-spec-loop-pending-windows-node-pool-create-reviewed-create-surface-20260707`.
- Project-local gap/status evidence shows the spec frontier is not abandoned overall: `path.secops-fips.kata-blocked` is currently `[ready]`, and the task tree now has an active exact owner task `execute-spec-secops-fips-kata-blocked-live-ready-carrier-20260708` for that ready carrier.
- The offender itself is a real blocked wait, not a measurement bug: it preserves the exact `spec.windows.node-pool-create` create-surface contradiction with preserved run `28432510189` stopping at managed-cluster create with HTTP 400 / `provisioningState=Unknown`.

## Concrete change made

I refreshed the offender task's blocked contract through task-tree tooling so the overdue wait is no longer a stale unattended hold:

- updated blocker condition text with fresh 2026-07-08 owner-review evidence,
- kept the exact resume condition,
- moved `next_check_at` to `2026-07-08T19:45:00Z`,
- moved `fallback_at` to `2026-07-09T13:45:00Z`.

## Why `waiting_with_evidence`

This is not `resolve_stale`: the metric still truthfully breaches right now and the latest snapshots still point at the same offender.

This is not `fix_root_cause`: app-ops cannot safely close the underlying Windows create-surface contradiction from process tooling alone, and there is already active domain progress elsewhere rather than total owner abandonment.

`waiting_with_evidence` is the truthful operation because the overdue wait remains a valid exact external/human-owned contradiction holder, and this session materially refreshed that holder's observation/fallback timing with current evidence instead of leaving a stale overdue contract in place.

## Next validation

Validate on the next `metrics-snapshot`. If the refreshed blocked contract is respected by the metric source, the offender should drop out once the overdue-window logic sees the renewed `next_check_at` / `fallback_at` state; otherwise planner review must escalate or replace the holder with a sharper recovery task.
