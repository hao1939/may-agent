# Design: Handler Health Metrics

**Status**: approved
**Date**: 2026-04-27

## Problem
- No metrics-snapshot handler — metrics defined but nobody measures them (stale 44h+)
- Handler timeouts and errors invisible to metric system
- User gets failure alerts but no metric tracks them

## Handler Inventory

| Category | Count | Frequency | Examples |
|----------|-------|-----------|----------|
| **Heartbeats** | 8 | Every 30min | may, bob, coach, optimizer, scout, tech-lead, qa, amy-kimi |
| **Periodic** | 6 | 5min–24h | project (5min), reflect (6h), optimize (24h) |
| **Event-triggered** | 5 | On demand | metric-alert-reactor, session-recovery, session-eval |
| **Total enabled** | 19 | | |

## Events

Three events emitted by cron.ts `fireHandler()`:

```json
{ "event": "handler.started", "data": { "handler": "heartbeat-bob", "agent": "bob" }}
{ "event": "handler.completed", "data": { "handler": "heartbeat-bob", "agent": "bob", "durationMs": 45230 }}
{ "event": "handler.failed", "data": { "handler": "heartbeat-bob", "agent": "bob", "error": "timed out after 300s", "durationMs": 300000 }}
```

**handler.started** enables:
- Stuck handler detection (started but never completed/failed)
- Accurate duration (started → completed timestamps)

**Handler timeout**: cron.ts already has `Promise.race` with 5min timeout. Timeout rejects the promise → `.catch()` fires → emits `handler.failed`.

**Implementation**: bus is available in the closure where Cron is created (agent-loader.ts). Pass `bus.emit` directly — no callback indirection needed.

## Metrics

### `handler.success-rate`
- **What**: % of handler fires that complete without error in the last 6h
- **Query**: `handler.completed / (handler.completed + handler.failed)` from events table
- **Target**: 0.95 — **Threshold**: 0.80
- **Owner**: optimizer

### `handler.heartbeat-coverage`
- **What**: Number of unique agents with a successful heartbeat in the last 2h
- **Query**: `COUNT(DISTINCT data.agent)` from `handler.completed` where handler LIKE 'heartbeat-%'
- **Target**: 8 (all agents) — **Threshold**: 6
- **Owner**: may
- **Why**: If an agent's heartbeat stops, that agent is dead. 2h window catches it within 3-4 heartbeat cycles.

### `handler.p95-duration`
- **What**: 95th percentile handler duration in the last 6h (ms)
- **Query**: Sort `handler.completed` by durationMs, take the value at 95th percentile
- **Target**: 120000 (2min) — **Threshold**: 240000 (4min, near 5min timeout)
- **Owner**: optimizer
- **Why**: Early warning — handlers approaching timeout will start failing intermittently.

### `handler.fires-per-hour`
- **What**: Total handler fires (started) in the last hour
- **Query**: `COUNT(*)` from `handler.started` in last 1h
- **Target**: 30 — **Threshold**: 15
- **Owner**: may
- **Why**: Measures system liveness. If fires drop, cron is stuck.

## Alert examples

```
🔴 handler.success-rate: 0.72 (threshold: 0.80)
   Last 6h: 18 completed, 7 failed
   Top failures: heartbeat-amy-kimi (5x, 429 rate limit), heartbeat-coach (2x, timeout)

⚠️ handler.heartbeat-coverage: 6/8 agents (threshold: 6)
   Missing: amy-kimi (last seen 3h ago), coach (last seen 2.5h ago)
```

## Out of scope
- **Per-agent metrics** (coach.instruction-compliance, coder.quality, etc.) — those 23 existing metrics need their own measurement mechanism, likely per-agent in heartbeat workflows. Not this design.
- **Per-handler metrics** — too granular. handler.success-rate covers all. If one handler is the problem, the alert payload identifies it.
- **system.agent-health-worst** — removed. Confusing name, moving target. Agent health is better tracked through existing session-success-rate metric + the heartbeat-coverage metric above.

## Metric writes

No existing helpers. Handler uses raw SQL:

```sql
-- Upsert metric (create if missing, update current)
INSERT INTO metrics (id, name, owner, current, target, threshold, unit, type, status, speed)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 'fast')
ON CONFLICT(id) DO UPDATE SET current = excluded.current, updated_at = excluded.updated_at;

-- Write snapshot
INSERT INTO metric_snapshots (metric_id, value, measured_at, measured_by)
VALUES (?, ?, ?, 'metrics-snapshot');
```

## Implementation

| Step | File | Change |
|------|------|--------|
| 1 | `src/app/cron.ts` | Emit handler.started/completed/failed in fireHandler via bus.emit |
| 2 | `src/app/agent-loader.ts` | Pass `bus.emit` to Cron (bus already in scope at line 282) |
| 3 | `agents/may/handlers/metrics-snapshot.ts` | NEW: 5min handler, queries events, writes metric snapshots |
| 4 | `agents/may/cron.json` | Add metrics-snapshot (intervalMs: 300000) |
