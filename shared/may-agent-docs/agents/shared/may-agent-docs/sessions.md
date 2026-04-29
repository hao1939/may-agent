# Sessions

## The Model

Every agent interaction is a **session** — a single LLM conversation with tools.

```sql
CREATE TABLE sessions (
  sessionId       TEXT PRIMARY KEY,
  agent           TEXT NOT NULL,
  task            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'running',
  kind            TEXT,
  source          TEXT,
  parentSessionId TEXT,
  requestId       TEXT,
  workflowRunId   TEXT,
  projectId       TEXT,
  startedAt       INTEGER NOT NULL,
  endedAt         INTEGER,
  error           TEXT,
  outcome         TEXT,
  opCount         INTEGER DEFAULT 0
);
```

## State Machine

```
created → running → done | error
```

No "pending" or "queued" state. Sessions start running immediately.

## Session Tree

```
Root (May heartbeat)
  ├── call("tech-lead", task)          ← child (blocks parent)
  │     └── call("coder", subtask)     ← grandchild
  └── fork("bob", task)                ← new root (async)
```

- **call** = synchronous, parent waits, linked via `parentSessionId`
- **fork** = asynchronous, returns sessionId, independent tree

## Persistence

1. **SQLite** (`sessions` table) — for SQL queries and dashboard
2. **Disk** (`.state/sessions/<id>/meta.json`) — full metadata + messages

## Implementation

- **Manager:** `src/lib/manager.ts` — spawns/manages sessions
- **DB writes:** `src/lib/db-writer.ts` — persists session events
- **Schema:** `src/lib/requests.ts` → `upsertSession()`, `updateSessionDb()`
