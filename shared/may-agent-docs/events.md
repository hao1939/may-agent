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
  event_type TEXT NOT NULL,    -- dot-separated: "handler.completed"
  source     TEXT,             -- who emitted it
  owner      TEXT,             -- who should see it (for inbox)
  data       TEXT,             -- JSON payload
  timestamp  INTEGER NOT NULL,
  ttl_ms     INTEGER,          -- auto-expire after this duration
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
message.created    { from, to, content, intent?, priority? }  -- v2 unified primitive
escalation.created { id, agent, reason, level }
```

> **Note:** `agent.notification` was replaced by `message.created` with `to: "human"` for human-facing messages, or `to: "<agent>"` for inter-agent messages.

## Inbox (time-window based)

Agents see recent events in their heartbeat. No ack/done needed:

```sql
SELECT id, event_type, data, urgency, timestamp
FROM events
WHERE owner = ?
  AND timestamp > ?              -- now - 2h
  AND (ttl_ms IS NULL OR timestamp + ttl_ms > ?)
ORDER BY CASE WHEN urgency = 'immediate' THEN 0 ELSE 1 END,
         timestamp DESC
LIMIT 20
```

Events naturally expire via TTL or time window. Agents act or they don't.

## Deriving State

| Question | Query |
|----------|-------|
| Handler last fire? | `MAX(timestamp) WHERE event_type = 'handler.started' AND handler = ?` |
| Handler healthy? | `COUNT completed > COUNT failed` in window |
| Agent work stats? | `sessions GROUP BY agent, status` |
| Findings dedup? | `EXISTS WHERE event_type = 'agent.finding' AND finding = ?` |

## Agent-to-Agent Messaging

Uses `message.created` — the single async communication primitive:

```typescript
sdk.notify("bob", "Review the PR");
// Emits: { type: "message.created", from: agent, to: "bob", content: "Review the PR" }
```

Bob sees it in his inbox on next heartbeat.

## Implementation

- **Persistence:** `src/lib/db-writer.ts` subscribes to bus, writes all events
- **Inbox query:** `src/lib/runtime-ctx.ts` → `getInbox()`
- **Heartbeat injection:** `agents/shared/workflows/heartbeat-data.ts` → `loadInbox()`
