# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count` (alert 3195)

- Date: 2026-07-08
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Alert id: `3195`
- Owner: `app-ops`

## Judgment

The alert is stale. The open alert row and `metrics.current` still show `1`, but a fresh direct recompute of the metric now returns `0`, and the named offender task already carries a valid `blocker.waiting_for` object.

## Evidence checked

### 1) Open alert row still exists

```sql
SELECT id, message, resolved_at, created_at
FROM metric_alerts
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-waiting-for-count'
ORDER BY created_at DESC
LIMIT 5;
```

Result excerpt:

- `id = 3195`
- `resolved_at = null`
- `message = AKS RP E2E blocked tasks missing wait target is above threshold: current=1, threshold=0, target=0`

### 2) Metric row is still stale at `current = 1`

```sql
SELECT id, current, threshold, target, priority, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-waiting-for-count';
```

Result excerpt:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`

### 3) Latest stored snapshot that triggered the alert named one offender

```sql
SELECT value, sample_size, measured_at, note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-waiting-for-count'
ORDER BY measured_at DESC
LIMIT 10;
```

Newest stored snapshot excerpt:

```json
{"value":1,"sample_size":1,"note":"{\"offenderTaskIds\":[\"hold-compact-bootstrap-profile-cache-direct-cache-switch-pollarmoperation-timeout-frontier-20260708\"]}"}
```

### 4) The named task already has a real wait target

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show hold-compact-bootstrap-profile-cache-direct-cache-switch-pollarmoperation-timeout-frontier-20260708
```

Result excerpt:

```json
"blocker": {
  "condition": "Blocked on the exact compact bootstrap-profile BYO ACR cache-direct-cache-switch live-workflow timeout frontier...",
  "category": "external-wait",
  "owner": "aks-explorer",
  "waiting_for": {
    "type": "environment.available",
    "taskId": "hold-compact-bootstrap-profile-cache-direct-cache-switch-pollarmoperation-timeout-frontier-20260708",
    "sourceRunId": "171365996"
  },
  "observed_by": {
    "workflow": "project-planner",
    "schedule": "blocked-frontier-app-ops-review",
    "trigger": "project.planning.requested"
  },
  "next_check_at": "2026-07-08T21:31:29.521Z",
  "fallback_at": "2026-07-09T21:21:29.521Z"
}
```

### 5) Fresh recompute now returns zero offenders

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json --verbose
```

Result:

```json
{"measuredAt":1783545743841,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Why this is `resolve_stale`

- The current task-tree state no longer breaches the metric.
- The previously named offender already satisfies the blocked wait contract.
- The open alert lifecycle is lagging behind current reality.
- This session has no safe runtime write path to modify `metric_alerts` directly, so the durable action here is to record the stale-state judgment and wait for the next metric snapshot / alert refresh to converge runtime state.

## Next validation

On the next `metrics-snapshot` / alert refresh for `aks-rp-e2e.process.blocked.missing-waiting-for-count`, expect:

- recomputed value remains `0`
- `offenderTaskIds = []`
- alert `3195` to recover automatically
