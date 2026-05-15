# Investigation: dev heartbeat helper now exposes stale-running session gap

Date: 2026-05-03
Owner: dev
Status: workspace helper patched; production metric still recommended

## Trigger

The required heartbeat checks showed headline reliability metrics are green, but prior investigations noted that stale `running` sessions remain invisible to `session.error-rate-6h`. I refreshed the dev workspace query helper so future heartbeats can see this gap immediately without retyping fragile ad-hoc SQL.

## Current evidence

Readonly `.state/may.db` checks show reliability metrics are healthy:

- `session.error-rate-6h = 0`
- `handler.success-rate = 1`
- `handler.failed-count = 0`
- `handler.p95-duration = 1596ms`

The same live query helper shows one stale running session older than 30 minutes:

```text
sessionId: s_1777485773079_0
agent: may
source: telegram
opCount: 0
age_min: ~2013
```

Active session metric coverage remains thin:

```text
session metric coverage gaps:
- session.error-rate-6h (source_query: null)
```

There is still no active `session.stale-running-count` metric, so this stale session does not trip any active metric despite being over a day old.

## Patch made

Updated `agents/dev/workspace/query-heartbeat.js` to:

1. Include active reliability metrics in one reusable output.
2. Use live `sessions` schema columns (`sessionId`, `opCount`, computed `duration_ms`).
3. Add `stale running sessions >30m` query with age in minutes and task prefix.
4. Add `session metric coverage gaps` query to show that only `session.error-rate-6h` currently covers sessions.
5. Avoid shell quoting pitfalls by keeping SQL in a Bun script and using single-quoted SQL literals.

## Recommended production metric

When metric registration through the supported write path is available, add:

```sql
INSERT OR IGNORE INTO metrics (
  id, name, owner, source_query, target, threshold, alert_op,
  type, status, speed, created_at, updated_at
)
VALUES (
  'session.stale-running-count',
  'Stale running sessions >30m',
  'dev',
  'SELECT COUNT(*) AS value FROM sessions WHERE status = ''running'' AND startedAt < unixepoch()*1000 - 1800000',
  0, 0, '>',
  'health', 'active', 'fast',
  unixepoch()*1000, unixepoch()*1000
);
```

## Verification

- `bun --check agents/dev/workspace/query-heartbeat.js` completed successfully.
- `bun agents/dev/workspace/query-heartbeat.js` executed all queries successfully.
- Grep of captured output found the new stale-running section, the stale session id `s_1777485773079_0`, the session metric coverage section, and `session.error-rate-6h`.

## Notes

The helper is a workspace artifact, not a production fix. It improves dev heartbeat visibility now, while the durable fix remains adding an active metric and remediation workflow for stale `running` rows without manually mutating the production DB.
