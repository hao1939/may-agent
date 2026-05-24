# project.missing-owner-workflow-count unmeasured

## Signal

During the 2026-05-21 dev heartbeat, the active-metrics snapshot freshness check returned one active metric without a snapshot in the last hour:

- `project.missing-owner-workflow-count` (`Project missing owner/workflow count`)

The metric row is active and owned by `may`, but has no `source_query` or `source_command`, so the metrics-snapshot handler has no measurement recipe to run.

## Evidence

- `query_db` unmeasured active metrics check returned `rowCount=1` with `id='project.missing-owner-workflow-count'`.
- Metric inspection returned `owner='may'`, `status='active'`, `source_query=NULL`, `source_command=NULL`, `current=0`, `updated_at=1779256304421`.
- A direct projects-table reality check returned zero active projects missing owner or workflow:

```sql
SELECT id, path, name, owner, status, workflow
FROM projects
WHERE status='active'
  AND (owner IS NULL OR trim(owner)='' OR workflow IS NULL OR trim(workflow)='')
ORDER BY updated_at DESC
LIMIT 20;
```

Result: `rowCount=0`.

## Root Cause

The metric is active but structurally unmeasurable because it lacks both measurement fields. This is a metric-definition issue, not evidence of current project data drift.

## Proposed Fix

Have the metric owner register a safe `source_query` equivalent to:

```sql
SELECT COUNT(*) AS value
FROM projects
WHERE status='active'
  AND (owner IS NULL OR trim(owner)='' OR workflow IS NULL OR trim(workflow)='');
```

Because `query_db` is read-only and metric registration is a runtime write, this heartbeat only records the finding. A future approved/dev task or May-owned metric maintenance pass should apply the metric definition safely.

## Disposition

No project was created: this is a one-metric maintenance gap with a clear owner (`may`) and no current project-data mismatch. Continue monitoring the unmeasured-metrics check; if this remains stale or spreads to multiple metrics, promote to an approved metric hygiene task.
