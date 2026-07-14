# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count` (alert 3623)

- Date: 2026-07-14
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Alert id: `3623`
- Owner: `app-ops`

## Judgment

This alert input is stale now.

The workflow payload said alert `3623` was still open with a `current=1` breach,
but the live runtime now shows the opposite: the metric row has already
recovered to `current=0`, there are no open alert rows for this metric, and the
specific alert row now has `resolved_at=1784014780659`.

That means there is no current blocked-wait-target defect left for app-ops to
repair in this session. The concrete state change already happened in the
runtime between the alert payload and this triage pass; the correct owner action
now is to record that this alert was already resolved by newer runtime state.

## Evidence checked

### 1) The workflow payload was behind current runtime state

Prompt payload for alert `3623` said:

- `message = "AKS RP E2E blocked tasks missing wait target is above threshold: current=1, threshold=0, target=0"`
- `resolved_at = null`
- recent offender snapshots named `ops/wait-project-approval-owner-return-primary-blocker-20260713`

### 2) The current metric row is already back in range

```sql
SELECT id, current, threshold, target, priority, project, status, updated_at, alert_op
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-waiting-for-count';
```

Observed result excerpt:

- `current = 0`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1784014767678`

### 3) The alert row is no longer open

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3623;
```

Observed result excerpt:

- `resolved_at = 1784014780659`
- same message text still records the earlier `current=1` breach sample

A direct open-alert check confirms there are no unresolved rows left for this metric:

```sql
SELECT *
FROM metric_alerts
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-waiting-for-count'
  AND resolved_at IS NULL;
```

Observed result: `0 rows`.

### 4) Recent snapshots show the metric already recovered

```sql
SELECT metric_id, value, sample_size, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-waiting-for-count'
ORDER BY measured_at DESC
LIMIT 10;
```

Observed result excerpt:

- `1784014767678` → `value=0`, `sample_size=0`, `note={"offenderTaskIds":[]}`
- `1784014482437` → `value=1`, offender `ops/wait-project-approval-owner-return-primary-blocker-20260713`
- `1784014156275` → `value=1`, offender `ops/wait-project-approval-owner-return-primary-blocker-20260713`
- earlier snapshots in the same window were already `0`

So the breach was transient and had already cleared before this triage session
finished.

### 5) Recent owner activity overlapped the recovery window

Recent `sessions` rows show an app-ops task-worker session for
`ops/reconcile-project-approval-primary-blocker-vs-focus-split-20260714`
finished at `1784014780204`, immediately before alert `3623` shows
`resolved_at=1784014780659`.

This is enough to conclude that newer app/runtime activity reconciled the
underlying state before this alert judgment completed, even though this triage
session does not need to claim authorship of that fix.

## Why this is `resolve_stale`

- The metric currently reads healthy (`current=0`).
- Alert `3623` is already resolved in `metric_alerts`.
- There is no remaining open alert row for this metric to fix, calibrate,
  downgrade, escalate, except, or wait on.
- The only truthful owner action left is to document that the original alert
  payload was stale by the time of judgment.

## Next validation

Next validation point: the next `metrics-snapshot` for
`aks-rp-e2e.process.blocked.missing-waiting-for-count` should continue to report
`value=0` with `offenderTaskIds=[]`.
