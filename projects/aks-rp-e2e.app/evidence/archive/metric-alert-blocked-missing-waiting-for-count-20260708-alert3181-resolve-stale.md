# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count` (alert 3181)

- Decision: `resolve_stale`
- Alert id: `3181`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Triaged at: `2026-07-08T18:00Z`

## Why this is stale instead of a live blocker defect

The persisted alert row is still open from a sample at `1783533364899` with:

```json
{"offenderTaskIds":["hold-spec-loop-pending-bootstrap-profile-byo-acr-contradiction-20260704"]}
```

But a fresh owner-side recompute now returns:

```json
{"measuredAt":1783533851050,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

So the current runtime-authoritative metric is already back in range.

## Current runtime readback of the named offender

`bun run task-tree show hold-spec-loop-pending-bootstrap-profile-byo-acr-contradiction-20260704` now shows the blocked holder already has the required blocked-wait contract:

- `state = blocked`
- `blocker.waiting_for.type = environment.available`
- `blocker.waiting_for.taskId = hold-spec-loop-pending-bootstrap-profile-byo-acr-contradiction-20260704`
- `trace.blocked_contract_repaired_at = 2026-07-08T18:01:38.139Z`

That means the exact task named by the stale snapshot is no longer missing `blocker.waiting_for`.

## DB state checked

At triage time the persisted runtime DB still showed the old breach lifecycle state:

- `metrics.current = 1`
- `metrics.updated_at = 1783533364899`
- `metric_alerts.id = 3181`
- `metric_alerts.resolved_at = null`

This contradicts the newer direct recompute (`value = 0`). In this workflow I only have read-only DB access, so I cannot manually resolve the alert row. The truthful operation is therefore to document that alert `3181` is stale/already recovered and let the next metrics refresh / alert recovery path converge the persisted state.

## Next validation

Watch the next `metrics-snapshot` / alert refresh cycle. Recovery is confirmed when:

- `metrics.current` for `aks-rp-e2e.process.blocked.missing-waiting-for-count` updates to `0`, and
- alert `3181` gains a non-null `resolved_at`.
