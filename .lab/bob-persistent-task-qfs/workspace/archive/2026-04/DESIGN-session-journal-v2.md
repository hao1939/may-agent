# Session Journal — Unified Design (v2)

**Authors:** Bob (architecture), Optimizer (storage/queries)  
**Date:** 2026-04-05  
**Status:** Merged final — ready for implementation  
**Supersedes:** `agents/bob/workspace/DESIGN-session-digest.md`, `agents/optimizer/workspace/design-session-digest-storage.md`

---

## 0. Design Decisions (from Hao)

1. **DB table is the single store.** No JSONL duplication. Same dual-store pattern as sessions: JSONL = raw transcript, DB = structured index. The journal IS the structured index.
2. **Incremental writes, not post-hoc parsing.** `session_start` → cheap INSERT. `turn_end` → cheap UPDATE. `session_end` → ONE LLM call to produce the human-readable summary.
3. **The LLM summary answers:** what was the task, what was understood, what was done, what worked, what failed and why, what is still open.
4. **Interrupted sessions:** no LLM call. The last incremental entry IS the current state.

---

## 1. Data Model

### 1a. `session_journal` Table

```sql
CREATE TABLE IF NOT EXISTS session_journal (
  -- Identity (1:1 with sessions table)
  sessionId             TEXT PRIMARY KEY,
  agent                 TEXT NOT NULL,

  -- Phase 1: Start (written on session_start — no LLM)
  task_summary          TEXT,           -- First 500 chars of task
  task_source           TEXT,           -- 'heartbeat' | 'cron' | 'directive' | 'escalation' | 'workflow' | 'call' | 'task'
  parent_session_id     TEXT,           -- Denormalized for join-free recovery queries
  request_id            TEXT,           -- Links to requests table
  workflow_run_id       TEXT,           -- Links to workflow runs

  -- Phase 2: Progress (updated on turn_end — no LLM)
  turns_completed       INTEGER DEFAULT 0,
  ops_completed         INTEGER DEFAULT 0,
  tools_called          TEXT,           -- JSON array: ["read", "bash", "edit", ...] — accumulated unique tool names
  files_touched         TEXT,           -- JSON array: ["src/foo.ts", ...] — accumulated files read/written
  errors                TEXT,           -- JSON array: [{turn, tool, message}] — last N errors (ring buffer, max 10)
  last_progress_at      INTEGER,        -- Epoch ms of last turn_end (watchdog staleness detection)
  consecutive_error_turns INTEGER DEFAULT 0,  -- For stuck detection; reset on successful turn

  -- Phase 3: Outcome (written on session_end)
  status                TEXT,           -- 'success' | 'failure' | 'blocked' | 'partial' | 'error' | 'interrupted'
  summary               TEXT,           -- From finish().summary
  llm_summary           TEXT,           -- LLM-generated comprehensive summary (only on session_end, not interrupted)
  
  -- Structured outcome (from finish() params — direct extraction, no LLM)
  deliverables          TEXT,           -- JSON: [{path, description}]
  files_modified        TEXT,           -- JSON: ["path1", "path2"] — from session_end event
  completed_items       TEXT,           -- JSON: ["item1", "item2"]
  new_items             TEXT,           -- JSON: ["task1", "task2"]
  blockers              TEXT,           -- JSON: [{reason, context}]
  next_steps            TEXT,           -- Free text
  lessons               TEXT,           -- JSON: [{category, content}]
  verification          TEXT,           -- JSON: ["evidence1", ...]

  -- Failure analysis
  error                 TEXT,           -- Error message from session_end
  root_cause            TEXT,           -- Classified: 'turn_limit' | 'provider_error' | 'stuck' | 'crash' | 'interrupted' | 'closed_by_user' | null

  -- Recovery (replaces ephemeral Maps)
  resume_point          TEXT,           -- What to resume: from next_steps, blockers, or checkpoint
  resume_attempted      INTEGER DEFAULT 0,  -- How many auto-resume/P62 recovery attempts

  -- Timestamps
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);
```

### 1b. Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_journal_agent       ON session_journal(agent, created_at);
CREATE INDEX IF NOT EXISTS idx_journal_status      ON session_journal(status, created_at);
CREATE INDEX IF NOT EXISTS idx_journal_created     ON session_journal(created_at);
CREATE INDEX IF NOT EXISTS idx_journal_parent      ON session_journal(parent_session_id);
CREATE INDEX IF NOT EXISTS idx_journal_request     ON session_journal(request_id);
CREATE INDEX IF NOT EXISTS idx_journal_root_cause  ON session_journal(root_cause) WHERE root_cause IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_source      ON session_journal(task_source, created_at);
```

### 1c. Why a Separate Table (not columns on `sessions`)

1. **Different update cadence**: `sessions` is written at start and end (2 writes). Journal is written at start, every turn_end, and end (3–30+ writes).
2. **Schema cleanliness**: `sessions` mirrors meta.json on disk. Journal captures derived/classified data that doesn't belong in the raw session record.
3. **No migration risk**: 16K+ existing `sessions` rows stay untouched. Additive CREATE TABLE.

### 1d. Field Design Rationale

| Field | Why in DB (not just JSONL) |
|-------|---------------------------|
| `tools_called` | Enables "which agents use which tools" analytics |
| `files_touched` | Mid-session: cross-agent file conflict detection. Post-session: codebase change audit |
| `errors` | Ring buffer of last 10 errors — enough for stuck detection + failure diagnosis without reading transcript |
| `llm_summary` | The human-readable audit record. Only written at session_end. Null for interrupted sessions |
| `consecutive_error_turns` | Replaces in-memory stuck detector Map. Persists across restarts |
| `resume_attempted` | Replaces in-memory Maps in may.ts, session-subscribers.ts. Prevents infinite retry loops after restart |

---

## 2. Lifecycle — When Each Write Happens

### Event Hooks in manager.ts

```
manager.ts:887-894   →  session_start event
                         Fields: sessionId, agent, task, parentSessionId

manager.ts:271-273   →  turn_end event  (via bridgeAgentEvents)
                         Fields: sessionId, agent, toolCalls (count), durationMs, errorCount

manager.ts:700-717   →  session_end event  (via handleCompletion)
                         Fields: sessionId, agent, status, task, duration, error, outcome,
                                 opCount, turnCount, finishParams, filesModified,
                                 workspacePath, parentSessionId
                         NOTE: workflowRunId missing from event — needs adding
```

### Phase 1: session_start → INSERT

**Trigger:** `session_start` bus event  
**LLM:** None  
**Data sources:** Event fields only + one DB lookup for request_id  

```typescript
function onSessionStart(event: SessionStartEvent): void {
  const source = classifyTaskSource(event.task);
  const req = db.prepare(
    'SELECT requestId FROM requests WHERE sessionId = ? LIMIT 1'
  ).get(event.sessionId);

  db.run(`INSERT OR REPLACE INTO session_journal
    (sessionId, agent, task_summary, task_source, parent_session_id,
     request_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [event.sessionId, event.agent, event.task.slice(0, 500), source,
     event.parentSessionId ?? null, req?.requestId ?? null,
     Date.now(), Date.now()]);
}
```

**`classifyTaskSource()`** — pure function:
```typescript
function classifyTaskSource(task: string): string {
  if (task.startsWith('[heartbeat]')) return 'heartbeat';
  if (task.startsWith('[cron:')) return 'cron';
  if (/^\[P[0-3]\]/.test(task)) return 'directive';
  if (task.startsWith('[escalation]')) return 'escalation';
  return 'task';
}
```

### Phase 2: turn_end → UPDATE

**Trigger:** `turn_end` bus event  
**LLM:** None  
**Data sources:** Event fields only. The `turn_end` event currently provides `toolCalls` (count), `durationMs`, `errorCount`.

**Problem:** `turn_end` gives us tool call *count* but not *names*. And it doesn't give us files touched this turn.

**Solution — Enrich turn_end event.** In `bridgeAgentEvents()`, accumulate tool names and file paths alongside the counts already tracked:

```typescript
// In bridgeAgentEvents() — additions to the existing tracking:
let toolNames: string[] = [];      // NEW: accumulate tool names this turn
let filesThisTurn: string[] = [];  // NEW: accumulate file paths from tool args

case "tool_execution_start":
  toolCalls++;
  toolNames.push(event.toolName);                          // NEW
  if (event.args?.path) filesThisTurn.push(event.args.path); // NEW
  // ... existing emit ...

case "tool_execution_end":
  if (event.isError) {
    // capture error details for the journal
  }
  // ... existing handling ...

case "turn_end":
  this.emit({
    type: "turn_end", sessionId, agent: agentName,
    toolCalls, durationMs, errorCount: turnErrors,
    toolNames,          // NEW
    filesThisTurn,      // NEW
  });
  break;
```

**Journal update on turn_end:**

```typescript
function onTurnEnd(event: TurnEndEvent): void {
  const now = Date.now();

  // Merge new tool names into accumulated set
  // Merge new files into accumulated set
  // Append errors to ring buffer (max 10)
  db.run(`UPDATE session_journal SET
    turns_completed = ?,
    ops_completed = ops_completed + ?,
    tools_called = (
      SELECT json_group_array(DISTINCT value) FROM (
        SELECT value FROM json_each(COALESCE(tools_called, '[]'))
        UNION
        SELECT value FROM json_each(?)
      )
    ),
    files_touched = (
      SELECT json_group_array(DISTINCT value) FROM (
        SELECT value FROM json_each(COALESCE(files_touched, '[]'))
        UNION
        SELECT value FROM json_each(?)
      )
    ),
    last_progress_at = ?,
    consecutive_error_turns = CASE
      WHEN ? > 0 THEN consecutive_error_turns + 1
      ELSE 0
    END,
    updated_at = ?
    WHERE sessionId = ?`,
    [
      event.turnCount ?? null,
      event.toolCalls ?? 0,
      JSON.stringify(event.toolNames ?? []),
      JSON.stringify(event.filesThisTurn ?? []),
      now,
      event.errorCount ?? 0,
      now,
      event.sessionId,
    ]);
}
```

> **Perf note:** The json_each UNION approach does set-union in SQL. For the typical 3–10 tools per session, this is sub-millisecond. If profiling shows issues, switch to in-memory accumulation with a Map per session.

### Phase 3: session_end → UPDATE + LLM Summary

**Trigger:** `session_end` bus event  
**LLM:** ONE call for non-interrupted sessions  
**Data sources:** Event fields + accumulated journal row  

#### Step 1: Write structured fields (no LLM)

```typescript
function onSessionEnd(event: SessionEndEvent): void {
  const fp = event.finishParams;
  const rootCause = classifyRootCause(event.status, event.error);
  const resumePoint = deriveResumePoint(event);

  db.run(`UPDATE session_journal SET
    status = ?, summary = ?,
    deliverables = ?, files_modified = ?, completed_items = ?,
    new_items = ?, blockers = ?, next_steps = ?, lessons = ?,
    verification = ?, error = ?, root_cause = ?, resume_point = ?,
    turns_completed = COALESCE(?, turns_completed),
    ops_completed = CASE WHEN ? > ops_completed THEN ? ELSE ops_completed END,
    updated_at = ?
    WHERE sessionId = ?`,
    [
      fp?.status ?? event.status,
      fp?.summary ?? event.outcome ?? null,
      fp?.deliverables ? JSON.stringify(fp.deliverables) : null,
      event.filesModified ? JSON.stringify(event.filesModified) : null,
      fp?.completed_items ? JSON.stringify(fp.completed_items) : null,
      fp?.new_items ? JSON.stringify(fp.new_items) : null,
      fp?.blockers ? JSON.stringify(fp.blockers) : null,
      fp?.next_steps ?? null,
      fp?.lessons ? JSON.stringify(fp.lessons) : null,
      fp?.verification_evidence ? JSON.stringify(fp.verification_evidence) : null,
      event.error ?? null,
      rootCause,
      resumePoint,
      event.turnCount ?? null,
      event.opCount ?? 0, event.opCount ?? 0,
      Date.now(),
      event.sessionId,
    ]);

  // Step 2: Generate LLM summary (async, non-blocking)
  if (event.status !== 'interrupted' && event.status !== 'error') {
    generateLlmSummary(event.sessionId).catch(() => {/* best-effort */});
  }
}
```

#### Step 2: LLM Summary (see §3 for the prompt)

```typescript
async function generateLlmSummary(sessionId: string): Promise<void> {
  const row = db.prepare('SELECT * FROM session_journal WHERE sessionId = ?').get(sessionId);
  if (!row) return;

  const prompt = buildSummaryPrompt(row);
  const response = await llmCall({
    model: 'claude-sonnet-4-20250514',  // cheap, fast
    maxTokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  db.run('UPDATE session_journal SET llm_summary = ?, updated_at = ? WHERE sessionId = ?',
    [response.text, Date.now(), sessionId]);
}
```

#### Classification Functions

```typescript
function classifyRootCause(status: string, error?: string): string | null {
  if (status === 'done' || status === 'success') return null;
  if (!error) return status === 'interrupted' ? 'interrupted' : null;
  if (/Turn limit reached/i.test(error)) return 'turn_limit';
  if (/litellm|BadRequestError|model.*not supported/i.test(error)) return 'provider_error';
  if (/Stuck:/i.test(error)) return 'stuck';
  if (/Request was aborted/i.test(error)) return 'interrupted';
  if (/Closed/i.test(error)) return 'closed_by_user';
  return 'crash';
}

function deriveResumePoint(event: SessionEndEvent): string | null {
  const fp = event.finishParams;
  if (fp?.next_steps) return fp.next_steps;
  if (fp?.blockers?.length > 0)
    return `Blocked: ${fp.blockers.map((b: any) => b.reason).join('; ')}`;
  if (event.status === 'interrupted' || event.status === 'error')
    return event.error ?? 'Session interrupted — resume from last checkpoint';
  return null;
}
```

---

## 3. LLM Summary Prompt

The session_end LLM call reads the accumulated journal row (~2–3KB of structured data) and produces a human-readable narrative. This is the audit record.

```typescript
function buildSummaryPrompt(row: SessionJournalRow): string {
  return `You are summarizing a completed agent session for a human audit log.

## Session Data
- **Agent:** ${row.agent}
- **Task:** ${row.task_summary}
- **Source:** ${row.task_source}
- **Status:** ${row.status}
- **Duration:** ${row.turns_completed} turns, ${row.ops_completed} tool calls
- **Agent's summary:** ${row.summary ?? '(none)'}

### Files Modified
${row.files_modified ? JSON.parse(row.files_modified).join(', ') : '(none)'}

### Tools Used
${row.tools_called ? JSON.parse(row.tools_called).join(', ') : '(none)'}

### Deliverables
${row.deliverables ? JSON.parse(row.deliverables).map((d: any) => `- ${d.path}: ${d.description}`).join('\n') : '(none)'}

### Errors Encountered
${row.errors ? JSON.parse(row.errors).map((e: any) => `- Turn ${e.turn}, ${e.tool}: ${e.message}`).join('\n') : '(none)'}

### Blockers
${row.blockers ? JSON.parse(row.blockers).map((b: any) => `- ${b.reason}: ${b.context}`).join('\n') : '(none)'}

### Next Steps (from agent)
${row.next_steps ?? '(none)'}

### Lessons Learned
${row.lessons ? JSON.parse(row.lessons).map((l: any) => `- [${l.category}] ${l.content}`).join('\n') : '(none)'}

${row.error ? `### Error\n${row.error}` : ''}
${row.root_cause ? `### Root Cause Classification\n${row.root_cause}` : ''}

---

Write a 3-5 sentence summary that answers:
1. What was the task and what did the agent understand it to be?
2. What was actually done (key actions, files changed)?
3. What worked?
4. What failed and why?
5. What is still open / needs follow-up?

Be concrete — mention specific files, error messages, and tool names. Do not editorialize or add recommendations. Just report what happened.`;
}
```

**Cost:** ~1000 input tokens + ~200 output tokens ≈ $0.005 per session with Sonnet. At 200 sessions/day = $1/day.

**When it doesn't run:**
- `status === 'interrupted'` — session was killed, no clean finish. The accumulated `turns_completed`, `tools_called`, `files_touched`, and last `consecutive_error_turns` tell the story.
- `status === 'error'` — infra crash. The `error` field + `root_cause` classification is sufficient.

---

## 4. Consumer Queries

### 4a. Recovery: Auto-Resume (replaces in-memory Map)

```sql
-- Find interrupted sessions eligible for resume
SELECT sessionId, agent, task_summary, resume_point, resume_attempted
FROM session_journal
WHERE status = 'interrupted'
  AND resume_attempted < 2
  AND root_cause NOT IN ('closed_by_user')
  AND created_at > ?  -- within last 2 hours
ORDER BY created_at DESC;
```

```typescript
function incrementResumeAttempted(sessionId: string): void {
  db.run('UPDATE session_journal SET resume_attempted = resume_attempted + 1, updated_at = ? WHERE sessionId = ?',
    [Date.now(), sessionId]);
}
```

### 4b. Recovery: Circuit Breaker (replaces in-memory Map)

```sql
-- Is this agent's circuit broken? (>= threshold failures in window)
SELECT count(*) as recent_errors
FROM session_journal
WHERE agent = ?
  AND status IN ('error', 'failure')
  AND root_cause NOT IN ('closed_by_user')
  AND created_at > ?;  -- now - CB_PROBE_INTERVAL_MS
```

### 4c. Recovery: P62 Ambulance (replaces in-memory Map)

```sql
-- Has this task already been retried?
SELECT resume_attempted
FROM session_journal
WHERE sessionId = ?;
```

Same `incrementResumeAttempted()` as auto-resume — shared column, shared logic.

### 4d. Recovery: Stuck Detection (replaces in-memory Map)

Mid-session: the `turn_end` handler reads `consecutive_error_turns` from the row and injects warnings or terminates. The DB row replaces the ephemeral `StuckState` map.

### 4e. Recovery: Watchdog (staleness detection)

```sql
-- Find sessions that haven't made progress
SELECT sessionId, agent, task_summary, last_progress_at, turns_completed
FROM session_journal
WHERE status IS NULL  -- still running (no session_end yet)
  AND last_progress_at < ?  -- now - staleness_threshold
ORDER BY last_progress_at ASC;
```

### 4f. Evaluator: Pre-filtering

```sql
-- Skip sessions not worth evaluating
SELECT sessionId FROM session_journal
WHERE root_cause NOT IN ('provider_error', 'closed_by_user')
  AND turns_completed > 1
  AND created_at > ?;
```

### 4g. Human Audit: Daily Dashboard

```sql
SELECT
  j.sessionId, j.agent, j.task_source, j.task_summary,
  j.status, j.llm_summary, j.turns_completed, j.ops_completed,
  j.root_cause, j.files_modified,
  e.quality, e.efficiency, e.verdict
FROM session_journal j
LEFT JOIN evaluations e ON j.sessionId = e.sessionId
WHERE j.created_at >= ?  -- start of day
ORDER BY j.created_at DESC;
```

### 4h. Agent Health (replaces manual log analysis)

```sql
SELECT
  agent,
  count(*) as total,
  count(CASE WHEN status IN ('success', 'done') THEN 1 END) as successes,
  count(CASE WHEN status IN ('failure', 'error') THEN 1 END) as failures,
  count(CASE WHEN root_cause = 'turn_limit' THEN 1 END) as turn_limits,
  count(CASE WHEN root_cause = 'stuck' THEN 1 END) as stuck,
  avg(turns_completed) as avg_turns
FROM session_journal
WHERE created_at >= ?
GROUP BY agent;
```

### 4i. Cross-Agent File Conflicts

```sql
SELECT je.value as file_path, j.agent, j.sessionId, j.created_at
FROM session_journal j, json_each(j.files_modified) je
WHERE j.created_at >= ?
ORDER BY je.value, j.created_at DESC;
```

### 4j. Context Injection (session briefing at start)

```sql
-- Last N sessions for this agent, for building the session briefing
SELECT task_summary, status, summary, llm_summary, next_steps, blockers,
       files_modified, lessons, root_cause, resume_point, created_at
FROM session_journal
WHERE agent = ?
ORDER BY created_at DESC
LIMIT 10;
```

### 4k. Request Audit Trail

```sql
SELECT
  r.requestId, r.toAgent, r.method, r.status as req_status,
  j.sessionId, j.status as sess_status, j.llm_summary,
  j.deliverables, j.completed_items
FROM requests r
LEFT JOIN session_journal j ON r.sessionId = j.sessionId
WHERE r.requestId = ?
ORDER BY r.createdAt ASC;
```

---

## 5. Recovery Unification

### 5a. What Gets Replaced

Six in-memory recovery mechanisms collapse into one event-driven pipeline reading from the journal table:

| Mechanism | Current Code | Lines | Journal Replacement |
|-----------|-------------|-------|---------------------|
| AutoResume | `session-subscribers.ts:314-360` | ~50 | Query `resume_attempted` column |
| Circuit Breaker | `cron.ts:461-502` (3 functions + Map) | ~45 | Query recent failure count |
| Escalation | `manager.ts:738-775` | ~40 | Same logic, reads from journal |
| P62 Recovery | `may.ts:283-395` | ~110 | Query `resume_attempted` column |
| Stuck Detector | `session-subscribers.ts:247-310` + Map | ~65 | `consecutive_error_turns` column |
| Watchdog | `manager.ts:623-637` | stays | Defense-in-depth; can't rely on DB |

**Total removable: ~310 lines.** Replaced by ~150 lines of unified classifier + journal writes.

### 5b. Unified Recovery Classifier

```
session_end event
       │
       ▼
┌──────────────┐
│ Write journal │  (structured fields, no LLM)
│ outcome      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Recovery     │  ← single function, reads journal row
│  Classifier   │
└──────┬───────┘
       │
       ├── root_cause = "infra" + resume_attempted < 2
       │   → ACTION: requeue (replaces P62)
       │
       ├── status = "interrupted" + ops > 0 + resume_attempted < 2
       │   → ACTION: resume with backoff (replaces AutoResume)
       │
       ├── status = "blocked" or "failure" + has blockers
       │   → ACTION: escalate to parent/May (replaces Escalation)
       │
       ├── recent failures for agent >= threshold (SQL query)
       │   → ACTION: suppress cron (replaces Circuit Breaker)
       │
       └── default → no action
```

### 5c. Key Benefit: Persistent State

| State | Today (in-memory) | With Journal (DB) |
|-------|-------------------|-------------------|
| Auto-resume attempts | `Map<sessionId, count>` — lost on restart | `resume_attempted` — survives |
| Circuit breaker | `Map<agentName, {count}>` — lost on restart | SQL query — survives |
| P62 attempts | `Map<"agent:taskHash", count>` — lost on restart | `resume_attempted` — survives |
| Stuck count | `Map<sessionId, StuckState>` — lost on restart | `consecutive_error_turns` — survives |

**This means:** restarting the process no longer resets recovery counters. A fundamentally broken task can't be retried infinitely.

### 5d. What Survives (Cannot Be Removed)

- `setupTimeout()` — per-session safety net, must fire even if DB is down
- Stuck warning injection in `manager-receipts.ts:340-344` — mid-session, must be inline
- `classify-error.ts` — pure function, now shared by the recovery classifier
- `resumeStaleSessions()` in `manager.ts:940-1060` — runs pre-bus on startup, but can *read* journal to decide resume vs abandon

---

## 6. Implementation Plan

### Phase 1: Schema + Journal Writer Subscriber (Day 1)

**Files to modify:**

| File | Change |
|------|--------|
| `src/lib/requests.ts` | Add `session_journal` CREATE TABLE + indexes to SCHEMA constant. Add write helpers: `insertJournalStart()`, `updateJournalProgress()`, `updateJournalOutcome()`, `incrementResumeAttempted()`. Add read helpers: `getJournal()`, `getJournalsByAgent()`, `getResumableJournals()`, `getRecentFailureCount()`, `isCircuitBrokenFromJournal()`. |
| `src/lib/session-subscribers.ts` | Add `createJournalWriter()` — a single subscriber that handles `session_start`, `turn_end`, `session_end` events by calling the appropriate DB function. |
| `src/app/may.ts` | Wire `createJournalWriter()` into the EventBus subscription chain (~line 224). |
| `src/lib/manager.ts` | Add `workflowRunId` to the `session_end` event emission (currently missing at line 700). Enrich `turn_end` event with `toolNames` and `filesThisTurn` arrays (in `bridgeAgentEvents()`). |

**Risk:** Zero — additive. No existing behavior changes.

**Validation:** After deploying, verify that new sessions get journal rows by querying: `SELECT count(*) FROM session_journal WHERE created_at > ?`.

### Phase 2: LLM Summary (Day 2)

**Files to modify:**

| File | Change |
|------|--------|
| `src/lib/journal-summary.ts` (NEW) | `buildSummaryPrompt()` and `generateLlmSummary()` functions. Pure LLM call, writes to `llm_summary` column. |
| `src/lib/session-subscribers.ts` | In the `session_end` handler within `createJournalWriter()`, call `generateLlmSummary()` asynchronously after writing structured fields. |

**Risk:** Low. The LLM call is fire-and-forget; if it fails, `llm_summary` stays NULL. All other fields are already written.

### Phase 3: Recovery Migration (Day 3–4)

Migrate each recovery mechanism to use journal DB instead of in-memory Maps:

| Step | File | Change |
|------|------|--------|
| 3a | `src/lib/session-subscribers.ts` | Modify `createAutoResume()` to call `getJournal(sessionId).resume_attempted` instead of local Map |
| 3b | `src/app/cron.ts` | Replace `isCircuitBroken()` with `isCircuitBrokenFromJournal()` DB query. Remove `agentErrors` Map, `recordAgentError()`, `recordAgentSuccess()` |
| 3c | `src/app/may.ts` | In P62 recovery subscriber, replace `recoveryAttempts` Map with `getJournal(sessionId).resume_attempted` + `incrementResumeAttempted()` |
| 3d | `src/lib/session-subscribers.ts` | Modify stuck detector to read/write `consecutive_error_turns` from journal row |

**Risk:** Medium. Each migration changes existing behavior. Do one at a time with regression testing.

### Phase 4: Backfill Historical Data (Day 2, in parallel)

One-time SQL script to populate journal from existing `sessions` table:

```sql
INSERT OR IGNORE INTO session_journal
  (sessionId, agent, task_summary, status, summary, error, root_cause,
   parent_session_id, request_id, workflow_run_id, ops_completed,
   created_at, updated_at)
SELECT
  s.sessionId, s.agent, substr(s.task, 1, 500),
  CASE
    WHEN s.status = 'done' THEN 'success'
    WHEN s.status = 'running' THEN 'interrupted'
    ELSE s.status
  END,
  s.outcome, s.error,
  CASE
    WHEN s.error LIKE '%Turn limit%' THEN 'turn_limit'
    WHEN s.error LIKE '%litellm%' OR s.error LIKE '%BadRequest%' THEN 'provider_error'
    WHEN s.error LIKE '%Stuck:%' THEN 'stuck'
    WHEN s.error LIKE '%Request was aborted%' THEN 'interrupted'
    WHEN s.error LIKE '%Closed%' THEN 'closed_by_user'
    WHEN s.status = 'error' THEN 'crash'
    ELSE NULL
  END,
  s.parentSessionId, s.requestId, s.workflowRunId, s.opCount,
  s.startedAt, COALESCE(s.endedAt, s.startedAt)
FROM sessions s;
```

**Quality:** Gives root_cause for all 16K+ sessions. Rich fields (deliverables, files_modified, lessons, llm_summary) only exist going forward.

### Phase 5: Context Injection Integration (Day 5)

**Files to modify:**

| File | Change |
|------|--------|
| `src/lib/manager.ts` | In `buildSessionContext()`, replace the current `## Recent Task History` JSONL-based injection with a SQL query against `session_journal`. The journal's `llm_summary` + `next_steps` + `lessons` fields produce a richer briefing without increasing token budget. |

**The existing memory system (`<agent>.jsonl`) becomes redundant** once context injection reads from the journal table. Keep it for backward compatibility during transition, then deprecate.

### Phase 6: Unified Recovery Classifier (Day 6+, future)

Once all individual recovery mechanisms use the journal (Phase 3), refactor them into a single `src/lib/recovery-classifier.ts` that replaces 4 separate subscribers with one decision tree (as described in §5b).

---

## 7. Performance

### Write Path
- 3–30 writes per session (1 start + 1–28 turn_ends + 1 end)
- Each write is a single SQL UPDATE on an indexed PK — sub-millisecond
- LLM summary is async, non-blocking — doesn't delay session completion

### Read Path
- Dashboard queries hit indexed columns → sub-ms for single agent
- Aggregate queries (health dashboard) bounded by time window
- JSON columns (`files_modified`, `deliverables`) are NOT indexed — used for display, not filtering

### Storage
- ~2KB per row average (mostly JSON arrays)
- 200 sessions/day × 2KB = 400KB/day ≈ 150MB/year
- No TTL needed — SQLite handles this. `DELETE WHERE created_at < ?` if needed.

---

## 8. What This Replaces

| Current System | Journal Equivalent | Status |
|----------------|-------------------|--------|
| `<agent>.jsonl` (memory) | `session_journal` table queries | Deprecated after Phase 5 |
| `<agent>-digest.jsonl` (Bob's original design) | NOT BUILT — replaced by DB table | Cancelled |
| `<agent>-lessons.jsonl` (Bob's original design) | `lessons` JSON column in journal | Cancelled as separate file |
| In-memory recovery Maps (4 separate) | DB columns: `resume_attempted`, `consecutive_error_turns`, queries | Phase 3 |
| `sessions.outcome` text field (89% NULL) | `session_journal.summary` + `llm_summary` | Superseded |

---

## 9. Ownership Matrix

| Component | Owner | Notes |
|-----------|-------|-------|
| SQL schema in `requests.ts` | Optimizer | CREATE TABLE + indexes |
| DB write/read functions | Optimizer | In `requests.ts` |
| `createJournalWriter()` subscriber | Optimizer | In `session-subscribers.ts` |
| `buildSummaryPrompt()` / LLM call | Bob | In new `journal-summary.ts` |
| Recovery classifier (Phase 6) | Shared | New `recovery-classifier.ts` |
| `buildSessionContext()` integration | Bob | In `manager.ts` |
| Backfill migration | Optimizer | One-time script |
| `classifyRootCause()` / `classifyTaskSource()` | Shared | Extend existing `classify-error.ts` |
| `turn_end` event enrichment | Whoever codes Phase 1 | In `manager.ts` `bridgeAgentEvents()` |

---

## 10. Open Questions (for implementation)

1. **`workflow_run_id` on session_end event:** Currently not emitted. Fix in Phase 1 by adding `workflowRunId: info.workflowRunId` to the emit at manager.ts:700.

2. **Error ring buffer format:** The `errors` column accumulates the last 10 errors. Implementation choice: (a) read current JSON, append, truncate in TypeScript, or (b) use SQL JSON manipulation. Recommend (a) — more readable, and we already read the row on turn_end.

3. **`tools_called` set-union in SQL vs TypeScript:** The SQL `json_each` UNION approach works but is awkward. Alternative: maintain an in-memory `Set<string>` per session in the subscriber and stringify on each write. Pro: cleaner. Con: lost on restart (but tools_called is low-value for interrupted sessions anyway).

4. **LLM model for summary:** Draft uses `claude-sonnet-4-20250514`. Could use Haiku for even cheaper summaries (~$0.001/session). Trade-off: quality vs cost. Start with Sonnet, measure quality, downgrade if sufficient.

5. **Context injection budget:** The journal's `llm_summary` is 3–5 sentences per session. Injecting the last 5 sessions = ~100 tokens. Much cheaper than the current `## Recent Task History` which is 600–1000 tokens of one-line entries. The journal enables *better* briefings with *fewer* tokens.
