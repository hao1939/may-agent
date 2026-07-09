# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` (alert 3202)

- Date: 2026-07-08
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Alert id: `3202`
- Owner: `app-ops`

## Judgment

This alert is stale in persisted runtime state, not a live blocked-observer defect.

The open alert row and `metrics.current` still show `1`, but a fresh direct recompute now returns `0` offenders, the supported blocked-contract repair dry-run reports `repairedCount = 0`, and the named offender task from the latest snapshot (`hold-compact-bootstrap-profile-cache-direct-cache-switch-pollarmoperation-timeout-frontier-20260708d`) is already `done` because the planner replaced that passive wait with an exact review successor.

## Evidence checked

### 1) Open alert row still exists

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3202;
```

Result excerpt:

- `id = 3202`
- `resolved_at = null`
- `message = AKS RP E2E blocked tasks missing observer is above threshold: current=1, threshold=0, target=0`

### 2) Metric row is still stale at `current = 1`

```sql
SELECT id, current, threshold, target, priority, project, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Result excerpt:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `project = aks-rp-e2e`

### 3) Latest stored snapshot named one offender

Recent snapshot excerpt:

```json
{"value":1,"sample_size":1,"measured_at":1783547446648,"measured_by":"agent:may","note":"{\"offenderTaskIds\":[\"hold-compact-bootstrap-profile-cache-direct-cache-switch-pollarmoperation-timeout-frontier-20260708d\"]}"}
```

### 4) Fresh authoritative recompute now returns zero offenders

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{"measuredAt":1783547705388,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

### 5) Supported blocked-contract repair finds nothing left to fix

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result excerpt:

- `repairedCount = 0`
- `treePath = /app/projects/aks-rp-e2e.app/.state/tasks/tree.json`

### 6) The named offender task is already replaced/done

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show hold-compact-bootstrap-profile-cache-direct-cache-switch-pollarmoperation-timeout-frontier-20260708d
```

Observed result excerpt:

- `state = done`
- `status = done`
- `resolution = replaced`
- `review_summary = The wait is no longer a live passive holder because run 171365996 is terminal; its meaning is now preserved by the exact artifact-review successor review-compact-bootstrap-profile-cache-direct-cache-switch-ado171365996-20260708...`

## Why this is `resolve_stale`

- The current authoritative metric source of truth is in range.
- The repair path shows no current missing-observer metadata left to backfill.
- The snapshot-named offender is no longer a live blocked task.
- The alert lifecycle is lagging a state change already applied by the planner/runtime tree.

This session does not have a safe runtime write path to edit `metric_alerts` directly, so the durable owner action here is to record the stale-state judgment and let the next metric snapshot / alert refresh converge persisted state automatically.

## Next validation

On the next `metrics-snapshot` / alert refresh for `aks-rp-e2e.process.blocked.missing-observer-count`, expect:

- recomputed value remains `0`
- `offenderTaskIds = []`
- alert `3202` to recover automatically
