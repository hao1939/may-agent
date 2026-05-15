# Sessions

## The Model

Every agent interaction is a **session** — a single LLM conversation with tools.

Effective query schema. Some columns are added by migrations after the base
`CREATE TABLE`; agents should rely on the effective schema exposed by the SDK/query
surface, not hand-copy base DDL.

```sql
CREATE TABLE sessions (
  sessionId       TEXT PRIMARY KEY,
  agent           TEXT NOT NULL,
  task            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'running',  -- running | idle | done | error | interrupted
  kind            TEXT,             -- chat | job | call
  source          TEXT,             -- what triggered it
  parentSessionId TEXT,             -- who spawned this session
  requestId       TEXT,
  workflowRunId   TEXT,
  projectId       TEXT,
  startedAt       INTEGER NOT NULL,
  endedAt         INTEGER,
  error           TEXT,
  outcome         TEXT,
  opCount         INTEGER DEFAULT 0,
  stepLabel       TEXT              -- migration-added workflow step label
);
```

## State Machine

```
created → running → idle      (chat sessions, autoClose: "never")
                  → done      (completed job/call sessions)
                  → error
                  → interrupted
```

No "pending" or "queued" state. Sessions start running immediately when spawned.
Heartbeats are `job` sessions whose `source` identifies the heartbeat workflow.

## Session Tree

```
Root (May heartbeat)
  ├── call("tech-lead", task)          ← child (blocks parent)
  │     └── call("coder", subtask)     ← grandchild
  └── fork("bob", task)                ← new root (async, returns immediately)
```

- **call** = synchronous, parent waits, child is linked via `parentSessionId`
- **fork** = asynchronous, returns sessionId, new session tree

## Persistence

Sessions persist to:
1. **SQLite** (`sessions` table) — for SQL queries, dashboard, status checks
2. **Disk** (`.state/sessions/<id>/meta.json`) — full metadata, messages

The DB is the queryable index. Disk is the source of truth for message history.

## Implementation

- **Manager:** `src/lib/manager.ts` — spawns/manages sessions
- **DB writes:** `src/lib/db-writer.ts` and `src/lib/db/sessions.ts`
- **DB schema:** `src/lib/db/schema.ts`
- **Queries:** prefer `src/lib/query-service.ts` / SDK `query` over direct SQL in agent-facing code

## Design Decisions

### autoClose is internal

`autoClose` controls filesystem persistence (archive session dir to `history/` vs keep in-place).
It's an internal detail of the persistence layer, not a user-facing concept:
- Chat sessions use `autoClose: "never"` → dir stays in `sessions/` so they survive restarts
- Job/call sessions use `autoClose: "immediate"` → dir moves to `sessions/history/` on completion

Callers don't set it directly — it's derived from `kind`. Eventually, when we move to
pure-SQLite session tracking, `autoClose` disappears entirely.

### kind is metadata

`kind` ("chat" | "job" | "call") is a query/observability tag. It does not drive session
lifecycle — `autoClose` does that internally. The only behavioral branch on `kind`:
`chat-session.ts` finds the existing chat session by `kind === "chat"`.

Heartbeats are `job` kind sessions — there's no separate "heartbeat" kind.
