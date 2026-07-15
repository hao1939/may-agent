# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` (alert 3694)

- Date: 2026-07-14
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Alert id: `3694`
- Owner: `app-ops`

## Judgment

This alert instance is stale relative to current runtime state and already recovered through the supported metric lifecycle before this triage completed.

The prompt payload showed alert `3694` still open with `current=1`, but the authoritative runtime DB now shows the metric row back at `current=0`, the alert row already has `resolved_at=1784050702784`, and the latest snapshot at `1784050693998` reports `offenderTaskIds=[]`.

The brief breach was real: the prior snapshot at `1784050402260` named one offender, `focus-blocked-frontier-writeback-and-holder-normalization-20260714`. Current task-tree state for that focus plan now includes a complete blocked observer contract (`observed_by`, `observation_method`, `next_check_at`, and `fallback_action`), and a fresh live recompute also returns `value=0`.

Because there is no longer a live missing-observer defect to repair and the alert row has already auto-resolved, the correct final operation for this alert instance is `resolve_stale`.

## Evidence checked

### 1) Runtime DB now shows the metric healthy

```sql
SELECT id, current, threshold, target, priority, status, updated_at, alert_op, project, owner
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Result excerpt:

- `current = 0`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1784050693998`
- `owner = app-ops`

### 2) Alert 3694 is already resolved

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3694;
```

Result excerpt:

- `message = "AKS RP E2E blocked tasks missing observer is above threshold: current=1, threshold=0, target=0"`
- `resolved_at = 1784050702784`
- `created_at = 1784050411778`

### 3) Recent snapshots show a single transient spike that decayed to zero

```sql
SELECT value, sample_size, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-observer-count'
ORDER BY measured_at DESC
LIMIT 10;
```

Key rows:

- latest sample at `1784050693998` = `0`, offenders `[]`
- prior sample at `1784050402260` = `1`, offender `focus-blocked-frontier-writeback-and-holder-normalization-20260714`
- all earlier samples in the same window were already `0`

### 4) Fresh live recompute is healthy now

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{"measuredAt":1784050709181,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

### 5) The formerly offending focus task currently carries the required observer fields

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show focus-blocked-frontier-writeback-and-holder-normalization-20260714
```

Observed result excerpt from `blocker`:

- `waiting_for.type = "project.approval.submitted"`
- non-empty `observed_by`
- non-empty `observation_method`
- `next_check_at = "2026-07-14T17:47:49.296Z"`
- non-empty `fallback_action`

## Why this is `resolve_stale`

- The source-of-truth metric row is already back in range.
- The alert row itself is no longer open.
- A fresh live recompute agrees with the persisted healthy state.
- The named offending task currently has the observer contract fields this metric requires.
- No additional safe owner repair remains for this specific alert instance.

## Next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.blocked.missing-observer-count`. Expected result: the metric remains `0` with `offenderTaskIds=[]`; any future nonzero sample should be treated as a new breach, not unfinished work from alert `3694`.
