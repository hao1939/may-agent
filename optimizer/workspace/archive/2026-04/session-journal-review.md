# Session Journal v2 — Unified Schema Design

**Author**: Optimizer  
**Date**: 2026-04-05  
**Status**: Refined design — aligned with Hao's 3 decisions  
**Supersedes**: `design-session-digest-storage.md` (single-row-per-session model)

---

## 0. Hao's Decisions (Constraints)

1. **DB TABLE as single store.** No JSONL duplication. SQL table is the sole persistent store for session digests. Bob's context injection reads from SQL, not separate JSONL files.
2. **Incremental writes**: `session_start` (no LLM), `turn_end` (no LLM, structured extraction), `session_end` (one cheap LLM call on ~2-3KB of accumulated entries).
3. **LLM summary at end** answers: what was the task, what was understood, what was done, what worked, what failed and why, what's still open.

---

## 1. Key Schema Change: Incremental Rows

### Why not one row per session?

My v1 design used a single `session_digests` row per session with UPSERT. This works but has problems:

1. **Mid-session visibility is lossy.** Turn-level data (which tools were called, what files were touched, error sequences) gets overwritten by the next turn's update. You only see the latest snapshot.
2. **Recovery needs history.** To detect "stuck in a loop" you need the sequence of turns, not just "consecutive_error_turns = 4". Was it 4 errors on the same tool call? 4 different failures? The single-row model can't answer this.
3. **LLM summary input.** Hao's decision #3 requires feeding ~2-3KB of accumulated entries to an LLM at session_end. If turns are individual rows, we just `SELECT * FROM session_journal WHERE sessionId = ? ORDER BY seq` to build the LLM prompt. Clean, no separate accumulation needed.
4. **Audit trail.** Individual turn entries create a queryable log of what happened and when, without parsing JSONL transcripts.

### The new model

Each session produces **multiple rows** in `session_journal`:
- 1 `start` entry (created at session_start, no LLM)  
- N `turn` entries (one per turn_end, no LLM)
- 1 `end` entry (created at session_end, includes LLM-generated summary)

A session with 15 turns produces 17 rows. This is ~3-5x more rows than the single-row model, but each row is smaller and the total data per session is similar.

---

## 2. Schema

### 2a. Table: `session_journal`

```sql
CREATE TABLE IF NOT EXISTS session_journal (
  -- Identity
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId           TEXT NOT NULL,
  agent               TEXT NOT NULL,
  
  -- Entry type and ordering
  phase               TEXT NOT NULL CHECK(phase IN ('start', 'turn', 'end')),
  seq                 INTEGER NOT NULL,    -- 0 for start, 1..N for turns, N+1 for end
  
  -- Phase-specific structured data (JSON object)
  data                TEXT NOT NULL,       -- JSON, schema depends on phase
  
  -- Timestamps
  created_at          INTEGER NOT NULL,
  
  -- Uniqueness: one entry per session per sequence number
  UNIQUE(sessionId, seq)
);
```

### 2b. The `data` Column by Phase

#### Phase: `start`
```json
{
  "task": "string (first 500 chars)",
  "taskSource": "heartbeat|directive|escalation|call|workflow|send|cron|task",
  "parentSessionId": "string|null",
  "requestId": "string|null",
  "workflowRunId": "string|null"
}
```

#### Phase: `turn`
```json
{
  "turnNumber": 1,
  "toolCalls": ["read", "bash", "edit", "agents"],
  "toolCallCount": 4,
  "filesRead": ["src/lib/foo.ts"],
  "filesWritten": ["src/lib/bar.ts"],
  "errorCount": 0,
  "errors": [],
  "progressNote": "string|null"
}
```

`progressNote` is extracted structurally (not LLM): it's the checkpoint summary if a checkpoint was called this turn, or null otherwise.

#### Phase: `end`
```json
{
  "status": "success|failure|blocked|partial|error|interrupted",
  "rootCause": "turn_limit|provider_error|stuck|crash|interrupted|closed_by_user|null",
  "error": "string|null",
  
  "finishParams": {
    "summary": "string|null",
    "deliverables": [{"path": "...", "description": "..."}],
    "completedItems": ["..."],
    "newItems": ["..."],
    "blockers": [{"reason": "...", "context": "..."}],
    "nextSteps": "string|null",
    "lessons": [{"category": "fix|pattern|insight", "content": "..."}],
    "verification": ["..."]
  },
  
  "llmSummary": "string|null",
  
  "turnsCompleted": 15,
  "totalOps": 42,
  "resumePoint": "string|null",
  "resumeAttempted": 0
}
```

### 2c. Why JSON `data` Column Instead of Flat Columns?

The v1 design had ~20 columns. This was fine for single-row-per-session but becomes unwieldy for the incremental model where each phase has different fields.

**Advantages of JSON `data`**:
- Each phase has its own schema — no NULL columns for fields irrelevant to other phases
- Adding new fields doesn't require ALTER TABLE
- The `data` column for `turn` entries can evolve (add `tokensUsed`, `costUsd`, etc.) without migration

**Disadvantage**: Can't directly index fields inside `data`. But we mitigate this with **the session_digest_summary view/table** (see §3).

### 2d. Indexes on `session_journal`

```sql
-- Primary query: get all entries for a session in order
CREATE INDEX IF NOT EXISTS idx_journal_session 
  ON session_journal(sessionId, seq);

-- Find entries by agent and time
CREATE INDEX IF NOT EXISTS idx_journal_agent_time 
  ON session_journal(agent, created_at);

-- Find all end entries (for dashboard/recovery queries)
CREATE INDEX IF NOT EXISTS idx_journal_phase_time 
  ON session_journal(phase, created_at) WHERE phase = 'end';

-- Find all start entries (for session listing)
CREATE INDEX IF NOT EXISTS idx_journal_start 
  ON session_journal(phase, created_at) WHERE phase = 'start';
```

---

## 3. Materialized Summary View: `session_digest`

For dashboard queries, recovery, and circuit breakers, we need fast access to per-session aggregate data without scanning all turn entries. Solution: a **summary row** that's maintained automatically.

```sql
CREATE TABLE IF NOT EXISTS session_digest (
  sessionId           TEXT PRIMARY KEY,
  agent               TEXT NOT NULL,
  
  -- From start entry
  task_summary        TEXT,
  task_source         TEXT,
  parent_session_id   TEXT,
  request_id          TEXT,
  workflow_run_id     TEXT,
  
  -- Aggregated from turn entries
  turns_completed     INTEGER DEFAULT 0,
  total_ops           INTEGER DEFAULT 0,
  last_progress_at    INTEGER,
  consecutive_error_turns INTEGER DEFAULT 0,
  files_modified      TEXT,           -- JSON array (union of all turns' filesWritten)
  
  -- From end entry
  status              TEXT,
  root_cause          TEXT,
  error               TEXT,
  summary             TEXT,           -- Agent's finish() summary
  llm_summary         TEXT,           -- LLM-generated narrative summary
  next_steps          TEXT,
  resume_point        TEXT,
  resume_attempted    INTEGER DEFAULT 0,
  deliverables        TEXT,           -- JSON array
  blockers            TEXT,           -- JSON array
  lessons             TEXT,           -- JSON array
  
  -- Timestamps
  started_at          INTEGER NOT NULL,
  ended_at            INTEGER,
  
  -- For recovery
  UNIQUE(sessionId)
);
```

### 3a. Summary Indexes

```sql
-- Dashboard: recent sessions by agent
CREATE INDEX IF NOT EXISTS idx_summary_agent 
  ON session_digest(agent, started_at);

-- Recovery: find failures
CREATE INDEX IF NOT EXISTS idx_summary_status 
  ON session_digest(status, started_at);

-- Recovery: circuit breaker
CREATE INDEX IF NOT EXISTS idx_summary_agent_status 
  ON session_digest(agent, status, started_at);

-- Failure analysis
CREATE INDEX IF NOT EXISTS idx_summary_root_cause 
  ON session_digest(root_cause, started_at) WHERE root_cause IS NOT NULL;

-- Tree traversal
CREATE INDEX IF NOT EXISTS idx_summary_parent 
  ON session_digest(parent_session_id) WHERE parent_session_id IS NOT NULL;

-- Request audit trail
CREATE INDEX IF NOT EXISTS idx_summary_request 
  ON session_digest(request_id) WHERE request_id IS NOT NULL;
```

### 3b. How the Summary Is Maintained

The summary row is written/updated at each phase — it's a **denormalized cache** of the journal entries:

```typescript
// On session_start: INSERT the summary row
function onSessionStart(event) {
  const source = classifyTaskSource(event.task);
  db.run(`INSERT OR REPLACE INTO session_digest 
    (sessionId, agent, task_summary, task_source, parent_session_id, 
     request_id, workflow_run_id, started_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [event.sessionId, event.agent, event.task.slice(0, 500), source,
     event.parentSessionId, lookupRequestId(event.sessionId),
     event.workflowRunId, Date.now()]);
}

// On turn_end: UPDATE progress fields
function onTurnEnd(event) {
  db.run(`UPDATE session_digest SET
    turns_completed = ?,
    total_ops = total_ops + ?,
    last_progress_at = ?,
    consecutive_error_turns = CASE 
      WHEN ? > 0 THEN consecutive_error_turns + 1 
      ELSE 0 
    END,
    files_modified = ?
    WHERE sessionId = ?`,
    [event.turnCount, event.toolCalls ?? 0, Date.now(),
     event.errorCount ?? 0, 
     mergeFilesModified(event.sessionId, event.filesWritten),
     event.sessionId]);
}

// On session_end: UPDATE outcome fields
function onSessionEnd(event) {
  db.run(`UPDATE session_digest SET
    status = ?, root_cause = ?, error = ?,
    summary = ?, llm_summary = ?, next_steps = ?,
    resume_point = ?, deliverables = ?, blockers = ?,
    lessons = ?, ended_at = ?
    WHERE sessionId = ?`,
    [/* ... all end-phase fields ... */]);
}
```

---

## 4. LLM Summary at Session End

### 4a. Input Construction

At session_end, we build the LLM prompt from accumulated journal entries:

```typescript
async function generateLlmSummary(sessionId: string): Promise<string> {
  // Gather all journal entries for this session
  const entries = db.prepare(
    'SELECT phase, seq, data FROM session_journal WHERE sessionId = ? ORDER BY seq'
  ).all(sessionId) as Array<{phase: string, seq: number, data: string}>;
  
  // Build structured input (~2-3KB)
  const startData = JSON.parse(entries.find(e => e.phase === 'start')!.data);
  const turns = entries.filter(e => e.phase === 'turn').map(e => JSON.parse(e.data));
  const endData = entries.find(e => e.phase === 'end');
  const endParsed = endData ? JSON.parse(endData.data) : null;
  
  const input = buildSummaryInput(startData, turns, endParsed);
  
  // One cheap LLM call
  const summary = await llmCall({
    model: 'cheap',  // e.g. claude-3-haiku or gpt-4o-mini
    system: SUMMARY_SYSTEM_PROMPT,
    user: input,
    maxTokens: 500,
  });
  
  return summary;
}
```

### 4b. Summary System Prompt

```
You are summarizing a completed agent session. Answer these questions concisely:

1. What was the task?
2. What did the agent understand it to mean?
3. What was actually done? (key actions and files)
4. What worked?
5. What failed and why?
6. What's still open?

Be specific. Use file names, function names, error messages. 
Keep the total summary under 300 words.
```

### 4c. Input Format

```typescript
function buildSummaryInput(start, turns, end): string {
  let input = `## Task\n${start.task}\n\n`;
  
  input += `## Session Activity (${turns.length} turns)\n`;
  for (const t of turns) {
    const tools = t.toolCalls?.join(', ') || 'none';
    const files = [...(t.filesRead || []), ...(t.filesWritten || [])];
    const fileStr = files.length > 0 ? ` | files: ${files.join(', ')}` : '';
    const errStr = t.errorCount > 0 ? ` | errors: ${t.errorCount}` : '';
    input += `Turn ${t.turnNumber}: ${tools}${fileStr}${errStr}\n`;
    if (t.progressNote) input += `  → ${t.progressNote}\n`;
  }
  
  if (end) {
    input += `\n## Outcome\n`;
    input += `Status: ${end.status}\n`;
    if (end.finishParams?.summary) input += `Agent summary: ${end.finishParams.summary}\n`;
    if (end.error) input += `Error: ${end.error}\n`;
    if (end.finishParams?.deliverables?.length > 0) {
      input += `Deliverables: ${end.finishParams.deliverables.map(d => d.path).join(', ')}\n`;
    }
    if (end.finishParams?.blockers?.length > 0) {
      input += `Blockers: ${end.finishParams.blockers.map(b => b.reason).join('; ')}\n`;
    }
    if (end.finishParams?.nextSteps) {
      input += `Next steps: ${end.finishParams.nextSteps}\n`;
    }
  }
  
  return input;
}
```

### 4d. Cost Analysis

- Input: ~2-3KB ≈ 800-1200 tokens
- Output: ~300 words ≈ 400 tokens
- Model: Haiku-class (~$0.25/1M input, ~$1.25/1M output)
- **Cost per session: ~$0.0008** (~$0.16/day at 200 sessions/day)
- Latency: 1-3 seconds (acceptable since session is already ending)

### 4e. Failure Handling

If the LLM call fails (timeout, rate limit, etc.):
- Store `llm_summary = null` in both journal entry and summary table
- The agent's own `finish().summary` is still available as fallback
- Background job can retry failed summaries later

---

## 5. Context Injection (Replaces JSONL)

Since there's no JSONL store, the context injection system reads from SQL:

### 5a. Building the Session Briefing

```typescript
function buildSessionBriefing(agent: string, persistDir: string): string {
  const db = getDb(persistDir);
  
  // Last 10 sessions for this agent (from summary table)
  const recent = db.prepare(`
    SELECT sessionId, task_summary, status, summary, llm_summary,
           turns_completed, root_cause, next_steps, started_at, ended_at,
           files_modified, deliverables, lessons
    FROM session_digest
    WHERE agent = ?
    ORDER BY started_at DESC
    LIMIT 10
  `).all(agent);
  
  // Cross-agent activity (last 24h, other agents)
  const crossAgent = db.prepare(`
    SELECT agent, sessionId, task_summary, status, files_modified, started_at
    FROM session_digest
    WHERE agent != ? AND started_at > ?
    ORDER BY started_at DESC
    LIMIT 5
  `).all(agent, Date.now() - 24 * 60 * 60 * 1000);
  
  // Active lessons for this agent (from recent end entries)
  const lessons = db.prepare(`
    SELECT data FROM session_journal
    WHERE agent = ? AND phase = 'end'
    ORDER BY created_at DESC
    LIMIT 20
  `).all(agent);
  
  return compileBriefing(recent, crossAgent, lessons);
}
```

### 5b. Briefing Compilation

The compiler is a **pure function** (no LLM):
- **Continuity block** (~40% of ~1500 token budget): Last session's outcome + next_steps
- **Lessons block** (~30%): Deduplicated lessons from recent sessions
- **Cross-agent block** (~20%): What other agents did with shared files
- **Codebase state** (~10%): Recently modified files

This is essentially Bob's DigestCompiler (§5 of his doc) but reading from SQL instead of JSONL. The same algorithm, different data source.

---

## 6. Recovery System Queries

All recovery mechanisms query the `session_digest` summary table. No journal scanning needed for recovery decisions.

### 6a. Circuit Breaker

```sql
SELECT count(*) as recent_errors
FROM session_digest
WHERE agent = ?
  AND status IN ('error', 'failure')
  AND root_cause NOT IN ('closed_by_user')
  AND started_at > ?;  -- CB_PROBE_INTERVAL_MS ago
```

### 6b. Resumable Sessions

```sql
SELECT sessionId, agent, task_summary, root_cause, resume_point, 
       resume_attempted, turns_completed
FROM session_digest
WHERE status IN ('interrupted', 'error')
  AND resume_attempted < 2
  AND root_cause NOT IN ('closed_by_user', 'stuck')
  AND started_at > ?  -- max age for resume
ORDER BY started_at DESC;
```

### 6c. Agent Health Dashboard

```sql
SELECT 
  agent,
  count(*) as total,
  count(CASE WHEN status = 'success' THEN 1 END) as successes,
  count(CASE WHEN status IN ('failure', 'error') THEN 1 END) as failures,
  count(CASE WHEN root_cause = 'turn_limit' THEN 1 END) as turn_limits,
  count(CASE WHEN root_cause = 'stuck' THEN 1 END) as stuck_count,
  avg(turns_completed) as avg_turns,
  max(ended_at) as last_active
FROM session_digest
WHERE started_at >= ?
GROUP BY agent;
```

### 6d. Stuck Detection History (Uses Journal)

When the recovery classifier wants to understand *why* a session got stuck (not just that it did), it reads turn entries:

```sql
SELECT seq, json_extract(data, '$.toolCalls') as tools,
       json_extract(data, '$.errors') as errors,
       json_extract(data, '$.errorCount') as error_count
FROM session_journal
WHERE sessionId = ? AND phase = 'turn'
ORDER BY seq DESC
LIMIT 10;
```

This is the only recovery query that touches `session_journal` directly — all others use `session_digest`.

---

## 7. Turn Data Extraction (No LLM)

### 7a. What We Extract Per Turn

At `turn_end`, we extract structured data from the turn without an LLM call:

```typescript
function extractTurnData(event: TurnEndEvent): TurnData {
  return {
    turnNumber: event.turnCount,
    toolCalls: event.toolNames ?? [],        // which tools were called
    toolCallCount: event.toolCalls ?? 0,     // how many total calls
    filesRead: event.filesRead ?? [],        // files read this turn
    filesWritten: event.filesWritten ?? [],  // files written this turn
    errorCount: event.errorCount ?? 0,       // tool errors this turn
    errors: event.errors ?? [],              // error messages (truncated)
    progressNote: event.checkpointSummary ?? null, // from checkpoint() if called
  };
}
```

### 7b. Event Enrichment Needed

The current `turn_end` event doesn't carry `filesRead`, `filesWritten`, `toolNames`, or `errors`. These need to be extracted from the turn's tool calls before emitting the event:

```typescript
// In handleTurnEnd() or wherever turn_end is emitted:
function enrichTurnEndEvent(messages: Message[], turnStartIndex: number): TurnEndEnrichment {
  const turnMessages = messages.slice(turnStartIndex);
  const toolCalls = turnMessages
    .filter(m => m.role === 'assistant' && m.tool_calls)
    .flatMap(m => m.tool_calls!);
  
  const filesRead: string[] = [];
  const filesWritten: string[] = [];
  const toolNames: string[] = [];
  const errors: string[] = [];
  
  for (const tc of toolCalls) {
    toolNames.push(tc.function.name);
    const args = JSON.parse(tc.function.arguments);
    
    if (tc.function.name === 'read') {
      filesRead.push(args.path);
    } else if (tc.function.name === 'edit' || tc.function.name === 'write') {
      filesWritten.push(args.path);
    }
    // Could also extract bash commands, agent calls, etc.
  }
  
  // Check tool results for errors
  const toolResults = turnMessages.filter(m => m.role === 'tool');
  for (const tr of toolResults) {
    if (tr.content?.includes('Error') || tr.content?.includes('error')) {
      errors.push(tr.content.slice(0, 200));
    }
  }
  
  return { filesRead, filesWritten, toolNames, errors, errorCount: errors.length };
}
```

**This is the main implementation effort** — the event enrichment. Everything else (journal writes, summary maintenance, LLM summary) is straightforward once the events carry structured data.

---

## 8. Migration Plan

### Phase 1: Schema + Forward Writing (Day 1)

1. Add `CREATE TABLE session_journal` and `CREATE TABLE session_digest` to SCHEMA in `src/lib/requests.ts`
2. Add `createJournalWriter()` subscriber to `src/lib/session-subscribers.ts` — handles all 3 phases
3. Wire into EventBus in `src/app/may.ts`
4. **No LLM call yet** — `llm_summary` stays null in Phase 1. Agent's `finish().summary` provides the summary.

### Phase 2: Event Enrichment (Day 1-2)

1. Enrich `turn_end` events with filesRead, filesWritten, toolNames, errors
2. This is likely in `src/lib/manager.ts` or wherever turn completion is handled
3. **This is the risky change** — modifying the event shape. Must be backward-compatible (new fields are optional).

### Phase 3: LLM Summary (Day 2-3)

1. Add `generateLlmSummary()` function
2. Call it in the `session_end` handler, after writing the `end` journal entry
3. Update both `session_journal.data.llmSummary` and `session_digest.llm_summary`
4. Handle failures gracefully (null fallback)

### Phase 4: Context Injection (Day 3-4)

1. Add `buildSessionBriefing()` function
2. Integrate into `buildSessionContext()` in `src/lib/manager.ts`
3. This replaces/augments the current `## Recent Task History` section

### Phase 5: Recovery Migration (Day 4-5)

1. Circuit breaker → SQL query on `session_digest`
2. Auto-resume → check `resume_attempted` from `session_digest`
3. P62 recovery → check `resume_attempted` from `session_digest`
4. Remove in-memory Maps

### Phase 6: Backfill (Day 5)

```sql
-- Backfill session_digest from existing sessions table
INSERT OR IGNORE INTO session_digest 
  (sessionId, agent, task_summary, status, root_cause, error,
   summary, parent_session_id, total_ops, started_at, ended_at)
SELECT 
  s.sessionId, s.agent, substr(s.task, 1, 500),
  CASE 
    WHEN s.status = 'done' THEN 'success'
    WHEN s.status = 'running' THEN 'interrupted'
    ELSE s.status
  END,
  CASE
    WHEN s.error LIKE '%Turn limit%' THEN 'turn_limit'
    WHEN s.error LIKE '%litellm%' OR s.error LIKE '%BadRequest%' THEN 'provider_error'
    WHEN s.error LIKE '%Stuck:%' THEN 'stuck'
    WHEN s.error LIKE '%Request was aborted%' THEN 'interrupted'
    WHEN s.error LIKE '%Closed%' THEN 'closed_by_user'
    WHEN s.status = 'error' THEN 'crash'
    ELSE NULL
  END,
  s.error, s.outcome, s.parentSessionId, s.opCount,
  s.startedAt, COALESCE(s.endedAt, s.startedAt)
FROM sessions s;
```

No backfill for `session_journal` — turn-level data doesn't exist for historical sessions. Only `session_digest` summaries are backfilled.

---

## 9. Two Tables vs One: The Tradeoff

### Why two tables?

| Concern | `session_journal` (log) | `session_digest` (summary) |
|---------|-------------------------|---------------------------|
| Write pattern | Append-only (INSERT) | Upsert (INSERT + UPDATE) |
| Rows per session | 3-20 | 1 |
| Primary consumer | LLM summary generator, audit, stuck analysis | Dashboard, recovery, context injection |
| Query pattern | `WHERE sessionId = ? ORDER BY seq` | `WHERE agent = ? ORDER BY started_at` |
| Index pressure | Low (sessionId+seq, agent+time) | High (6 indexes for various query patterns) |

They serve different access patterns. The journal is the **source of truth** (append-only log). The digest is a **materialized view** (denormalized for fast queries).

### Could we use just one table?

Yes, with `phase = 'end'` filtering for dashboard queries. But:
- Every recovery/dashboard query would need `WHERE phase = 'end'` — easy to forget
- The partial indexes would be larger (scanning past turn entries)  
- The summary fields would only exist on `end` rows, making `start` and `turn` rows mostly NULL
- Aggregating turn-level data (total ops, files_modified union) would require `GROUP BY sessionId` or subqueries

The two-table approach is cleaner. The cost is maintaining consistency — but since both are written by the same subscriber, this is straightforward.

### Alternative: Just `session_digest` (one table, one row per session)

If the LLM summary input can be built from the structured data available at session_end (not from turn-by-turn journal), we could skip `session_journal` entirely and keep the simpler model:

- On `turn_end`: UPDATE `session_digest` with cumulative fields
- On `session_end`: UPDATE with outcome + LLM summary
- Accumulate turn data in memory during the session (it's already there in the agent's message array)

**This is actually viable.** The LLM summary input doesn't need to come from the DB — it can be built from the in-memory message array at session_end time, then persisted in the `end` journal entry for audit purposes.

**Recommendation**: Start with **just `session_digest`** (the simpler model). Add `session_journal` later only if we need queryable turn-level data. The LLM summary can be generated from in-memory data at session_end.

---

## 10. Recommended Final Schema (Minimal Viable)

If we go with the "just `session_digest`" approach (one table, one row per session), the schema is almost identical to my v1 with two additions:

```sql
CREATE TABLE IF NOT EXISTS session_digest (
  -- Identity
  sessionId           TEXT PRIMARY KEY,
  agent               TEXT NOT NULL,
  
  -- From start (written on session_start, no LLM)
  task_summary        TEXT,
  task_source         TEXT,
  parent_session_id   TEXT,
  request_id          TEXT,
  workflow_run_id     TEXT,
  
  -- Updated incrementally (on each turn_end, no LLM)
  turns_completed     INTEGER DEFAULT 0,
  total_ops           INTEGER DEFAULT 0,
  last_progress_at    INTEGER,
  consecutive_error_turns INTEGER DEFAULT 0,
  files_modified      TEXT,           -- JSON array, accumulated across turns
  
  -- Written at end (on session_end)
  status              TEXT,
  root_cause          TEXT,
  error               TEXT,
  summary             TEXT,           -- Agent's finish().summary
  llm_summary         TEXT,           -- NEW: LLM-generated narrative (Hao decision #3)
  deliverables        TEXT,           -- JSON array
  completed_items     TEXT,           -- JSON array
  new_items           TEXT,           -- JSON array
  blockers            TEXT,           -- JSON array
  next_steps          TEXT,
  lessons             TEXT,           -- JSON array
  verification        TEXT,           -- JSON array
  resume_point        TEXT,
  resume_attempted    INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at          INTEGER NOT NULL,
  ended_at            INTEGER
);
```

Plus optional `session_journal` table for turn-level audit trail — deferred to Phase 2.

### Indexes (same as v1 + one addition)

```sql
CREATE INDEX IF NOT EXISTS idx_digest_agent       ON session_digest(agent, started_at);
CREATE INDEX IF NOT EXISTS idx_digest_status      ON session_digest(status, started_at);
CREATE INDEX IF NOT EXISTS idx_digest_agent_status ON session_digest(agent, status, started_at);
CREATE INDEX IF NOT EXISTS idx_digest_root_cause  ON session_digest(root_cause, started_at) WHERE root_cause IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_digest_parent      ON session_digest(parent_session_id) WHERE parent_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_digest_request     ON session_digest(request_id) WHERE request_id IS NOT NULL;
```

Note: `(agent, status, started_at)` composite index is new — covers circuit breaker queries efficiently (filter by agent + status + time in a single index scan).

---

## 11. Open Design Questions

### Q1: Where does the LLM summary input come from?

**Option A**: In-memory message array at session_end time (simpler, no extra DB reads)  
**Option B**: Turn-by-turn journal entries from DB (requires `session_journal` table)

**Recommendation**: Option A for Phase 1. The session's messages are already in memory when session_end fires. Build the summary input from `ActiveSession.agent.messages`, not from DB. If we later want to regenerate summaries for historical sessions (backfill), we'd need the JSONL transcript — but that's an edge case.

### Q2: Should the LLM summary replace or complement the agent's summary?

**Recommendation**: Complement. Store both `summary` (agent's own words) and `llm_summary` (LLM narrative). The agent's summary is a self-report; the LLM summary is an objective reconstruction from actions. Both are useful. The context injection system can choose which to show based on quality/length.

### Q3: Session briefing token budget?

Bob proposed 1500 tokens. This seems right. Breakdown:
- Continuity (last session + next_steps): ~600 tokens
- Lessons (5-10 deduplicated): ~450 tokens  
- Cross-agent activity: ~300 tokens
- Recently modified files: ~150 tokens

### Q4: Lesson deduplication across sessions?

Lessons accumulate across sessions. We need dedup:
- **Option A**: Dedup in the compiler at injection time (simpler, no write-time dedup)
- **Option B**: Separate `lessons` table with dedup on write

**Recommendation**: Option A for now. The compiler reads recent sessions' lessons, deduplicates by content similarity, and injects the top N. No separate lessons table needed — lessons are embedded in the `end` entry's `lessons` JSON array.

### Q5: Cross-agent file conflict detection?

When two agents modify the same file in recent sessions, the briefing should flag this. Query:

```sql
SELECT d1.agent, d1.sessionId, d1.started_at
FROM session_digest d1, json_each(d1.files_modified) f1
WHERE f1.value = ?  -- the file path
  AND d1.agent != ?  -- not the current agent
  AND d1.started_at > ?  -- recent window
ORDER BY d1.started_at DESC
LIMIT 3;
```

This works but `json_each` on a non-indexed column may be slow for large datasets. At 200 sessions/day × 365 days = 73K rows, scanning all `files_modified` arrays takes ~50-100ms. Acceptable for session start (happens once).

---

## 12. Implementation File Map

| File | Changes |
|------|---------|
| `src/lib/requests.ts` | Add `session_digest` CREATE TABLE + indexes to SCHEMA. Add write functions: `upsertDigestStart()`, `updateDigestProgress()`, `updateDigestOutcome()`, `generateAndStoreLlmSummary()`. Add read functions: `getDigest()`, `getDigestsByAgent()`, `getResumableDigests()`, `getRecentFailureCount()`. |
| `src/lib/session-subscribers.ts` | Add `createDigestWriter()` subscriber that handles start/turn_end/session_end events and calls the appropriate write functions. |
| `src/app/may.ts` | Wire `createDigestWriter()` into EventBus. |
| `src/lib/manager.ts` | Add `buildSessionBriefing()` call in `buildSessionContext()`. |
| `src/lib/digest-compiler.ts` | NEW: Pure function that reads digests from DB and produces briefing text. |
| `src/lib/classify-error.ts` | Extend with `classifyRootCause()` mapping (already exists, just needs the enum mapping). |

---

## 13. Comparison: v1 (My Original) vs v2 (This Design)

| Aspect | v1 (Original) | v2 (Aligned with Hao) |
|--------|---------------|----------------------|
| Storage | SQL + JSONL dual store | SQL only |
| Rows per session | 1 | 1 (with optional journal for turn-level) |
| LLM involvement | None | 1 cheap call at session_end |
| Summary source | Agent's `finish().summary` only | Agent summary + LLM narrative |
| Context injection | From JSONL files | From SQL queries |
| Turn-level data | Not stored | Optionally in `session_journal` |
| Recovery queries | Same | Same (both use `session_digest`) |
| Backfill | Same approach | Same approach |
| New: `llm_summary` | N/A | Yes — answers "what was done, what worked, what failed" |

The key additions from Hao's decisions:
1. Drop JSONL → SQL is the single store
2. Add `llm_summary` column for the LLM-generated narrative
3. Context injection reads from SQL, not JSONL
4. Turn-level data extraction (no LLM) feeds the LLM summary at end

---

## 14. Summary of Recommendations

1. **Use one table (`session_digest`)** for Phase 1. One row per session, updated incrementally at start/turn/end. This is my v1 schema + `llm_summary` column.
2. **Defer `session_journal` (turn-level log)** to Phase 2. Build LLM summary from in-memory messages at session_end, not from DB.
3. **Add composite index** `(agent, status, started_at)` for circuit breaker queries.
4. **Use partial indexes** with `WHERE root_cause IS NOT NULL` and `WHERE parent_session_id IS NOT NULL` — most rows don't need these indexes.
5. **LLM summary is fire-and-forget** — if it fails, `llm_summary` stays null and agent's own summary is used.
6. **Context injection reads from SQL** using `buildSessionBriefing()` → `compileBriefing()` pure function.
7. **No JSONL stores** — eliminates dual-write complexity and the entire DigestWriter/LessonsWriter JSONL path.


[SIG: optimizer-session-journal-review-v2]
