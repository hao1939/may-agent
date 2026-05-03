# Investigation: dev heartbeat session queries drifted from runtime DB schema

**Date:** 2026-05-03
**Owner:** dev
**Status:** documented; heartbeat patch recommended when non-workspace writes are permitted

## Summary

The dev heartbeat's mandatory starter queries for recent failures and long sessions reference stale `sessions` columns. The current runtime table uses:

- `sessionId` instead of `id`
- `endedAt` instead of `completedAt`
- `opCount` instead of `turns`
- no `duration_ms` column

As a result, following the documented heartbeat literally produces query failures (`no such column: id`) before any real investigation can begin. This is an observability reliability issue: the first step for failure triage is itself broken, adding avoidable pivot/recovery calls and increasing the chance that agents miss the real signal.

## Evidence

Current active metrics are healthy:

- `session.error-rate-6h = 0`
- `handler.success-rate = 1`
- `handler.failed-count = 0`
- no unmeasured active metrics

But the first attempt to use the heartbeat's documented recent-failure/long-session queries failed:

```text
## recent_failed_sessions
ERROR no such column: id

## long_sessions
ERROR no such column: id
```

`PRAGMA table_info(sessions)` shows the actual columns:

```text
sessionId TEXT PRIMARY KEY
agent TEXT NOT NULL
task TEXT NOT NULL
status TEXT NOT NULL
kind TEXT
source TEXT
parentSessionId TEXT
requestId TEXT
workflowRunId TEXT
projectId TEXT
startedAt INTEGER NOT NULL
endedAt INTEGER
error TEXT
outcome TEXT
opCount INTEGER DEFAULT 0
stepLabel TEXT
```

A corrected query works and surfaced the real recent failures:

```sql
SELECT sessionId, agent, status, substr(error,1,250) AS error, startedAt, endedAt
FROM sessions
WHERE status='error'
ORDER BY startedAt DESC
LIMIT 10;
```

Recent 24h failures are currently only two `amy` sessions; older failures are mostly transient auth/deployment errors (`401 IDE token expired`, `429 No deployments available`). Handler failures in the last 24h are zero.

## Root cause

The dev heartbeat appears to have been copied from an older schema or from a different session telemetry model. The runtime DB schema changed (or was never aligned) but the diagnostic snippets were not updated.

The same drift exists in nearby documentation: `agents/shared/db-schema.md` still lists `completedAt`, while runtime uses `endedAt`.

## Impact

- Every dev heartbeat that follows the documented SQL wastes calls on `no such column` failures.
- The required pivot after a failed command can distract from the actual failure pattern.
- Agents may incorrectly conclude DB access is broken rather than recognizing schema drift.
- Failure investigations become less reproducible because agents must rediscover the live schema.

## Recommended patch

Update `agents/dev/heartbeat.md` starter queries to:

```sql
-- Recent failures
SELECT sessionId, agent, status, error, startedAt, endedAt
FROM sessions
WHERE status='error'
ORDER BY startedAt DESC
LIMIT 5;

-- Long/high-op sessions (inefficiency)
SELECT sessionId, agent, opCount, (COALESCE(endedAt, unixepoch()*1000) - startedAt) AS duration_ms
FROM sessions
WHERE opCount > 10
ORDER BY startedAt DESC
LIMIT 5;
```

Also update `agents/shared/db-schema.md` to match the runtime schema, or add a note that schema docs must be verified with `PRAGMA table_info` before use.

## Recommended metric/check

A lightweight documentation drift check would catch this earlier:

```bash
node/bun script extracts SQL snippets from heartbeat.md files and verifies each statement prepares successfully against readonly .state/may.db.
```

For dev specifically, a metric or CI guard could track `heartbeat.sql-snippet-prepare-failures` with target `0` and threshold `0`.

## Follow-up

When allowed to edit non-workspace files, patch:

1. `agents/dev/heartbeat.md` query examples.
2. `agents/shared/db-schema.md` session table column list.
3. Optionally add a small guard/test that prepares documented SQL snippets against the runtime DB in readonly mode.
