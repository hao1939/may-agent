# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` (alert 3200)

- Date: 2026-07-08
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Alert id: `3200`
- Owner: `app-ops`

## Judgment

This alert is stale in persisted runtime state, not a live missing-observer defect.

The open alert row and `metrics.current` still show `1`, but a fresh direct recompute now returns `0` offenders, and the named offender task already carries the required observer contract fields: `observed_by`, `observation_method`, and `next_check_at`.

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

- `id = 3200`
- `resolved_at = null`
- `message = AKS RP E2E blocked tasks missing observer is above threshold: current=1, threshold=0, target=0`

### 2) Metric row is still stale at `current = 1`

```sql
SELECT id, current, threshold, target, priority, status, updated_at, blocker, project
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Result excerpt:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`

### 3) Latest stored snapshot named one offender

Newest stored snapshot excerpt from the alert packet:

```json
{"value":1,"sample_size":1,"measured_at":1783546518548,"measured_by":"agent:may","note":"{\"offenderTaskIds\":[\"hold-compact-bootstrap-profile-cache-direct-cache-switch-pollarmoperation-timeout-frontier-20260708c\"]}"}
```

### 4) Fresh recompute now returns zero offenders

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{"measuredAt":1783546694815,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

### 5) The named task already has the required observer contract

Task excerpt for `hold-compact-bootstrap-profile-cache-direct-cache-switch-pollarmoperation-timeout-frontier-20260708c`:

```json
"blocker": {
  "owner": "human",
  "waiting_for": {
    "type": "environment.available",
    "taskId": "hold-compact-bootstrap-profile-cache-direct-cache-switch-pollarmoperation-timeout-frontier-20260708c",
    "sourceRunId": "171365996"
  },
  "next_check_at": "2026-07-09T21:31:29.521Z",
  "observed_by": {
    "workflow": "project-planner",
    "schedule": "blocked-frontier-app-ops-review",
    "trigger": "project.planning.requested"
  },
  "observation_method": "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence."
}
```

### 6) Why `repair-blocked-contracts --dry-run` did not change this judgment

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result excerpt:

- `repairedCount = 1`
- `repaired = ["hold-compact-bootstrap-profile-cache-direct-cache-switch-pollarmoperation-timeout-frontier-20260708c"]`

This does **not** prove a missing-observer defect. The repair tool backfills the full blocked contract (`waiting_for`, observer fields, `owner`, and fallback fields). Its dry-run can still report a repairable task when some non-observer field is missing or normalizable. The metric under triage only counts missing `observed_by`, `observation_method`, or `next_check_at`, and the live recompute already returns `0` for those fields.

## Why this is `resolve_stale`

- The current authoritative metric source of truth is in range.
- The previously named offender already satisfies the observer-specific contract.
- The open alert lifecycle is lagging behind current runtime state.
- This workflow has no safe runtime write path to edit `metric_alerts` directly, so the durable owner action here is to record the stale-state judgment and let the next metric snapshot / alert refresh converge runtime state.

## Next validation

On the next `metrics-snapshot` / alert refresh for `aks-rp-e2e.process.blocked.missing-observer-count`, expect:

- recomputed value remains `0`
- `offenderTaskIds = []`
- alert `3200` to recover automatically
