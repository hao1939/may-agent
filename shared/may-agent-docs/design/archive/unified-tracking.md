# Unified Request & Session Tracking

## Problem

The system has three separate tracking mechanisms that partially overlap:

1. **`requests` table** (SQLite) — tracks intent (who asked whom for what). Written from chat-session, socket-run, cli-send, agent-to-agent calls. Missing from `--task` and `--oneshot` paths. Summary field is NULL for most completed requests.

2. **`meta.json` per session** (disk) — tracks execution (what happened). Complete and reliable, but not queryable via SQL. Requires scanning thousands of files to answer questions like "what did scout do last week?"

3. **`human-inputs.jsonl`** (append-only file) — tracks raw human text. Only written from `ChatSession.handleInput()`. Missing `--task`, `--oneshot`, `--send`, socket-run-without-chatSession. Used by coach's reflect cron.

These systems don't distinguish between human and agent requests structurally — the only difference is `fromEntity: "human"` vs `fromEntity: "bob"`. A request is a request regardless of source.

### Specific gaps

- `--task` and `--oneshot` CLI modes create sessions but no request record
- Chat requests complete with `summary: NULL` — no outcome at a glance
- `parentRequestId` column exists but is never populated (0/3048 rows)
- Session metadata is not SQL-queryable — can't join sessions with requests or evaluations
- No `source` channel field — `fromEntity: "human"` doesn't distinguish telegram from console
- Coach's reflect cron reads `human-inputs.jsonl` instead of the requests table

## Design

Two tables, each tracking one concept:

- **`requests`** — what was asked (intent). Tracks the request lifecycle from creation to completion.
- **`sessions`** — what happened (execution). Queryable mirror of meta.json. Tracks the session tree.

They link bidirectionally: requests have `sessionId`, sessions have `requestId`. A request creates a session. A session (via agent delegation) can create child requests, which create child sessions.

```
Human types "investigate the tool system"
  │
  ├─ request (human → may, method=chat, source=telegram)
  │    └─ session (may, kind=chat)
  │         │
  │         ├─ request (may → bob, method=call, source=agent)
  │         │    └─ session (bob, kind=call, parentSessionId=may's)
  │         │
  │         └─ request (may → tech-lead, method=call, source=agent)
  │              └─ session (tech-lead, kind=call, parentSessionId=may's)
  │                   ├─ session (coder, kind=call, parentSessionId=tech-lead's)
  │                   └─ session (qa, kind=call, parentSessionId=tech-lead's)
```

### Schema changes

**`requests` table** — add one column:

```sql
ALTER TABLE requests ADD COLUMN source TEXT;
-- Values: "console", "telegram", "socket", "cli-task", "cli-send", "cli-oneshot", "cron", "agent"
```

**`sessions` table** — new:

```sql
CREATE TABLE IF NOT EXISTS sessions (
  sessionId       TEXT PRIMARY KEY,
  agent           TEXT NOT NULL,
  task            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'running',
  kind            TEXT,            -- "chat", "job", "call"
  source          TEXT,            -- "console", "telegram", "cron", "agent", "cli-task", etc.
  parentSessionId TEXT,            -- self-referential FK for session tree
  requestId       TEXT,            -- link to requests table
  workflowRunId   TEXT,
  startedAt       INTEGER NOT NULL,
  endedAt         INTEGER,
  error           TEXT,
  outcome         TEXT,            -- 1-3 sentence summary extracted from finish() or last assistant text
  opCount         INTEGER DEFAULT 0
);
```

### Principles

1. **Non-blocking.** Every DB write is wrapped in try/catch. If SQLite is unavailable, sessions still run. The meta.json on disk remains the source of truth for session state. The sessions table is a queryable index, not a gate.

2. **Unified.** No separate treatment for human vs agent requests. `fromEntity` and `source` are just fields to filter on. The same table, same schema, same lifecycle.

3. **Linked.** Request → Session via `sessionId`. Session → parent via `parentSessionId`. Session → Request via `requestId`. Full chain is walkable via SQL joins.

4. **Outcome populated.** When a session completes, extract a summary from the agent's `finish()` tool call (if present) or the last assistant text block. Write it to both the sessions table (`outcome` column) and the requests table (`summary` column). This makes the requests table useful at a glance without reading transcripts.

5. **Interface for testability.** `SessionStore` interface on `RegistryStore` so tests/gym can swap in a mock. The interface is just the 4 methods the manager already calls — zero refactoring cost.

### Implementation

**File changes:**

| File | Change |
|------|--------|
| `src/lib/requests.ts` | Add `sessions` table to schema. Add `source` to `requests` schema + `TrackRequestOpts` + INSERT. Add `upsertSession()` and `updateSessionDb()` helpers. |
| `src/lib/persistence.ts` | Add `SessionStore` interface. `RegistryStore implements SessionStore`. `saveSession()` and `updateSessionStatus()` call the DB helpers (try/catch wrapped). |
| `src/lib/manager.ts` | On session completion, extract outcome from `finish()` or last assistant text and pass it to `updateRequest()` (the call site already exists — just add `summary` field). |
| `src/app/may.ts` | Add `trackRequest()` to `--task` and `--oneshot` paths. Thread `source` through existing `trackRequest()` calls. |
| `src/app/chat-session.ts` | Thread `source` ("console", "telegram", "socket") through `trackRequest()` calls. |
| `src/lib/handler-context.ts` | Add `source` to `TrackRequestOpts` type. |
| `src/lib/index.ts` | Export `SessionStore` type. |

**What stays unchanged:**
- `meta.json` — still written, still source of truth
- `human-inputs.jsonl` — still written (deprecation candidate, but no rush)
- Existing request tracking call sites — just add optional `source` field
- Manager's session lifecycle — saveSession/updateSessionStatus already called at the right points

### Queries enabled

After implementation, these become possible:

```sql
-- What did human ask in the last 7 days, and what happened?
SELECT r.task, r.status, r.summary, r.source, s.agent, s.outcome, s.endedAt - s.startedAt as durationMs
FROM requests r
LEFT JOIN sessions s ON r.sessionId = s.sessionId
WHERE r.fromEntity = 'human' AND r.createdAt > ?
ORDER BY r.createdAt DESC;

-- Full delegation tree for a human request
WITH RECURSIVE tree AS (
  SELECT sessionId, agent, task, status, outcome, parentSessionId, 0 as depth
  FROM sessions WHERE sessionId = ?
  UNION ALL
  SELECT s.sessionId, s.agent, s.task, s.status, s.outcome, s.parentSessionId, t.depth + 1
  FROM sessions s JOIN tree t ON s.parentSessionId = t.sessionId
)
SELECT * FROM tree ORDER BY depth;

-- Agent workload last 24h
SELECT agent, COUNT(*) as sessions, 
  SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
  AVG(endedAt - startedAt) as avgDurationMs
FROM sessions WHERE startedAt > ? GROUP BY agent;

-- Unresolved human requests
SELECT r.requestId, r.task, r.toAgent, r.createdAt
FROM requests r
WHERE r.fromEntity = 'human' AND r.status NOT IN ('COMPLETED', 'FAILED')
ORDER BY r.createdAt;

-- Join sessions with evaluations
SELECT s.sessionId, s.agent, s.outcome, e.quality, e.efficiency, e.verdict
FROM sessions s
JOIN evaluations e ON s.sessionId = e.sessionId
WHERE s.startedAt > ?
ORDER BY e.quality ASC;
```

### For coach reflect

Update the reflect cron to query the requests table:

```sql
SELECT requestId, fromEntity, toAgent, task, status, summary, source, createdAt
FROM requests
WHERE createdAt > ?lastAnalyzedTs
ORDER BY createdAt ASC
```

This gives the coach intent + outcome in one query. No need to separately read `human-inputs.jsonl` and chase session transcripts. When deeper analysis is needed, follow `sessionId` → `.state/sessions/history/<sessionId>/session.jsonl` for the full transcript.

### Migration

The schema uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`, so adding new tables is safe on existing databases. The `source` column on `requests` uses `ALTER TABLE ADD COLUMN` which SQLite handles gracefully — existing rows get NULL.

Add migration after schema exec in `getDb()`:

```typescript
// Migration: add source column to requests (idempotent)
try { db.exec("ALTER TABLE requests ADD COLUMN source TEXT"); } catch { /* already exists */ }
```

### Future

- `human-inputs.jsonl` can be deprecated once coach reflect uses the requests table
- The `--status` dashboard can show session trees for human requests
- Optimizer can query `sessions JOIN evaluations` directly for pattern analysis
- Convention checks can join with sessions for richer context
