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
  status          TEXT NOT NULL DEFAULT 'running',  -- running | done | error | interrupted (idle is reserved but unused in practice)
  kind            TEXT,             -- chat | job | call
  source          TEXT,             -- what triggered it
  parentSessionId TEXT,             -- who spawned this session
  requestId       TEXT,
  workflowRunId   TEXT,
  projectId       TEXT,
  startedAt       INTEGER NOT NULL,
  endedAt         INTEGER,
  error           TEXT,             -- ⚠️ universally NULL due to db-writer race (KE-1558); use meta.json on disk for error text
  outcome         TEXT,
  opCount         INTEGER DEFAULT 0,
  stepLabel       TEXT,             -- workflow step label (in practice, always equals `agent` when non-null)
  lastActivityAt  INTEGER           -- last tool-call timestamp (ms); added via migration. ✅ Fully populated for new sessions (100% of 6h, 12h, and 24h windows, all 8 agents, verified 2026-06-11). Write path activated ~2026-06-09 17:33Z. Pure-SQL zombie detection precondition met for ≤24h windows. See Known Issues for transition details.
);
```

## State Machine

```
created → running → idle      (reserved for chat sessions; currently unused)
                  → done      (completed job/call sessions)
                  → error
                  → interrupted
```

No "pending" or "queued" state. Sessions start running immediately when spawned.
Heartbeats are `call` sessions spawned by the heartbeat workflow via `ctx.runAgent()`. Query by `source LIKE '%heartbeat%'`, not by `kind`.

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
`parentSessionId` is only populated by `agents.fork()` (kind=`job`) and `may-console`
(kind=`chat`) sessions. Verified 2026-06-12: 0 of 13,168 `call` sessions have a
non-null `parentSessionId`; all 14 sessions with `parentSessionId` are `job` or `chat` kind.

## Persistence

Sessions persist to:
1. **SQLite** (`sessions` table) — for SQL queries, dashboard, status checks
2. **Disk** (`.state/sessions/<id>/meta.json`) — full metadata, messages

The DB is the queryable index. Disk is the source of truth for message history.

## Known Issues

### `error` column is always NULL (KE-1558)

The `sessions.error` column in SQLite is universally NULL — including for all
error sessions. A write-order race between `manager.ts` (writes errorText
correctly) and `db-writer.ts` (overwrites with NULL via `session.end` event,
which lacks the `error` field) causes the manager's value to be lost.
`updateSessionDb()` uses bare `error = ?` instead of `COALESCE(?, error)`.

**Workaround:** Read `.state/sessions/history/<id>/meta.json` on disk for the
actual error text. The `error` field in `meta.json` contains the correct value
(e.g., "Agent ended on an empty tool-use assistant turn").

**Fix pending:** Requires either adding `error` to the `session.end` bus event
data, or changing the UPDATE to use COALESCE. Both are `src/` changes requiring
Hao approval (ORDER-010).

### `lastActivityAt` column: fully populated

The `lastActivityAt` column was added via migration and is written by both
`updateSessionProgress()` (called on every `turn_start`/`tool_execution_start`/`turn_end`)
and `updateSessionDb()` (called at session end).

**Status (updated 2026-06-12 ~16:15Z):** The write path activated around
2026-06-09 17:33Z. As of 2026-06-12 16:15Z, **100% of sessions in
6h and 12h trailing windows have a non-null `lastActivityAt`** across all
8 agents (12h: 601/601). 24h coverage is **98.1% (1072/1093)** —
the remaining ~2% are the oldest sessions in the 24h window from the
pre-activation transition period, continuing to age out.

**The precondition for pure-SQL zombie detection is now met** for windows
up to **24h** (≥95% coverage). The `capability.zombie-session-count`
metric still uses JSONL file `mtime` via `statSync(path).mtimeMs` in
`metrics-snapshot.ts` (`sessionInactiveSince()`). A `src/` change
(ORDER-010) could switch zombie detection to
`WHERE status='running' AND lastActivityAt <
strftime('%s','now')*1000 - 1800000` for the 24h window without
meaningful false negatives.

Monitor ongoing coverage with:
```sql
SELECT agent, COUNT(*) as total,
       SUM(CASE WHEN lastActivityAt IS NOT NULL THEN 1 ELSE 0 END) as populated
FROM sessions WHERE startedAt > strftime('%s','now')*1000 - 86400000
GROUP BY agent;
```

## Data Retention

The `db-retention` handler (`agents/may/handlers/db-retention.ts`, daily cron)
deletes sessions where `startedAt < now - 14 days`. This means SQL queries
against `sessions` older than 14 days return empty results. For longer-term
session analysis, use disk artifacts (`.state/sessions/history/<id>/meta.json`)
if they have not been cleaned separately.

See `events.md` → "Data Retention" for the full retention table.

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

Heartbeats are `call` kind sessions — the workflow system uses `ctx.runAgent()` which produces `call` sessions. There's no separate "heartbeat" kind.
