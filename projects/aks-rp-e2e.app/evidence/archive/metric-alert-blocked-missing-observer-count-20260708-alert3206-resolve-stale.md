# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` (alert 3206)

- Date: 2026-07-08
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Alert id: `3206`
- Owner: `app-ops`

## Judgment

This alert is stale in persisted runtime state, not a live missing-observer defect.

The open alert row and `metrics.current` still show `1`, but two fresh authoritative recomputes now return `0` offenders, and the only task named by the latest stored snapshot (`hold-compact-bootstrap-profile-cache-direct-cache-switch-arm-timeout-frontier-20260708g`) already carries the required observer contract fields: `observed_by`, `observation_method`, and `next_check_at`.

## Evidence checked

### 1) Open alert row still exists

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-observer-count'
  AND resolved_at IS NULL
ORDER BY created_at DESC
LIMIT 5;
```

Result excerpt:

- `id = 3206`
- `resolved_at = null`
- `message = AKS RP E2E blocked tasks missing observer is above threshold: current=1, threshold=0, target=0`

### 2) Metric row is still stale at `current = 1`

```sql
SELECT id, current, threshold, target, priority, status, project, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Result excerpt:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `project = aks-rp-e2e`

### 3) Latest stored snapshot named one offender

Stored snapshot excerpt:

```json
{"value":1,"sample_size":1,"measured_at":1783549652343,"measured_by":"agent:may","note":"{\"offenderTaskIds\":[\"hold-compact-bootstrap-profile-cache-direct-cache-switch-arm-timeout-frontier-20260708g\"]}"}
```

### 4) Fresh authoritative recomputes now return zero offenders

Commands:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed results:

```json
{"measuredAt":1783549841399,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
{"measuredAt":1783549866767,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

### 5) The named offender task already has the required observer contract

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts show hold-compact-bootstrap-profile-cache-direct-cache-switch-arm-timeout-frontier-20260708g
```

Observed blocker excerpt:

```json
"blocker": {
  "owner": "human",
  "next_check_at": "2026-07-09T22:30:00Z",
  "waiting_for": {
    "type": "environment.available",
    "taskId": "hold-compact-bootstrap-profile-cache-direct-cache-switch-arm-timeout-frontier-20260708g",
    "sourceRunId": "171365996"
  },
  "observed_by": {
    "workflow": "project-planner",
    "schedule": "blocked-frontier-app-ops-review",
    "trigger": "project.planning.requested"
  },
  "observation_method": "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence."
}
```

## Why this is `resolve_stale`

- The current authoritative metric source of truth is in range.
- The snapshot-named offender already satisfies the observer-specific blocked contract.
- The persisted alert lifecycle and `metrics.current` are lagging behind current runtime state.
- This session has no safe runtime write path to edit `metric_alerts` directly, so the durable owner action here is to record the stale-state judgment and let the next metric snapshot / alert refresh converge persisted state automatically.

## Next validation

On the next `metrics-snapshot` / alert refresh for `aks-rp-e2e.process.blocked.missing-observer-count`, expect:

- recomputed value remains `0`
- `offenderTaskIds = []`
- alert `3206` to recover automatically
