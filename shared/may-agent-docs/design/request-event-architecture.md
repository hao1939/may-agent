# Design: Event-Native Architecture

**Status:** ✅ Implemented  
**Date:** 2026-04-29 (event-native redesign)  
**References:** [convention-defaults.md](convention-defaults.md), [core-principles.md](core-principles.md) (P1, P3)

## Core Principle: Events Are Immutable Facts

```
Event = something that happened at a point in time (immutable, append-only)
State = derived by querying events (no mutable status fields)
```

No `status` column on events. No `UPDATE` statements. State is computed from event pairs:
- Handler health: count `handler.completed` vs `handler.failed`
- Inbox: recent events for an agent within time window
- Dedup: check if a similar event already exists

## Events Table

Single table storing all domain events. Schema:

```sql
CREATE TABLE events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,    -- dot-separated: "handler.completed", "agent.notification"
  source     TEXT,             -- who emitted it
  owner      TEXT,             -- who should see it (for inbox)
  data       TEXT,             -- JSON payload
  timestamp  INTEGER NOT NULL,
  ttl_ms     INTEGER,          -- auto-expire after this duration
  urgency    TEXT DEFAULT 'normal'
);
```

## Event Types (paired lifecycle)

### Handler lifecycle
```
handler.started    { handler, agent }
handler.completed  { handler, agent, durationMs }   ← paired with started
handler.failed     { handler, agent, error, durationMs }  ← paired with started
```

### Session lifecycle
```
session.completed  { sessionId, agent, parentSessionId, outcome }
session.failed     { sessionId, agent, error }
session.escalated  { sessionId, agent, finishParams }
```

### Agent communication
```
agent.notification { owner, source, task, artifact }
agent.finding      { owner, source, task, finding }
escalation.created { id, agent, reason, level }
```

## Inbox (time-window based)

Agents see recent events in their heartbeat — no ack/done needed:

```sql
SELECT * FROM events
WHERE owner = ? AND timestamp > ? AND (ttl_ms IS NULL OR timestamp + ttl_ms > ?)
ORDER BY CASE WHEN urgency = 'immediate' THEN 0 ELSE 1 END, timestamp DESC
LIMIT 20
```

Events naturally expire via TTL or time window (2h default). Agents act or they don't — no status bookkeeping needed.

## Deriving State from Events

| Question | Query |
|----------|-------|
| Handler last fire? | `MAX(timestamp) FROM events WHERE event_type = 'handler.started' AND handler = ?` |
| Handler healthy? | `COUNT handler.completed > COUNT handler.failed` in window |
| Agent work stats? | `sessions GROUP BY agent, status` |
| Findings dedup? | `EXISTS event WHERE event_type = 'agent.finding' AND finding = ?` |

## Work Tracking

Work tracking uses the **sessions table** (not events):

```sql
SELECT agent, task, status, startedAt, endedAt, parentSessionId
FROM sessions WHERE startedAt > ? ORDER BY startedAt DESC
```

The `parentSessionId` field links child sessions to their spawner. `requestId` on sessions provides correlation back to the trigger.

## What Was Removed

The `requests` table (2026-04-29) — replaced by:
- **sessions table**: who ran what, status, parent linkage
- **events table**: handler lifecycle, notifications, findings
- **inflightJobs Map**: overlap detection (in-memory, no DB needed)

