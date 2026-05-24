# project.missing-owner-workflow-count Metric Gap

## Signal

During the 2026-05-21 dev heartbeat, the active-metrics snapshot freshness check returned one active metric with no snapshot in the last hour:

- `project.missing-owner-workflow-count` — Active projects missing owner workflow

The metric row is active and owned by `may`, but has neither a `source_query` nor a `source_command`, so the snapshotter has no recipe to refresh it automatically.

## Evidence

Heartbeat query:

```sql
SELECT m.id, m.name
FROM metrics m
LEFT JOIN metric_snapshots ms
  ON m.id = ms.metric_id
 AND ms.measured_at > (unixepoch()*1000 - 3600000)
WHERE ms.metric_id IS NULL AND m.status='active';
```

Returned:

```text
project.missing-owner-workflow-count | Active projects missing owner workflow
```

Metric definition query:

```sql
SELECT id, name, owner, current, target, threshold, alert_op, source_query, source_command, updated_at
FROM metrics
WHERE id='project.missing-owner-workflow-count';
```

Returned `owner='may'`, `current=0`, `target=0`, `threshold=0`, `alert_op='>'`, and both `source_query` and `source_command` as `NULL`.

## Judgment

This is not a red dev-owned alert, but it is a metrics-engineering gap: an active metric without an automatic measurement recipe cannot be kept fresh by the metrics-snapshot handler. Because `query_db` is read-only and heartbeat sessions must not write metric rows directly, the safe action is to record the gap and hand it to the metric owner / runtime writer path.

## Proposed next action

May should either:

1. Register a `source_query`/`source_command` for `project.missing-owner-workflow-count`, if this metric should remain active; or
2. Mark the metric inactive/retired if it is obsolete.

A follow-up write should use the system's safe event/runtime path rather than direct DB writes from a heartbeat.
