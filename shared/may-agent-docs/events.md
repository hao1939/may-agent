# Events & Inbox

## Core Principle

```
Event = something that happened at a point in time (immutable, append-only)
```

Events are the primary communication mechanism. State is derived from events where practical. Some tables (metrics, sessions) use mutable status columns for query efficiency — this is a pragmatic trade-off, not a violation. The events table remains append-only and is the audit trail.

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

The canonical list is the `SystemEvent` union in `src/app/event-bus.ts`. Key categories agents encounter:

### Handler lifecycle (paired)
```
handler.started    { handler, agent }
handler.completed  { handler, agent, durationMs }
handler.failed     { handler, agent, error, durationMs }
```

### Session lifecycle
```
session.start      { sessionId, agent, task, kind, parentSessionId }
session.end        { sessionId, agent, status, summary }
```

### Metrics
```
metric.breach      { metric, value }
metric.recovered   { metric }
metric.stalled     { metric }
metric.alert_judged { metric, action, reason }
```

### Agent communication
```
message.created    { from, to, content, intent?, priority? }
escalation.created { id, agent, reason, level }
agent.decision     { agent, sessionId, decision }
```

### Other (see SystemEvent for full list)
```
project.iteration, project.completed, telegram.reply, tool.executed, ...
```

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

Events support queryable state alongside mutable tables:

| Question | Query |
|----------|-------|
| Handler last fire? | `MAX(timestamp) WHERE event_type = 'handler.started' AND handler = ?` |
| Handler healthy? | `COUNT completed > COUNT failed` in window |
| Agent work stats? | `sessions GROUP BY agent, status` |
| Message dedup? | `EXISTS WHERE event_type = 'message.created' AND data LIKE ?` |

Note: some state is maintained directly (metrics.current, sessions.status) for query efficiency. The events table serves as the audit trail and supports time-window queries that mutable tables cannot.

## Agent-to-Agent Messaging

Uses `message.created` — the single async communication primitive:

```typescript
sdk.message("bob", "Review the PR");
// Emits: { type: "message.created", from: agent, to: "bob", content: "Review the PR" }
```

Bob sees it in his inbox on next heartbeat.

## Socket Boundary

The Unix socket is an event transport, not a second command system.

- Inbound JSON lines with a string `type` are accepted as bus events.
- `subscribe` and `status` are the only socket-local protocol frames.
- Legacy aliases are normalized at the socket boundary:
  `emit` unwraps to its named event, `close` becomes `shutdown`,
  `reload_agents` becomes `reload`, and `cancel_task` becomes `cancel_all`.
- Socket `ok` means the frame was accepted into the event transport. It does
  not mean every handler finished.

This keeps socket, Telegram, web, and runtime code on the same event-first
path: normalize at the edge, persist via the bus, and let subscribers react.

## Implementation

- **Persistence:** `src/lib/db-writer.ts` subscribes to bus, writes all events
- **Inbox query:** `src/lib/runtime-ctx.ts` → `getInbox()`
- **Heartbeat injection:** `shared/workflows/heartbeat-data.ts` → `loadInbox()`
