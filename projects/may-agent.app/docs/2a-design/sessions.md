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
1. **Disk** (`meta.json`, `session.jsonl`, and terminal `result.json`) — full
   task, conversation, and result artifacts
2. **SQLite** (`sessions` table) — bounded lifecycle/lineage projection, task
   preview, and artifact reference/hash/size

Disk is the source of truth for full session content. The DB is the queryable
index. See [storage.md](storage.md) for the cross-record storage contract.

## Persistence Integrity

The manager registers live state before emitting `session.start`. The event is
persisted before side-effect subscribers run; if persistence fails, manager
state is rolled back and the registry records the start error. Consumers must
therefore never observe a durable session start for an unregistered session.

Terminal `session.end` data includes `status`, `outcome`, and `error`. The
runtime writes those fields to terminal `result.json` and projects the bounded
lifecycle fields into SQLite. Disk remains the full transcript/result source,
while SQLite is the canonical bounded read model for lifecycle queries.

`lastActivityAt` is updated by progress and terminal writes. Stale-session
checks may use it directly; historical rows created before the field existed
remain migration data rather than a reason to weaken the current contract.

## Data Retention

Runtime maintenance expires old SQL projections in bounded batches. It does not
delete a live record merely because its original task is large: new task text
is bounded in SQL by construction and the full task stays in `meta.json`.
Longer-term analysis uses the same `.state/sessions/<id>/` path. Terminal state
is metadata; it is not a filesystem location.

See `events.md` → "Data Retention" for the full retention table.

## Implementation

- **Manager:** `projects/may-agent/src/lib/manager.ts` — spawns/manages sessions
- **DB writes:** `projects/may-agent/src/lib/db-writer.ts` and `projects/may-agent/src/lib/db/sessions.ts`
- **DB schema:** `projects/may-agent/src/lib/db/schema.ts`
- **Queries:** prefer `projects/may-agent/src/lib/query-service.ts` / SDK `query` over direct SQL in agent-facing code

## Design Decisions

### kind and autoClose define the lifecycle policy

`autoClose` controls lifecycle state only. It never controls filesystem
location and is not a user-facing concept:
- Chat sessions use `autoClose: "never"` → successful turns become `idle`
- Job/call sessions use `autoClose: "immediate"` → completion becomes terminal

Callers don't set it directly — it's derived from `kind`. `autoClose` remains a
lifecycle policy; every kind retains the same permanent session directory and
the design does not move full sessions into SQLite.

### Permanent path invariant

For session `s_123`, every artifact stays below `.state/sessions/s_123/`.
Closing, resuming, process recovery, evaluation, and retention must not rename
that directory. `[ACTIVE]` marks sessions that the runtime may resume; status
in `meta.json` and SQLite records the lifecycle. `[STARTED]` is only a turn/crash
sentinel. Neither marker changes the artifact path.

`kind` ("chat" | "job" | "call") is both an observability tag and a lifecycle
policy selector. `kind: "chat"` with `autoClose: "never"` uses the persistent
chat-turn path (`running → idle`) rather than the bounded job path
(`running → done/error/interrupted`).

Heartbeats are `call` kind sessions — the workflow system uses `ctx.runAgent()` which produces `call` sessions. There's no separate "heartbeat" kind.
