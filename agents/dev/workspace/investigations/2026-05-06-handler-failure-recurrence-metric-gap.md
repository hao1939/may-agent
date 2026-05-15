# Handler failure recurrence metric gap — 2026-05-06

## Trigger

Dev heartbeat found no approved work-queue items. Current active metrics are healthy enough to avoid an alert, but `handler.failed-count` remains non-zero because it is a 6h aggregate and includes recovered failures.

## Current signal

Read-only DB metrics check showed:

- `handler.failed-count`: current `2`, threshold `3`, alert_op `>`
- `handler.success-rate`: current `0.9889`, threshold `0.8`, alert_op `<`
- `session.error-rate-6h`: current `0.0116`, threshold `0.3`, alert_op `>`

Recent `handler.failed` events are dominated by already-recovered `metrics-snapshot` failures:

- `metrics-snapshot`: `table metrics has no column named config` at timestamps `1778087051850` and `1778087351978`
- Latest `metrics-snapshot` events are successful completions, e.g. timestamp `1778103554204` with duration `1638ms`

## Gap

`handler.failed-count` is useful for broad health, but it does not distinguish:

1. one-off or recovered failures still inside the 6h lookback, from
2. currently recurring failure signatures that need immediate intervention.

This causes heartbeat investigations to repeatedly re-triage known recovered failures until they age out of the 6h window.

## Proposed metric

Add a fast health metric owned by `dev` that counts repeated `(handler,error)` signatures in the last hour:

```sql
SELECT COUNT(*) AS value
FROM (
  SELECT
    json_extract(data, '$.handler') AS handler,
    json_extract(data, '$.error') AS error,
    COUNT(*) AS c
  FROM events
  WHERE event_type = 'handler.failed'
    AND timestamp > unixepoch()*1000 - 3600000
  GROUP BY handler, error
  HAVING c >= 2
);
```

Suggested registry row:

```sql
INSERT OR IGNORE INTO metrics (
  id, name, owner, source_query, target, threshold, alert_op,
  type, status, speed, created_at, updated_at
) VALUES (
  'handler.recurring-failure-signatures-1h',
  'Recurring handler failure signatures (1h)',
  'dev',
  'SELECT COUNT(*) AS value FROM (SELECT json_extract(data, ''$.handler'') AS handler, json_extract(data, ''$.error'') AS error, COUNT(*) AS c FROM events WHERE event_type = ''handler.failed'' AND timestamp > unixepoch()*1000 - 3600000 GROUP BY handler, error HAVING c >= 2)',
  0, 0, '>', 'health', 'active', 'fast',
  unixepoch()*1000, unixepoch()*1000
);
```

## Verification

The source query was tested read-only via `bun:sqlite` against `.state/may.db` and currently returns `0`, matching the absence of active repeated handler failures in the last hour.

## Recommendation

Register this metric once DB writes are available through the system writer/event path. Until then, use this query during dev heartbeats whenever `handler.failed-count` is non-zero to avoid re-investigating stale recovered failures.
