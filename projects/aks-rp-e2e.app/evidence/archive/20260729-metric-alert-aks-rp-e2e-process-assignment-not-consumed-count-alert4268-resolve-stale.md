# Metric alert triage — resolve_stale — `aks-rp-e2e.process.assignment.not-consumed-count`

- Alert id: `4268`
- Metric id: `aks-rp-e2e.process.assignment.not-consumed-count`
- Judged at: `2026-07-29T16:09:43Z`
- Chosen operation: `resolve_stale`

## Judgment

Choose `resolve_stale` because the alert snapshot in the prompt is already out of date: the runtime metric row has recovered to `current=0`, the latest metric snapshot records `value=0` with an empty assignments list, and alert `4268` now has a non-null `resolved_at`. There is no live queued-assignment breach left for app-ops to fix or downgrade.

## Evidence checked

### Current metric row is back in range

Runtime `metrics` row for `aks-rp-e2e.process.assignment.not-consumed-count` now shows:

- `current = 0`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `owner = app-ops`
- `updated_at = 1785341534156`

### Latest persisted snapshot is healthy

Latest persisted snapshot now shows:

- `value = 0`
- `sample_size = 0`
- `measured_at = 1785341519149`
- `note = {"assignments":[]}`

### Fresh owner-side recompute agrees

Fresh recompute from the metric source command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.assignment.not-consumed-count --json
```

Observed result:

```json
{"measuredAt":1785341532440,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"assignments\":[]}"}
```

### The alert row is already resolved

Runtime `metric_alerts` row for alert `4268` now shows:

- `resolved_at = 1785341525435`
- `created_at = 1785340516214`

A matching recovery event also exists:

- `events.id = 4593016`
- `event_type = metric.recovered`
- `timestamp = 1785341525460`
- `source = agent:may`

## Why this is `resolve_stale`

The alert was real when sampled earlier, but by the time of this owner judgment the source of truth had already recovered and the alert row had already been auto-resolved by the runtime. That makes the triage payload stale rather than actionable. No additional fix, calibration, downgrade, or exception is warranted from app-ops in this session.

## Next validation signal

Validate on the next `metrics-snapshot` cycle.

Expected outcome:

- the metric remains `0` with `assignments: []`, and
- no new open `metric_alerts` row is created unless a future queued assignment truly outlives the start-grace window.
