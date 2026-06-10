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
  lastActivityAt  INTEGER           -- last tool-call timestamp (ms); added via migration. ⚠️ Partially populated: 211/12,333 sessions (1.7%) have a non-null value (as of 2026-06-11). Write path activated ~2026-06-09 17:33Z; 18% of sessions started after that timestamp are populated. Coverage is uneven: evaluator (105) and aks-explorer (79) populate consistently; other agents started populating ~2026-06-10 17:08Z. Zombie detection uses JSONL file mtime instead (see Known Issues).
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
(kind=`chat`) sessions. Verified 2026-06-11: 0 of 12,278 `call` sessions have a
non-null `parentSessionId`; all 13 sessions with `parentSessionId` are `job` or `chat` kind.

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

### `lastActivityAt` column: recently activated, partially populated

The `lastActivityAt` column was added via migration and is written by both
`updateSessionProgress()` (called on every `turn_start`/`tool_execution_start`/`turn_end`)
and `updateSessionDb()` (called at session end).

**Status (updated 2026-06-11 ~20:00Z):** The write path activated around
2026-06-09 17:33Z. Since then, 211 of 12,333 total sessions (1.7%) have a
non-null value. For sessions started after activation, coverage is ~18%
(211/1,165). Coverage is agent-dependent: evaluator (105 sessions) and
aks-explorer (79) began populating immediately; arc, scout, dev, and may
(6–8 each) started populating ~2026-06-10 17:08Z. tech-lead has 0 populated
sessions. The column is no longer "dead" — it is partially alive and trending
toward broader coverage.

The `capability.zombie-session-count` metric does NOT yet use this column.
Zombie detection in `metrics-snapshot.ts` (`sessionInactiveSince()`) checks
JSONL file `mtime` via `statSync(path).mtimeMs`, not the DB column.

Once coverage stabilizes above ~80% for all agents, this column becomes a
viable pure-SQL data source for zombie detection (eliminating the disk
`statSync` dependency). Monitor with:
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
