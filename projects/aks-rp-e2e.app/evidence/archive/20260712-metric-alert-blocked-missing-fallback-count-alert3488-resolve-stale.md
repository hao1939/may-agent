# Metric alert triage: `aks-rp-e2e.process.blocked.missing-fallback-count` alert 3488

## Decision

Chosen operation: `resolve_stale`

## Why

The alert was real at sample time but is already recovered in the authoritative metric stream.

- metric `aks-rp-e2e.process.blocked.missing-fallback-count`
- breach snapshot at `1783895856262`: `value=3`, `sample_size=3`
- breach offender task ids:
  - `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
  - `focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711`
  - `ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized`
- alert `3488` created at `1783895861925`

By the latest persisted metric refresh, the metric had already returned to in-range and the alert auto-resolved:

- latest snapshot at `1783896163423`: `value=0`, `sample_size=0`, `note={"offenderTaskIds":[]}`
- metric row now shows `current=0`, `threshold=0`, `target=0`, `priority=P0`
- alert `3488` now has `resolved_at = 1783896169467`

## Additional runtime confirmation

The three named tasks still exist in the runtime tree, but their blockers now include the previously missing fallback contract fields:

- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
  - `blocker.fallback_at = 2026-07-13T22:38:45.688Z`
  - `blocker.fallback_action = If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence.`
- `focus-rp-lifecycle-no-live-authoring-and-exact-wait-stewardship-20260711`
  - `blocker.fallback_at = 2026-07-13T22:38:45.688Z`
  - `blocker.fallback_action = If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence.`
- `ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized`
  - `blocker.fallback_at = 2026-07-13T22:38:45.688Z`
  - `blocker.fallback_action = If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence.`

## Judgment

This is not a still-breaching P0 process gap. The source state has already been repaired by the time of triage, the persisted metric is back to `0`, and the alert lifecycle has already closed normally. That makes `resolve_stale` the smallest truthful final operation.

## Next validation

- On the next `metrics-snapshot`, expect `aks-rp-e2e.process.blocked.missing-fallback-count` to remain `0` with `offenderTaskIds=[]`.
- If the metric rises above `0` again, treat the new offender ids as a fresh blocked-contract regression rather than reopening alert `3488`.
