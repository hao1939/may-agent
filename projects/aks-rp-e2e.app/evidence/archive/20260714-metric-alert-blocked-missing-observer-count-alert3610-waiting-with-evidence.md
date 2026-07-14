# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` — alert `3610`

- Date: 2026-07-14
- Owner: `app-ops`
- Final operation: `waiting_with_evidence`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Alert id: `3610`

## Why this is the right operation

The alert row is now lagging behind the source of truth. A fresh persisted metric
sample already moved the metric row back to `current=0`, and a direct live
recompute of the runtime task tree also returns `value=0`. The specific task
named by the earlier offender snapshot now carries `observed_by`,
`observation_method`, and `next_check_at`, and the supported blocked-contract
repair dry run finds nothing left to repair.

That means there is no current live missing-observer defect for app-ops to fix
safely in this session. Because this triage environment has only read-only DB
access, I cannot directly resolve the stale open `metric_alerts` row. The
truthful final operation is therefore `waiting_with_evidence`: record that the
metric has already recovered and wait for the next alert lifecycle refresh to
close alert `3610` automatically.

## Evidence checked

### 1) The persisted metric row has already recovered

`query_db`:

```sql
SELECT id, current, threshold, target, priority, project, status, updated_at, alert_op
FROM metrics
WHERE id = 'aks-rp-e2e.process.blocked.missing-observer-count';
```

Returned:

- `current = 0`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1784009835672`

### 2) The alert row is still open even though the metric row recovered

`query_db`:

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE metric_id = 'aks-rp-e2e.process.blocked.missing-observer-count'
  AND resolved_at IS NULL
ORDER BY created_at DESC
LIMIT 5;
```

Returned one unresolved row:

- `id = 3610`
- `resolved_at = null`
- message still says `current=1, threshold=0, target=0`

So the alert row is stale relative to the latest metric state.

### 3) Latest snapshots show the breach recovered after the offender spike

Latest `metric_snapshots` rows:

- `1784009835672` → `value=0`, `sample_size=0`, offenders `[]`
- `1784009192516` → `value=1`, `sample_size=1`, offender `ops/wait-project-approval-owner-return-primary-blocker-20260713`
- `1784008887840` → `value=0`, `sample_size=0`, offenders `[]`
- `1784008587250` → `value=1`, `sample_size=1`, offender `ops/wait-project-approval-owner-return-primary-blocker-20260713`

This is an oscillating one-task breach that has already fallen back to zero.

### 4) Fresh live recompute is healthy now

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Returned:

```json
{"measuredAt":1784009820739,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

So both the persisted row and the live recompute now agree that the metric is healthy.

### 5) The prior offender task currently has observer metadata present

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree show ops/wait-project-approval-owner-return-primary-blocker-20260713
```

Current blocker fields include:

- `waiting_for.type = project.approval.submitted`
- `observed_by = { "workflow": "project-planner", "trigger": "project.approval.submitted" }`
- non-empty `observation_method`
- `next_check_at = 2026-07-14T22:00:00Z`
- `fallback_at = 2026-07-15T04:00:00Z`

### 6) Supported blocked-contract repair finds nothing left to repair

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Returned:

- `repairedCount = 0`
- `repaired = []`

So there is no remaining owner-actionable blocked-contract repair to apply.

## Judgment

Choose **`waiting_with_evidence`**.

Why not the other final operations:

- Not `fix_root_cause`: there is no live missing-observer defect left to fix.
- Not `calibrate_metric`: the metric rule still correctly detected a real missing-observer spike.
- Not `downgrade_priority`: the stale row should recover automatically; priority policy does not need changing.
- Not `upgrade_or_escalate`: no destructive or human policy decision is required.
- Not `resolve_stale`: that would require a safe runtime write path to resolve the stale alert row directly, which this environment does not provide.
- Not `document_exception`: the breach is not an accepted ongoing exception.

## Next validation

Wait for the next `metrics-snapshot` / alert refresh cycle for
`aks-rp-e2e.process.blocked.missing-observer-count`.

Recovery is confirmed when:

1. `metrics.current` remains `0` on the next snapshot, and
2. alert `3610` is resolved automatically.
