# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3109`

- Operation: `waiting_with_evidence`
- Judged by: `app-ops`
- Judged at: `2026-07-08T02:41Z`

## Decision

Choose `waiting_with_evidence` because the metric has already recovered in the runtime source of truth, but the alert lifecycle has not reconciled yet.

This is **not** a live blocked-observer defect right now:

- the persisted metric row now shows `current = 0`
- the latest metric snapshot now shows `value = 0`
- a fresh owner-side recompute now returns `value = 0`
- the open alert row `3109` is still unresolved and still carries the older breach message `current=1`

That means the remaining work is to wait for the next runtime alert recovery / metrics refresh path to reconcile the stale open alert row with the already-recovered metric state.

## Evidence checked

### 1) Metric row has recovered

```sql
SELECT id, current, threshold, target, priority, status, updated_at, blocker, project, owner
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Result at triage time:

- `current = 0`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `owner = app-ops`

### 2) Latest snapshot has recovered

```sql
SELECT value, sample_size, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-observer-count'
ORDER BY measured_at DESC
LIMIT 10;
```

Latest row at triage time:

- `value = 0`
- `sample_size = 0`
- `measured_by = agent:may`
- `note = {"offenderTaskIds":[]}`

The immediately previous row was the breach:

- `value = 1`
- `note = {"offenderTaskIds":["wait-spec-cluster-autoscaler-mincount-recovery-rerun-171349474-return-20260708"]}`

### 3) Fresh owner-side recompute also returns zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Result:

```json
{"measuredAt":1783505373928,"value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

### 4) Alert row is still open and stale relative to current metric state

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-observer-count'
  AND resolved_at IS NULL
ORDER BY created_at DESC;
```

Open row at triage time:

- `id = 3109`
- `resolved_at = null`
- `message = AKS RP E2E blocked tasks missing observer is above threshold: current=1, threshold=0, target=0`

So the open alert row still reflects the old breach even though both the metric row and the latest snapshot now show recovery.

## Why this is not `fix_root_cause`

I did not find a remaining live blocked-task observer-contract defect to repair in this session. The current measurement surfaces already agree on `0`, so the truthful next step is to wait for alert lifecycle reconciliation rather than claim a new runtime repair.

## Why this is not `resolve_stale`

The stale condition is real, but this workflow only provides read-only DB access. I cannot safely mutate `metric_alerts.resolved_at` directly from this session. The supported action available here is to record the judgment and wait for the normal recovery path.

## Next validation

Validate on the next `metrics-snapshot` / alert-recovery cycle after `2026-07-08T02:49:33Z`. Recovery is confirmed when alert `3109` gains `resolved_at` or disappears from the open-alert query while the metric remains at `current = 0`.
