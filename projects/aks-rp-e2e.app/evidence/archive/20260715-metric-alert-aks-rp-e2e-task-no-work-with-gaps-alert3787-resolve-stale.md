# Metric alert triage — resolve_stale — `aks-rp-e2e.task.no-work-with-gaps`

- Alert id: `3787`
- Metric id: `aks-rp-e2e.task.no-work-with-gaps`
- Triage time: `2026-07-15T08:04Z`
- Owner: `app-ops`
- Chosen operation: `resolve_stale`

## Judgment

The alert payload that started this triage was already stale by the time of
owner verification.

At triage time:

- the live metric row had recovered to `current=0`
- the alert row for `3787` had already been auto-resolved (`resolved_at`
  populated)
- the task frontier again had executable work (`aks-feature-compact-loop`
  runnable plus 17 active leaves)

That means there was no still-open alert row left for app-ops to fix, calibrate,
or escalate in this session. The concrete state change had already happened in
runtime before triage completed, so the correct owner action is to record this
as a stale/transient alert rather than pretend it is still live.

## Evidence checked

### Runtime metric state

`SELECT id, current, threshold, target, priority, status, updated_at, alert_op
FROM metrics WHERE id = 'aks-rp-e2e.task.no-work-with-gaps'`

Observed during triage:

- `current=0`
- `threshold=0`
- `target=0`
- `priority='P0'`
- `status='active'`
- `updated_at=1784101889269`

### Alert lifecycle state

`SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE metric_id = 'aks-rp-e2e.task.no-work-with-gaps'
ORDER BY created_at DESC LIMIT 5`

Observed during triage:

- alert `3787` existed for the same breach
- `resolved_at=1784102373597`
- the prompt copy saying `resolved_at=null` was therefore stale relative to the
  live runtime DB

### Recent snapshots

`SELECT value, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.task.no-work-with-gaps'
ORDER BY measured_at DESC LIMIT 10`

Observed latest series:

- `0` at `1784101889269`
- `1` at `1784101499622`
- `0` at `1784101186769`
- `1` at `1784100873582`

This confirms the alert was transient and had already fallen back in-range.

### Live owner-side measurement and frontier

`bun ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps --json`
returned:

```json
{"measuredAt":1784102611995,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

`bun run task-tree frontier aks-rp-e2e` showed:

- `runnable: ["aks-feature-compact-loop"]`
- `active:` 17 live tasks, including
  `ops/repair-compact-egress-lockdown-state-pointer-drift-20260715`
- `review:` includes `ops/repair-no-work-with-gaps-refill-20260715`, but review
  residue is not the only frontier because runnable/active work is already
  present

## Why this is `resolve_stale`

This session did not need to repair a currently-breaching empty frontier. The
prompted alert instance had already been resolved by runtime recovery before
triage completed. Treating it as still-open would be incorrect. Recording the
stale resolution is the truthful owner judgment for alert `3787`.

## Next validation

Watch the next `metrics-snapshot`. If the frontier stays non-empty, the metric
should remain at `0`; if the project drains back to review-only or blocked-only
state while verification gaps remain, a new alert instance should fire and must
be judged on its own evidence rather than by reusing this stale alert.
