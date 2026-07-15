# Sessions

**Design status:** Accepted.
**Implementation status:** Implemented, including per-turn trace propagation,
fail-closed start persistence, and terminal error persistence.

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
  requestId       TEXT,             -- legacy correlation metadata; not lifecycle identity
  workflowRunId   TEXT,
  projectId       TEXT,
  startedAt       INTEGER NOT NULL,
  endedAt         INTEGER,
  error           TEXT,
  outcome         TEXT,
  opCount         INTEGER DEFAULT 0,
  stepLabel       TEXT,             -- workflow step label (in practice, always equals `agent` when non-null)
  lastActivityAt  INTEGER           -- last observed activity timestamp (ms)
);
```

## State Machine

```
created → running → idle      (chat turn completed; same chat session can receive the next message)
                  → done      (completed job/call sessions)
                  → error
                  → interrupted
```

No "pending" or "queued" state. Sessions start running immediately when spawned.
Heartbeats are `call` sessions spawned by the heartbeat workflow via `ctx.runAgent()`. Query by `source LIKE '%heartbeat%'`, not by `kind`.

Chat sessions are persistent conversations. A successful chat turn moves the
session from `running` back to `idle`; the next human message wakes the same
session. A retryable empty assistant turn does not terminal-close the
conversation: the runtime removes the empty assistant message, retries the same
user request once, and if the retry is still empty leaves the session `idle`
with a visible error on the `session.idle` event.

## Chat Turn Causality

A persistent chat session can participate in many traces. Session identity
answers "which conversation?"; trace identity answers "which human turn or
causal chain?" They must not be conflated.

Each queued input carries the trace of its triggering
`chat.start.requested` or `session.steer.requested` event. While processing that
turn, tool emissions, calls/forks, workflows, CLI tasks, and the terminal
`session.idle` / `session.end` use that turn trace. The terminal session event
adds a closure link to the opening intent. The next unrelated human turn gets a
new trace even though the session id remains unchanged.

`requestId` is retained only as legacy metadata. It must not open, close, or
correlate lifecycle pairs. Persisted event ids, explicit pair contracts, and
trace links are authoritative.

## Session Tree

```
Root (May heartbeat)
  ├── call("tech-lead", task)          ← child (blocks parent)
  │     └── call("dev", subtask)       ← grandchild
  └── fork("dev", task)                ← new root (async, returns immediately)
```

- **call** = synchronous, parent waits, child linked via `workflowRunId` (not `parentSessionId`)
- **fork** = asynchronous, returns sessionId, child linked via `parentSessionId`

**Linking note:** Despite the diagram, `call` sessions (via `ctx.runAgent()` inside
workflows) do NOT populate `parentSessionId` — they share a `workflowRunId` instead.
`parentSessionId` is only populated by `agents.fork()` (kind=`job`) sessions.
Verified structurally: almost no `call` session has a non-null
`parentSessionId`; sessions with `parentSessionId` are overwhelmingly `job` or `chat` kind.
(Census 2026-06-19: 1/22,866 call sessions has parentSessionId — likely an edge case;
17 total with parentSessionId — 9 job, 8 chat.)

## Persistence

Sessions persist to:
1. **SQLite** (`sessions` table) — for SQL queries, dashboard, status checks
2. **Disk** (`.state/sessions/<id>/meta.json`) — full metadata, messages

The DB is the queryable index. Disk is the source of truth for message history.

## Persistence Integrity

The manager registers live state before emitting `session.start`. The event is
persisted before side-effect subscribers run; if persistence fails, manager
state is rolled back and the registry records the start error. Consumers must
therefore never observe a durable session start for an unregistered session.

Terminal `session.end` data includes `status`, `outcome`, and `error`, and the DB
writer persists those fields. Disk metadata remains the full transcript source,
while SQLite is the canonical bounded read model for lifecycle queries.

`lastActivityAt` is updated by progress and terminal writes. Stale-session
checks may use it directly; historical rows created before the field existed
remain migration data rather than a reason to weaken the current contract.

## Data Retention

The `db-retention` handler (`agents/may/handlers/db-retention.ts`, daily cron)
deletes sessions where `startedAt < now - 14 days`. This means SQL queries
against `sessions` older than 14 days return empty results. Additionally,
sessions with `task` column > 1 MB are deleted regardless of age (size-based
retention, KE-1986, commit `a1ff9b269`). For longer-term session analysis,
use disk artifacts (`.state/sessions/history/<id>/meta.json`) if they have
not been cleaned separately.

See `events.md` → "Data Retention" for the full retention table.

## Implementation

- **Manager:** `projects/may-agent/src/lib/manager.ts` — spawns/manages sessions
- **DB writes:** `projects/may-agent/src/lib/db-writer.ts` and `projects/may-agent/src/lib/db/sessions.ts`
- **DB schema:** `projects/may-agent/src/lib/db/schema.ts`
- **Queries:** prefer `projects/may-agent/src/lib/query-service.ts` / SDK `query` over direct SQL in agent-facing code

## Design Decisions

### kind and autoClose define the lifecycle policy

`autoClose` controls filesystem persistence (archive session dir to `history/` vs keep in-place).
It's an internal detail of the persistence layer, not a user-facing concept:
- Chat sessions use `autoClose: "never"` → dir stays in `sessions/` so they survive restarts
- Job/call sessions use `autoClose: "immediate"` → dir moves to `sessions/history/` on completion

Callers don't set it directly — it's derived from `kind`. Eventually, when we move to
pure-SQLite session tracking, `autoClose` disappears entirely.

`kind` ("chat" | "job" | "call") is both an observability tag and a lifecycle
policy selector. `kind: "chat"` with `autoClose: "never"` uses the persistent
chat-turn path (`running → idle`) rather than the bounded job path
(`running → done/error/interrupted`).

Heartbeats are `call` kind sessions — the workflow system uses `ctx.runAgent()` which produces `call` sessions. There's no separate "heartbeat" kind.
