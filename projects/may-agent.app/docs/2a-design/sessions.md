# Sessions

**Design status:** Accepted.
**Implementation status:** Partial; per-turn chat trace propagation and the
known persistence issues below remain convergence work.

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
  error           TEXT,             -- ⚠️ almost always NULL in practice due to db-writer race (KE-1558, KE-1985); check as bonus signal but use meta.json on disk for reliable error text
  outcome         TEXT,
  opCount         INTEGER DEFAULT 0,
  stepLabel       TEXT,             -- workflow step label (in practice, always equals `agent` when non-null)
  lastActivityAt  INTEGER           -- last tool-call timestamp (ms); added via migration. ✅ Fully populated for new sessions (100% of 6h/12h/24h windows, all 7 active agents, verified 2026-06-13). Write path activated ~2026-06-09 17:33Z. Pure-SQL zombie detection precondition met for ≤24h windows. See Known Issues for transition details.
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

`requestId` is a compatibility/correlation field when an exact opening event id
is unavailable. It is not the canonical identity of human work; the persisted
opening event id and trace are authoritative.

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

## Known Issues

### `status` column can contain non-canonical values (KE-2062)

Three `may` chat sessions have `status = 'Agent ended with an empty assistant
turn'` instead of the canonical `'error'`. The error message string leaked
into the status column — likely during a bulk-close of stale chat sessions
(all three share `endedAt` within 3ms). Their `outcome` column correctly
reads `'error'`, so `WHERE outcome = 'error'` catches them but
`WHERE status = 'error'` does not. Census 2026-06-19: 3/16,256 sessions
(0.02%) have non-canonical status values — all are this same error string.
Use `outcome = 'error'` when error completeness matters; `status = 'error'`
for the common case but accept it may undercount chat failures.

### `error` column is almost always NULL in practice (KE-1558, updated KE-1985)

The `sessions.error` column in SQLite is **almost always NULL in practice**
due to a write-order race between `manager.ts` (writes errorText correctly)
and `db-writer.ts` (overwrites with NULL via `session.end` event, which
lacks the `error` field). `updateSessionDb()` uses bare `error = ?`
instead of `COALESCE(?, error)`.

**However, as of 2026-06-14**, the race is not 100% reliable — some
error sessions survive with non-NULL error text despite having a populated
`endedAt`. Census (updated 2026-06-18 13:30Z): 3/641 error sessions in
the 14d retention window (0.47%) have surviving error text. Two are may
sessions from `telegram` source with "Agent ended with an empty assistant
turn"; one is an aks-explorer session from `workflow:task-worker` with a
task-moved-to-retry error. This may indicate timing differences in the
write path depending on session source/kind — non-workflow sessions
(telegram) and task-retry errors may write error text after the
`session.end` event, or the event may not fire for these paths.

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
