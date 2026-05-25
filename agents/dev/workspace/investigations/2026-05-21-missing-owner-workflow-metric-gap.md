# project.missing-owner-workflow-count measurement gap

## Signal

During the 2026-05-21 dev heartbeat, the standard unmeasured-active-metrics query returned exactly one row:

- `project.missing-owner-workflow-count` (`Active projects missing owner workflow`)

A direct metric lookup showed:

- owner: `may`
- current: `0`
- target: `0`
- threshold: `0`
- alert_op: `>`
- source_query: `NULL`
- source_command: `NULL`
- updated_at: `1779256304421`

## Judgment

This is not an active dev-owned outage: the metric is May-owned, currently green at `0`, and there are no unresolved dev-owned metric alerts. However, it is a durable measurement gap because an active metric with no `source_query` or `source_command` cannot be refreshed by the snapshot handler, so its green value may become stale.

## Requested follow-up

Route to May/system-operations owner judgment:

1. Either attach a valid `source_query`/`source_command` for `project.missing-owner-workflow-count`, or
2. Mark/close the metric if it is obsolete, or
3. Document why it is intentionally manual and exempt it from the unmeasured-active metric check.

## Validation path

After owner action, rerun:

```sql
SELECT m.id, m.name
FROM metrics m
LEFT JOIN metric_snapshots ms
  ON m.id = ms.metric_id
 AND ms.measured_at > (unixepoch()*1000 - 3600000)
WHERE ms.metric_id IS NULL AND m.status='active';
```

Expected result: `project.missing-owner-workflow-count` is absent, or a documented exception exists.
