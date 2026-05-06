# Dev heartbeat query/schema drift

Date: 2026-05-06
Owner: dev
Status: fixed in dev heartbeat starter queries

## Signal

During this heartbeat, the approved work queue was empty, so I followed `agents/dev/heartbeat.md` and ran the suggested database checks. Two of the documented fallback queries failed against the current `sessions` schema:

- `SELECT id, ... FROM sessions ...` fails: `no such column: id`
- `SELECT ..., turns, duration_ms FROM sessions ...` fails: current table has `opCount`, `startedAt`, and `endedAt`, not `turns`/`duration_ms`

The corrected schema query shows the current primary key and timing fields are:

- `sessionId` (primary key)
- `opCount`
- `startedAt`
- `endedAt`

## Current health observed

Metric health is currently good for the two priority metrics checked:

- `handler.success-rate`: `0.9926` (target `0.95`, threshold `0.8`, alert `<`)
- `session.error-rate-6h`: `0.0062` (target `0.1`, threshold `0.3`, alert `>`)

Recent session status counts for the last 6 hours:

- `done`: 161
- `interrupted`: 3
- `running`: 3
- `error`: 0 observed in the 6h status-count query

Recent historical errors are mostly infrastructure/provider issues (`401 IDE token expired`, one `429 No deployments available`) rather than code-path failures.

## Root cause

The heartbeat's "Queries to Start With" section is stale relative to the production SQLite schema. It uses legacy/incorrect column names (`id`, `turns`, `duration_ms`, and in one query `started_at` is easy to infer from docs but the schema uses `startedAt`). This slows failure investigation and creates false tool failures during autonomous checks.

A related metric-engineering drift was also observed: all 14 active metrics currently have `source_query IS NULL` and `source_command IS NULL`, despite the heartbeat and metrics philosophy saying the metrics-snapshot handler auto-measures metrics with those fields. That may be intentional because another subsystem updates core metrics, but the docs imply a path that is not represented by current active metric rows.

## Working replacement queries

```sql
-- Recent failures
SELECT sessionId, agent, status, error, startedAt
FROM sessions
WHERE status='error'
ORDER BY startedAt DESC
LIMIT 10;

-- Long/high-op sessions
SELECT sessionId, agent, opCount, startedAt, endedAt, (endedAt - startedAt) AS duration_ms
FROM sessions
WHERE opCount > 10
ORDER BY startedAt DESC
LIMIT 10;

-- Current status mix
SELECT status, COUNT(*) AS c
FROM sessions
WHERE startedAt > unixepoch()*1000 - 21600000
GROUP BY status;
```

## Recommended fix

Update `agents/dev/heartbeat.md` query examples to use the current column names. If the metrics system is expected to use `source_query`/`source_command`, add or restore at least one active source-backed dev-owned metric; otherwise revise the heartbeat text to describe the actual metric updater path.

## Why this matters

The first step of dev's autonomous loop is failure detection. Stale starter queries create noise exactly at the point where fast, reliable triage is needed. This did not affect production health today, but it is a recurring efficiency bug for dev heartbeats.
