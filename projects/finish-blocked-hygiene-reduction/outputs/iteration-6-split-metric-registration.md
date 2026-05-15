# Iteration 6 — Split metric registration packet

Date: 2026-05-09
Owner: dev

## Outcome

I did **not** register the two metrics from this worker session because the available runtime access in this task is read-only:

- `query_db` allows only `SELECT`, `WITH`, and read-only `PRAGMA` statements.
- The task explicitly forbids opening the runtime DB read-write from bash.
- I found no agent-side runtime event/write tool in the available toolset for inserting rows into `metrics`.

This artifact is therefore the approval/ops packet for May/human execution. It includes the exact metric rows, validation queries, and current measured values proving the snapshotter can measure both SQL sources once the rows exist.

## Runtime mechanism verified

`agents/shared/may-agent-docs/metrics.md` documents custom metrics as rows in `metrics` with `source_query` or `source_command`.

`agents/may/handlers/metrics-snapshot.ts` confirms the generic measurement loop:

```ts
const measurable = db.prepare(
  "SELECT id, source_query, source_command FROM metrics WHERE status = 'active' AND (source_query IS NOT NULL OR source_command IS NOT NULL)"
).all() as any[];

for (const m of measurable) {
  let value: number | null = null;
  if (m.source_query) {
    const row = db.prepare(m.source_query).get() as any;
    if (row) {
      const vals = Object.values(row).filter(v => typeof v === "number");
      if (vals.length > 0) value = vals[0] as number;
    }
  }
  if (value !== null) { record(m.id, value); measured++; }
}
```

Implication: each `source_query` below returns one numeric `value` column, so the generic loop will record it via `record(metric_id, value)`.

## Current DB state

Read-only verification found the split metrics are still absent:

```sql
SELECT COUNT(*) AS existing_split_metric_rows
FROM metrics
WHERE id IN (
  'session.finish-blocked-uncommitted-count-24h',
  'session.finish-blocked-unresolved-count-24h'
);
```

Current result:

| existing_split_metric_rows |
|---:|
| 0 |

## Current source-query values

The two proposed source queries were executed read-only and returned:

| metric_id | value |
|---|---:|
| `session.finish-blocked-uncommitted-count-24h` | 208 |
| `session.finish-blocked-unresolved-count-24h` | 3 |

Validation query used:

```sql
WITH latest_digest AS (
  SELECT sd.*
  FROM session_digests sd
  JOIN (
    SELECT sessionId, MAX(created_at) AS max_created_at
    FROM session_digests
    GROUP BY sessionId
  ) m ON m.sessionId = sd.sessionId AND m.max_created_at = sd.created_at
), values_now AS (
  SELECT 'session.finish-blocked-uncommitted-count-24h' AS metric_id,
         COUNT(*) AS value
  FROM evaluations e
  WHERE e.createdAt >= (unixepoch('now') * 1000 - 86400000)
    AND e.issues LIKE '%finish blocked by uncommitted changes%'
  UNION ALL
  SELECT 'session.finish-blocked-unresolved-count-24h' AS metric_id,
         COUNT(*) AS value
  FROM evaluations e
  JOIN sessions s ON s.sessionId = e.sessionId
  LEFT JOIN latest_digest ld ON ld.sessionId = e.sessionId
  WHERE e.createdAt >= (unixepoch('now') * 1000 - 86400000)
    AND e.issues LIKE '%finish blocked by uncommitted changes%'
    AND e.issues NOT LIKE '%review override:%'
    AND e.issues NOT LIKE '%anti-shallow gate not satisfied%'
    AND NOT (
      COALESCE(ld.action, '') = 'nothing'
      AND COALESCE(ld.action_reason, '') LIKE '%No recoverable work worth resuming%'
    )
    AND (
      s.status != 'done'
      OR s.outcome != 'done'
      OR COALESCE(ld.outcome, 'no_digest') NOT IN ('success', 'partial')
    )
)
SELECT * FROM values_now ORDER BY metric_id;
```

## Exact registration SQL for May/human execution

Use the runtime DB writer path, not a second ad-hoc sqlite writer if that would race the in-process connection. The statements are idempotent and update the metric definition if a row appears between this packet and execution.

### 1. Raw finish-block friction count

```sql
INSERT INTO metrics (
  id, name, type, owner, current, target, threshold, unit, priority, status,
  project, source, source_query, source_command, sensitivity, measure_interval,
  created_at, updated_at, closed_at, alert_op, speed, description, direction
) VALUES (
  'session.finish-blocked-uncommitted-count-24h',
  'Finish blocked by uncommitted changes (24h raw)',
  'gauge',
  'dev',
  NULL,
  0,
  50,
  'count',
  'P2',
  'active',
  'finish-blocked-hygiene-reduction',
  'source_query',
  'SELECT COUNT(*) AS value
FROM evaluations e
WHERE e.createdAt >= (unixepoch(''now'') * 1000 - 86400000)
  AND e.issues LIKE ''%finish blocked by uncommitted changes%''',
  NULL,
  NULL,
  NULL,
  unixepoch('now') * 1000,
  unixepoch('now') * 1000,
  NULL,
  '>',
  'fast',
  'Raw count of evaluator rows in the last 24h whose issues include finish blocked by uncommitted changes. This measures operational friction, not necessarily unresolved dirty exits.',
  'down'
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  type = excluded.type,
  owner = excluded.owner,
  target = excluded.target,
  threshold = excluded.threshold,
  unit = excluded.unit,
  priority = excluded.priority,
  status = excluded.status,
  project = excluded.project,
  source = excluded.source,
  source_query = excluded.source_query,
  source_command = excluded.source_command,
  updated_at = excluded.updated_at,
  alert_op = excluded.alert_op,
  speed = excluded.speed,
  description = excluded.description,
  direction = excluded.direction;
```

### 2. Strict unresolved dirty-exit count

```sql
INSERT INTO metrics (
  id, name, type, owner, current, target, threshold, unit, priority, status,
  project, source, source_query, source_command, sensitivity, measure_interval,
  created_at, updated_at, closed_at, alert_op, speed, description, direction
) VALUES (
  'session.finish-blocked-unresolved-count-24h',
  'Unresolved finish-blocked dirty exits (24h strict)',
  'health',
  'dev',
  NULL,
  0,
  0,
  'count',
  'P1',
  'active',
  'finish-blocked-hygiene-reduction',
  'source_query',
  'WITH latest_digest AS (
  SELECT sd.*
  FROM session_digests sd
  JOIN (
    SELECT sessionId, MAX(created_at) AS max_created_at
    FROM session_digests
    GROUP BY sessionId
  ) m ON m.sessionId = sd.sessionId AND m.max_created_at = sd.created_at
)
SELECT COUNT(*) AS value
FROM evaluations e
JOIN sessions s ON s.sessionId = e.sessionId
LEFT JOIN latest_digest ld ON ld.sessionId = e.sessionId
WHERE e.createdAt >= (unixepoch(''now'') * 1000 - 86400000)
  AND e.issues LIKE ''%finish blocked by uncommitted changes%''
  AND e.issues NOT LIKE ''%review override:%''
  AND e.issues NOT LIKE ''%anti-shallow gate not satisfied%''
  AND NOT (
    COALESCE(ld.action, '''') = ''nothing''
    AND COALESCE(ld.action_reason, '''') LIKE ''%No recoverable work worth resuming%''
  )
  AND (
    s.status != ''done''
    OR s.outcome != ''done''
    OR COALESCE(ld.outcome, ''no_digest'') NOT IN (''success'', ''partial'')
  )',
  NULL,
  NULL,
  NULL,
  unixepoch('now') * 1000,
  unixepoch('now') * 1000,
  NULL,
  '>',
  'fast',
  'Strict count of finish-blocked evaluations in the last 24h that exclude review overrides and anti-shallow penalties and require terminal non-done state or latest digest not success/partial.',
  'down'
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  type = excluded.type,
  owner = excluded.owner,
  target = excluded.target,
  threshold = excluded.threshold,
  unit = excluded.unit,
  priority = excluded.priority,
  status = excluded.status,
  project = excluded.project,
  source = excluded.source,
  source_query = excluded.source_query,
  source_command = excluded.source_command,
  updated_at = excluded.updated_at,
  alert_op = excluded.alert_op,
  speed = excluded.speed,
  description = excluded.description,
  direction = excluded.direction;
```

## Post-registration validation queries

After May/human executes the registration SQL, validate row presence and definitions:

```sql
SELECT id, name, owner, type, target, threshold, unit, priority, status,
       project, source, source_query IS NOT NULL AS has_source_query,
       source_command IS NOT NULL AS has_source_command,
       alert_op, speed, direction, current, updated_at
FROM metrics
WHERE id IN (
  'session.finish-blocked-uncommitted-count-24h',
  'session.finish-blocked-unresolved-count-24h'
)
ORDER BY id;
```

Expected immediately after insert: two rows, both `status='active'`, both `has_source_query=1`, both `has_source_command=0`.

Then trigger or wait for the next `metrics-snapshot` run and validate snapshots/current values:

```sql
SELECT id, current, updated_at
FROM metrics
WHERE id IN (
  'session.finish-blocked-uncommitted-count-24h',
  'session.finish-blocked-unresolved-count-24h'
)
ORDER BY id;
```

```sql
SELECT metric_id, value, measured_at, measured_by, note
FROM metric_snapshots
WHERE metric_id IN (
  'session.finish-blocked-uncommitted-count-24h',
  'session.finish-blocked-unresolved-count-24h'
)
ORDER BY measured_at DESC, metric_id
LIMIT 10;
```

Expected after snapshot: both metrics have non-null `current`, and `metric_snapshots` has fresh rows. Exact values will drift with the rolling 24h window; at this iteration's read-only check they were `208` raw and `3` strict unresolved.

## Interpretation

The split should make future alerts actionable:

- `session.finish-blocked-uncommitted-count-24h` tracks raw workflow friction and should be reduced over time, but high values can include repaired sessions.
- `session.finish-blocked-unresolved-count-24h` is the quality-impact guardrail. A breach here means finish-blocked sessions are still ending dirty/unresolved after excluding review overrides and anti-shallow penalties.

This closes the observability gap identified in iteration 5 without adding another prompt patch while post-`c052855aa` strict unresolved dirty exits remain absent.
