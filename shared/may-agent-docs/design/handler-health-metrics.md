# Design: Handler Health Metrics

**Status**: draft
**Date**: 2026-04-27

## Handler Inventory

| Category | Count | Frequency | Examples |
|----------|-------|-----------|----------|
| **Heartbeats** | 8 | Every 30min | may, bob, coach, optimizer, scout, tech-lead, qa, amy-kimi |
| **Periodic** | 6 | 5min–24h | project (5min), reflect (6h), optimize (24h) |
| **Event-triggered** | 5 | On demand | metric-alert-reactor, session-recovery, session-eval, escalation, context-learn |
| **Total enabled** | 19 | | |

## What we need to understand

1. **Reliability**: How often do handlers succeed vs fail/timeout?
2. **Coverage**: Are all heartbeats firing? Is any agent getting skipped?
3. **Latency**: How long do handlers take? Are any getting close to timeout (300s)?
4. **Throughput**: How many handler fires per hour? Is the system doing work?

## Metrics

### `handler.success-rate`
- **What**: % of handler fires that complete without error in the last 6h
- **Source**: events table — `handler.completed` vs `handler.failed`
- **Target**: 0.95
- **Threshold**: 0.80
- **Owner**: optimizer
- **Why**: The single most important handler health signal. Below 0.80 means the system is broken.

### `handler.heartbeat-coverage`
- **What**: Number of unique agents that had a successful heartbeat in the last 2h
- **Source**: events table — `handler.completed` where handler name starts with `heartbeat-`
- **Target**: 8 (all agents)
- **Threshold**: 6
- **Owner**: may
- **Why**: If an agent's heartbeat stops firing, that agent is effectively dead. This catches it fast (2h window = should see at least 2-3 fires per agent).

### `handler.p95-duration`
- **What**: 95th percentile handler duration in the last 6h (milliseconds)
- **Source**: events table — `handler.completed` data.durationMs
- **Target**: 120000 (2min)
- **Threshold**: 240000 (4min, close to 5min timeout)
- **Owner**: optimizer
- **Why**: Handlers approaching the 5min timeout will start failing intermittently. This is the early warning.

### `handler.fires-per-hour`
- **What**: Total handler fires in the last hour
- **Source**: events table — count of `handler.completed` + `handler.failed` in last 1h
- **Target**: 20
- **Threshold**: 10
- **Owner**: may
- **Why**: If fires drop, cron is stuck or handlers are being skipped. Measures overall system liveness.

## Event format

Emitted by cron.ts `fireHandler()`:

```json
{ "type": "emit", "event": "handler.completed", "data": {
    "handler": "heartbeat-bob",
    "agent": "bob",
    "durationMs": 45230
}}

{ "type": "emit", "event": "handler.failed", "data": {
    "handler": "heartbeat-bob",
    "agent": "bob",
    "error": "Handler timed out after 300s",
    "durationMs": 300000
}}
```

## Measurement queries

```sql
-- handler.success-rate (6h window)
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN event_type = 'handler.completed' THEN 1 ELSE 0 END) as ok
FROM events
WHERE event_type IN ('handler.completed', 'handler.failed')
  AND timestamp > :six_hours_ago

-- handler.heartbeat-coverage (2h window)
SELECT COUNT(DISTINCT json_extract(data, '$.agent')) as agents
FROM events
WHERE event_type = 'handler.completed'
  AND json_extract(data, '$.handler') LIKE 'heartbeat-%'
  AND timestamp > :two_hours_ago

-- handler.p95-duration (6h window)
SELECT json_extract(data, '$.durationMs') as duration
FROM events
WHERE event_type = 'handler.completed'
  AND timestamp > :six_hours_ago
ORDER BY duration DESC
LIMIT 1 OFFSET (SELECT COUNT(*)/20 FROM events 
  WHERE event_type = 'handler.completed' AND timestamp > :six_hours_ago)

-- handler.fires-per-hour
SELECT COUNT(*) as fires
FROM events
WHERE event_type IN ('handler.completed', 'handler.failed')
  AND timestamp > :one_hour_ago
```

## Alert examples

```
🔴 handler.success-rate: 0.72 (threshold: 0.80)
   Last 6h: 18 completed, 7 failed
   Top failures: heartbeat-amy-kimi (5x, 429 rate limit), heartbeat-coach (2x, timeout)

⚠️ handler.heartbeat-coverage: 6/8 agents (threshold: 6)
   Missing: amy-kimi (last seen 3h ago), coach (last seen 2.5h ago)

⚠️ handler.p95-duration: 280s (threshold: 240s)
   Slow handlers: heartbeat-coach (avg 250s), optimize (avg 200s)
```

## Implementation

| Step | File | Change |
|------|------|--------|
| 1 | `src/app/cron.ts` | Add `emitEvent` callback. Emit handler.completed/handler.failed with durationMs. |
| 2 | `src/app/may.ts` | Pass `bus.emit` as emitEvent to Cron constructor. |
| 3 | `agents/may/handlers/metrics-snapshot.ts` | NEW: runs every 5min, queries events, writes metric snapshots. |
| 4 | `agents/may/cron.json` | Add metrics-snapshot entry (intervalMs: 300000). |
| 5 | DB | Create 4 metrics in metrics table on first run. |
