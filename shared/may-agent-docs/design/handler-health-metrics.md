# Design: Handler Health Metrics & Alerts

**Status**: approved
**Date**: 2026-04-27

## Problem
- No metrics-snapshot handler — metrics defined but nobody measures them (stale 44h+)
- No handler outcome tracking — cron fires handlers, success/failure logged but not persisted
- Handler timeouts and errors invisible to metric system
- User gets Telegram alerts about failures but no metric tracks them

## Current State
- 19 enabled cron handlers fire on intervals
- Cron has `onError` and `notify` callbacks but no `emit`
- Events table exists and persists all emitted events
- metric-alert-reactor handler exists but has no fresh data to react to
- Metrics table has 23 metrics, all stale (44h since last snapshot)

## Design

### 1. Handler outcome events

Add `emitEvent` callback to Cron class. Emit after every handler fire:

```
handler.completed  { handler: "heartbeat-bob", durationMs: 45000 }
handler.failed     { handler: "heartbeat-bob", error: "timed out after 300s" }
```

Events persist automatically via DbWriter → events table.

### 2. Metrics-snapshot handler

New handler: `agents/may/handlers/metrics-snapshot.ts`
Fires every 5 minutes. Measures:

| Metric | Query | Target | Threshold |
|--------|-------|--------|-----------|
| `system.handler-health` | % of handler events that are completed (not failed) in last 6h | 0.95 | 0.80 |
| `system.session-health` | % of sessions with status=done in last 6h | 0.95 | 0.80 |
| `system.agent-health-worst` | Error rate of worst-performing agent in last 6h | 0.05 | 0.20 |

Writes to metric_snapshots table. Updates metrics.current.

### 3. Alert flow

```
metrics-snapshot fires (every 5min)
  → measures handler-health, session-health, agent-health
  → writes snapshots
  → if any metric breaches threshold:
      → emits metric.breach event
      → metric-alert-reactor fires (already exists)
      → alert injected into may's heartbeat
```

### Files to modify

| File | Change |
|------|--------|
| `src/app/cron.ts` | Add `emitEvent` callback. Emit handler.completed/handler.failed in fireHandler. |
| `src/app/may.ts` | Pass `bus.emit` as emitEvent when creating Cron instance. |
| `agents/may/handlers/metrics-snapshot.ts` | NEW: measure metrics, write snapshots. |
| `agents/may/cron.json` | Add metrics-snapshot entry (5min interval). |

### What we're NOT building
- Per-handler metrics (too granular — handler-health covers all)
- Custom alert thresholds per handler (use one threshold for all)
- Historical trend analysis (just current value vs threshold)
