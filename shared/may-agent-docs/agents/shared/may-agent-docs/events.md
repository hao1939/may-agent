# Events & Inbox

## Core Principle

```
Event = something that happened at a point in time (immutable, append-only)
State = derived by querying events (no mutable status fields)
```

No `status` column. No `UPDATE` statements. State is computed from event pairs.

## Schema

```sql
CREATE TABLE events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  source     TEXT,
  owner      TEXT,
  data       TEXT,
  timestamp  INTEGER NOT NULL,
  ttl_ms     INTEGER,
  urgency    TEXT DEFAULT 'normal'
);
```

## Event Types

### Handler lifecycle (paired)
```
handler.started    { handler, agent }
handler.completed  { handler, agent, durationMs }
handler.failed     { handler, agent, error, durationMs }
```

### Session lifecycle
```
session.completed  { sessionId, agent, parentSessionId, outcome }
session.failed     { sessionId, agent, error }
session.escalated  { sessionId, agent, finishParams }
```

### Agent communication
```
agent.notification { owner, source, task }
agent.finding      { owner, source, task, finding }
escalation.created { id, agent, reason, level }
```

## Inbox (time-window based)

Agents see recent events in their heartbeat. No ack/done needed:

```sql
SELECT id, event_type, data, urgency, timestamp FROM events
WHERE owner = ? AND timestamp > ? AND (ttl_ms IS NULL OR timestamp + ttl_ms > ?)
ORDER BY CASE WHEN urgency = 'immediate' THEN 0 ELSE 1 END, timestamp DESC
LIMIT 20
```

Events naturally expire via TTL or time window (2h default).

## Deriving State

| Question | Query |
|----------|-------|
| Handler last fire? | `MAX(timestamp) WHERE event_type = 'handler.started' AND handler = ?` |
| Handler healthy? | `COUNT completed > COUNT failed` in window |
| Agent work stats? | `sessions GROUP BY agent, status` |
| Findings dedup? | `EXISTS WHERE event_type = 'agent.finding' AND finding = ?` |

## Agent-to-Agent Messaging

A pattern on `emit()`:
```typescript
sdk.emit("agent.notification", { owner: "bob", task: "Review the PR" });
```

## Implementation

- **Persistence:** `src/lib/db-writer.ts` subscribes to bus, writes all events
- **Inbox query:** `src/lib/runtime-ctx.ts` → `getInbox()`
- **Heartbeat injection:** `agents/shared/workflows/heartbeat-data.ts` → `loadInbox()`
