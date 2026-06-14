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
  error           TEXT,             -- ⚠️ almost always NULL in practice due to db-writer race (KE-1558, KE-1985); check as bonus signal but use meta.json on disk for reliable error text
  outcome         TEXT,
  opCount         INTEGER DEFAULT 0,
  stepLabel       TEXT,             -- workflow step label (in practice, always equals `agent` when non-null)
  lastActivityAt  INTEGER           -- last tool-call timestamp (ms); added via migration. ✅ Fully populated for new sessions (100% of 6h/12h/24h windows, all 7 active agents, verified 2026-06-13). Write path activated ~2026-06-09 17:33Z. Pure-SQL zombie detection precondition met for ≤24h windows. See Known Issues for transition details.
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
`parentSessionId` is only populated by `agents.fork()` (kind=`job`) sessions.
Verified structurally: no `call` session has ever had a non-null
`parentSessionId`; all sessions with `parentSessionId` are `job` or `chat` kind.
(Last census: 0/15,952 call sessions, 18 total with parentSessionId — 10 job, 8 chat.)

## Persistence

Sessions persist to:
1. **SQLite** (`sessions` table) — for SQL queries, dashboard, status checks
2. **Disk** (`.state/sessions/<id>/meta.json`) — full metadata, messages

The DB is the queryable index. Disk is the source of truth for message history.

## Known Issues

### `error` column is almost always NULL in practice (KE-1558, updated KE-1985)

The `sessions.error` column in SQLite is **almost always NULL in practice**
due to a write-order race between `manager.ts` (writes errorText correctly)
and `db-writer.ts` (overwrites with NULL via `session.end` event, which
lacks the `error` field). `updateSessionDb()` uses bare `error = ?`
instead of `COALESCE(?, error)`.

**However, as of 2026-06-14**, the race is not 100% reliable — at least one
error session (`s_1781463007643_5`, may, 2026-06-14 18:57Z) has a surviving
non-NULL error text ("Agent ended with an empty assistant turn") despite
having a populated `endedAt`. Census (updated 2026-06-14 21:30Z): 3/668
error sessions in the 7d retention window (0.45%), all from may with
identical error text "Agent ended with an empty assistant turn" — all from
`workflow:platform-owner-review` context-cascade sessions. This may indicate
a timing change in the write path or a new code path that writes error after
the `session.end` event.

**Guidance:** Do not rely on `sessions.error` for comprehensive error analysis
(still NULL for ~99.7% of error sessions). But do not assume it is *always*
NULL — check it as a bonus signal. For reliable error text, read
`.state/sessions/history/<id>/meta.json` on disk.

**Workaround:** For sessions closed through the normal `manager.ts` path, read
`.state/sessions/history/<id>/meta.json` on disk for the actual error text.
The `error` field in `meta.json` contains the correct value (e.g., "Agent ended
on an empty tool-use assistant turn").

**Fix pending:** Requires either adding `error` to the `session.end` bus event
data, or changing the UPDATE to use COALESCE. Both are `src/` changes requiring
Hao approval (ORDER-010).

### `lastActivityAt` column: fully populated

The `lastActivityAt` column was added via migration and is written by both
`updateSessionProgress()` (called on every `turn_start`/`tool_execution_start`/`turn_end`)
and `updateSessionDb()` (called at session end).

**Status (updated 2026-06-14):** The write path activated around
2026-06-09 17:33Z. As of 2026-06-14, **100% coverage across all 7 active
agents** in 24h windows (1878/1878 sessions populated). The pre-activation
transition period and the 2 sub-second evaluator exceptions noted in the
2026-06-13 census have fully aged out.

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
