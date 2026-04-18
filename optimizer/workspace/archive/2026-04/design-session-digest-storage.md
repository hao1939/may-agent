# Session Digest System — Storage, Queries & UI Integration

**Author**: Optimizer  
**Date**: 2026-04-05  
**Status**: Finalized v2 — ready for implementation  
**Coordinates with**: Bob's architecture & lifecycle design (`agents/bob/workspace/DESIGN-session-digest.md`)

---

## 1. Problem & Goals

Every session produces structured data at three lifecycle points:
1. **Start** — task, agent, parent relationship
2. **Mid-session** — progress checkpoints, files modified so far, turn counts
3. **End** — outcome, deliverables, blockers, root cause, resume point

Today this data is scattered:
- `meta.json` on disk (source of truth for session metadata, but not queryable)
- `sessions` table in DB (queryable index, but only has `outcome` text — 89% of rows have it NULL)
- `evaluations` table (LLM-scored quality/efficiency — separate from session's own report)
- `finish()` params are captured in `session_end` events but **not persisted structurally** — they're lost after the event fires (fragments land in memory.jsonl and progress.md only)
- Recovery state lives in **ephemeral Maps** that die on process restart (auto-resume attempts, circuit breaker counts, P62 recovery attempts)

**The gap**: There is no single place to ask "what did this session do, why did it fail, what files did it change, and should it be retried?" without parsing the full JSONL transcript.

### Design Principles

1. **Separate table, not columns on `sessions`** — digests update multiple times per session (start→progress→end). The `sessions` row is created at start and status-updated at end. Mixing lifecycle-evolving digest data into the sessions row creates write contention and schema bloat.
2. **JSON-in-column for variable-shape data** — arrays (files_modified, blockers, deliverables) go in JSON columns. Fixed scalars (status, summary) get their own columns for direct SQL filtering.
3. **Idempotent writes** — each lifecycle phase updates its fields. UPSERT on sessionId.
4. **No transcript parsing** — digest data comes from structured events (session_start, turn_end, session_end/finish), never from re-reading JSONL.
5. **Complementary to Bob's JSONL stores** — This SQL table serves queries, recovery, and UI. Bob's per-agent JSONL files (`*-digest.jsonl`, `*-lessons.jsonl`) serve context injection into session prompts. Same data, different consumers, different access patterns.

### Dual Storage Architecture

```
session_end event
       │
       ├──► DigestWriter (SQL)    → session_digests table   → queries, recovery, UI
       │                            in may.db
       │
       └──► DigestWriter (JSONL)  → <agent>-digest.jsonl    → context injection
             LessonsWriter (JSONL) → <agent>-lessons.jsonl   → briefing compiler
```

The SQL table is the **queryable index**. Bob's JSONL files are the **context injection source**. Both are written by subscribers on the same events. They share the same data model but different storage formats.

---

## 2. Schema

### 2a. New Table: `session_digests`

```sql
CREATE TABLE IF NOT EXISTS session_digests (
  -- Identity (1:1 with sessions table)
  sessionId           TEXT PRIMARY KEY,
  agent               TEXT NOT NULL,
  
  -- Phase 1: Start (written on session_start event)
  task_summary        TEXT,           -- First 500 chars of task
  task_source         TEXT,           -- 'heartbeat' | 'escalation' | 'directive' | 'call' | 'workflow' | 'send' | 'task'
  
  -- Phase 2: Progress (updated on turn_end events and checkpoint calls)
  progress            TEXT,           -- Latest checkpoint summary or turn progress description
  turns_completed     INTEGER DEFAULT 0,
  ops_completed       INTEGER DEFAULT 0,
  last_progress_at    INTEGER,        -- Timestamp of last turn_end/checkpoint (for watchdog staleness)
  consecutive_error_turns INTEGER DEFAULT 0, -- Error turns at session end (stuck detection history)
  
  -- Phase 3: Outcome (written on session_end)
  status              TEXT,           -- 'success' | 'failure' | 'blocked' | 'partial' | 'error' | 'interrupted'
  summary             TEXT,           -- From finish().summary or session_end.outcome
  
  -- Structured outcome fields (from finish() params)
  deliverables        TEXT,           -- JSON array: [{path, description}]
  files_modified      TEXT,           -- JSON array: ["path1", "path2"]
  completed_items     TEXT,           -- JSON array: ["item1", "item2"]
  new_items           TEXT,           -- JSON array: ["task1", "task2"]
  blockers            TEXT,           -- JSON array: [{reason, context}]
  next_steps          TEXT,           -- Free text (for partial/blocked sessions)
  lessons             TEXT,           -- JSON array: [{category, content}]
  verification        TEXT,           -- JSON array: ["evidence1", "evidence2"]
  
  -- Failure analysis
  error               TEXT,           -- Error message (from session_end.error)
  root_cause          TEXT,           -- Classified: 'turn_limit' | 'provider_error' | 'stuck' | 'crash' | 'interrupted' | 'closed_by_user' | null
  
  -- Recovery (replaces ephemeral Maps in may.ts, cron.ts, session-subscribers.ts)
  resume_point        TEXT,           -- For interrupted sessions: what to resume (from checkpoint or next_steps)
  resume_attempted    INTEGER DEFAULT 0,  -- How many times auto-resume/P62 recovery was tried
  
  -- Relationships (denormalized for join-free queries)
  parent_session_id   TEXT,           -- From session_start.parentSessionId
  request_id          TEXT,           -- Links to requests table
  workflow_run_id     TEXT,           -- Links to workflow runs
  
  -- Timestamps
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
```

### 2b. Indexes

```sql
-- Primary query patterns:
CREATE INDEX IF NOT EXISTS idx_digest_agent       ON session_digests(agent, created_at);
CREATE INDEX IF NOT EXISTS idx_digest_status      ON session_digests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_digest_created     ON session_digests(created_at);
CREATE INDEX IF NOT EXISTS idx_digest_parent      ON session_digests(parent_session_id);
CREATE INDEX IF NOT EXISTS idx_digest_request     ON session_digests(request_id);
CREATE INDEX IF NOT EXISTS idx_digest_root_cause  ON session_digests(root_cause) WHERE root_cause IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_digest_source      ON session_digests(task_source, created_at);
```

**Index rationale**:
- `(agent, created_at)` — "show me optimizer's recent sessions" (most common human query, used by dashboard and agent health)
- `(status, created_at)` — "show me all failures" or "show me interrupted sessions needing resume"
- `(created_at)` — "show me today's sessions" (dashboard daily view)
- `(parent_session_id)` — "show me all children of this directive session" (tree traversal for eval)
- `(request_id)` — "what happened to this request?" (audit trail)
- `(root_cause) WHERE NOT NULL` — partial index for failure analysis queries only
- `(task_source, created_at)` — "show me all heartbeats" or "show me all directives"

### 2c. Why NOT Columns on `sessions`

The `sessions` table has 16,361+ rows. Adding 18+ columns would:
1. **Widen every row** — old sessions get NULL for all new fields, wasting space in page reads
2. **Create migration friction** — 18 ALTER TABLE statements vs one CREATE TABLE
3. **Mix update patterns** — `sessions` is updated by DbWriter on session_start and session_end; digest is updated by a separate subscriber at start, on every turn_end, and at end (3-10+ writes per session vs 2)
4. **Violate single responsibility** — `sessions` is a queryable mirror of meta.json; `session_digests` is a structured summary of what happened

A separate table with a 1:1 PK on sessionId keeps both clean.

---

## 3. Lifecycle: When Each Field Is Written

### Phase 1: Session Start
**Trigger**: `session_start` event  
**Fields written**: `sessionId, agent, task_summary, task_source, parent_session_id, request_id, workflow_run_id, created_at, updated_at`

```typescript
function onSessionStart(event: SessionStartEvent) {
  const source = classifyTaskSource(event.task);
  // Look up request association
  const req = db.prepare(
    'SELECT requestId FROM requests WHERE sessionId = ? LIMIT 1'
  ).get(event.sessionId) as { requestId: string } | undefined;
  
  db.run(`INSERT OR REPLACE INTO session_digests 
    (sessionId, agent, task_summary, task_source, parent_session_id, 
     request_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [event.sessionId, event.agent, event.task.slice(0, 500), source,
     event.parentSessionId ?? null, req?.requestId ?? null,
     Date.now(), Date.now()]);
     
  // Side-effect: also populate sessions.requestId if found
  if (req) {
    db.run('UPDATE sessions SET requestId = ? WHERE sessionId = ?',
      [req.requestId, event.sessionId]);
  }
}
```

### Phase 2: Progress (mid-session)
**Trigger**: `turn_end` events  
**Fields updated**: `turns_completed, ops_completed, last_progress_at, consecutive_error_turns, updated_at`

```typescript
function onTurnEnd(event: TurnEndEvent) {
  const now = Date.now();
  // Only update fields that the turn_end event provides
  // consecutiveErrorTurns: if errorCount > 0 for this turn, increment; else reset
  db.run(`UPDATE session_digests SET
    turns_completed = COALESCE(?, turns_completed),
    ops_completed = ops_completed + ?,
    last_progress_at = ?,
    consecutive_error_turns = CASE 
      WHEN ? > 0 THEN consecutive_error_turns + 1 
      ELSE 0 
    END,
    updated_at = ?
    WHERE sessionId = ?`,
    [event.turnCount ?? null, event.toolCalls ?? 0, now,
     event.errorCount ?? 0, now, event.sessionId]);
}
```

### Phase 3: Outcome (session end)
**Trigger**: `session_end` event  
**Fields written**: All outcome fields

```typescript
function onSessionEnd(event: SessionEndEvent) {
  const fp = event.finishParams as Record<string, any> | undefined;
  const rootCause = classifyRootCause(event.status, event.error);
  const resumePoint = deriveResumePoint(event);
  
  db.run(`UPDATE session_digests SET
    status = ?,
    summary = ?,
    deliverables = ?,
    files_modified = ?,
    completed_items = ?,
    new_items = ?,
    blockers = ?,
    next_steps = ?,
    lessons = ?,
    verification = ?,
    error = ?,
    root_cause = ?,
    resume_point = ?,
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
}
```

### Root Cause Classification

Uses the same logic as `classify-error.ts` but maps to our root_cause enum:

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
```

### Task Source Classification

```typescript
function classifyTaskSource(task: string): string {
  if (task.startsWith('[heartbeat]')) return 'heartbeat';
  if (task.startsWith('[escalation]')) return 'escalation';
  if (task.startsWith('[cron:')) return 'cron';
  if (/^\[P[0-3]\]/.test(task)) return 'directive';
  return 'task';
}
```

### Resume Point Derivation

```typescript
function deriveResumePoint(event: SessionEndEvent): string | null {
  const fp = event.finishParams as Record<string, any> | undefined;
  // Prefer explicit next_steps from agent
  if (fp?.next_steps) return fp.next_steps;
  // Fall back to blockers if blocked
  if (fp?.blockers?.length > 0) {
    return `Blocked: ${fp.blockers.map((b: any) => b.reason).join('; ')}`;
  }
  // For interrupted sessions, indicate where they stopped
  if (event.status === 'interrupted' || event.status === 'error') {
    return event.error ?? 'Session interrupted — resume from last checkpoint';
  }
  return null;
}
```

---

## 4. Key Queries

### 4a. "Show me all sessions from today with their outcomes"

```sql
SELECT 
  d.sessionId, d.agent, d.task_source, d.task_summary,
  d.status, d.summary, d.turns_completed, d.ops_completed,
  d.root_cause, d.files_modified,
  e.quality, e.efficiency, e.verdict,
  json_extract(e.usage, '$.cost') as cost_usd
FROM session_digests d
LEFT JOIN evaluations e ON d.sessionId = e.sessionId
WHERE d.created_at >= ?  -- start of today (epoch ms)
ORDER BY d.created_at DESC;
```

### 4b. "Show me all failures with root causes"

```sql
SELECT 
  d.sessionId, d.agent, d.task_summary,
  d.status, d.root_cause, d.error, d.summary,
  d.blockers, d.turns_completed
FROM session_digests d
WHERE d.status IN ('failure', 'error')
  AND d.created_at >= ?
ORDER BY d.created_at DESC;
```

### 4c. "Show me interrupted sessions that need resuming"

```sql
SELECT 
  d.sessionId, d.agent, d.task_summary,
  d.root_cause, d.resume_point, d.resume_attempted,
  d.turns_completed, d.ops_completed
FROM session_digests d
WHERE d.status = 'interrupted'
  AND d.resume_attempted < 2
  AND d.root_cause NOT IN ('closed_by_user')
  AND d.created_at > ?  -- within last 2 hours
ORDER BY d.created_at DESC;
```

### 4d. "Agent health dashboard" (replaces circuit breaker's in-memory Map)

```sql
SELECT 
  d.agent,
  count(*) as total_sessions,
  count(CASE WHEN d.status = 'success' THEN 1 END) as successes,
  count(CASE WHEN d.status IN ('failure', 'error') THEN 1 END) as failures,
  count(CASE WHEN d.root_cause = 'turn_limit' THEN 1 END) as turn_limits,
  count(CASE WHEN d.root_cause = 'stuck' THEN 1 END) as stuck,
  count(CASE WHEN d.root_cause = 'provider_error' THEN 1 END) as provider_errors,
  avg(d.turns_completed) as avg_turns,
  avg(d.ops_completed) as avg_ops
FROM session_digests d
WHERE d.created_at >= ?  -- time window
GROUP BY d.agent
ORDER BY total_sessions DESC;
```

### 4e. "Is this agent's circuit breaker tripped?" (persistent replacement for cron.ts Map)

```sql
SELECT count(*) as recent_errors
FROM session_digests
WHERE agent = ?
  AND status IN ('error', 'failure')
  AND root_cause NOT IN ('closed_by_user')
  AND created_at > ?  -- CB_PROBE_INTERVAL_MS ago
ORDER BY created_at DESC
LIMIT ?;  -- CB_TRIP_THRESHOLD
```

### 4f. "Full audit trail for a request"

```sql
WITH RECURSIVE tree AS (
  SELECT * FROM requests WHERE requestId = ?
  UNION ALL
  SELECT r.* FROM requests r
  JOIN tree t ON r.parentRequestId = t.requestId
)
SELECT 
  t.requestId, t.toAgent, t.method, t.status as req_status,
  d.sessionId, d.status as sess_status, d.summary,
  d.deliverables, d.completed_items, d.root_cause
FROM tree t
LEFT JOIN session_digests d ON t.sessionId = d.sessionId
ORDER BY t.createdAt ASC;
```

### 4g. "What files were modified across agents this week?"

```sql
SELECT DISTINCT je.value as file_path, d.agent, d.sessionId, d.created_at
FROM session_digests d, json_each(d.files_modified) je
WHERE d.created_at >= ?  -- start of week
ORDER BY d.created_at DESC;
```

### 4h. "Recurring failure patterns for an agent"

```sql
SELECT root_cause, count(*) as occurrences,
  group_concat(substr(task_summary, 1, 80), ' | ') as example_tasks
FROM session_digests
WHERE agent = ? 
  AND status IN ('failure', 'error')
  AND created_at >= ?  -- time window
GROUP BY root_cause
ORDER BY occurrences DESC;
```

---

## 5. Recovery System Integration

### 5a. Why This Matters

Bob's design (§13) identifies 6 recovery mechanisms that all use ephemeral in-memory Maps. The digest table makes this state **persistent and queryable**, solving the critical problem of state loss on process restart.

| Recovery State | Current Location | Digest Location |
|---|---|---|
| Auto-resume attempt count | `Map<sessionId, count>` in session-subscribers.ts | `resume_attempted` column |
| Circuit breaker counts | `Map<agentName, {count, lastErrorAt}>` in cron.ts | SQL aggregate query on recent sessions |
| P62 recovery attempts | `Map<"agent:taskHash", count>` in may.ts | `resume_attempted` column |
| Stuck detector state | `Map<sessionId, StuckState>` in session-subscribers.ts | `consecutive_error_turns` column |
| Watchdog staleness | `setTimeout` / stale session scan | `last_progress_at` column |

### 5b. Recovery Classifier API

The unified recovery subscriber from Bob's §13.5 calls these DB functions:

```typescript
// Called by recovery classifier after session_end
export function getRecentFailureCount(
  persistDir: string, agent: string, windowMs: number
): number;

// Called on startup to find sessions needing resume
export function getResumableDigests(
  persistDir: string, maxAgeMs?: number
): SessionDigest[];

// Called by recovery classifier to increment resume count
export function incrementResumeAttempted(
  persistDir: string, sessionId: string
): void;

// Called by unified circuit breaker check
export function isCircuitBrokenFromDigests(
  persistDir: string, agent: string, threshold: number, windowMs: number
): boolean;
```

### 5c. Startup Recovery Enhancement

The existing `resumeStaleSessions()` in manager.ts runs before the EventBus is active. It can read digest entries to make better resume/abandon decisions:

```typescript
// Enhanced startup recovery (in manager.ts)
const digest = getDigest(persistDir, staleSessionId);
if (digest && digest.resume_attempted >= 2) {
  // Already retried twice — escalate instead of retrying
  escalateToHuman(staleSessionId, digest);
} else if (digest?.root_cause === 'provider_error') {
  // Provider issue — retry with shorter timeout
  resumeWithTimeout(staleSessionId, 5 * 60_000);
} else {
  // Default: resume normally
  resume(staleSessionId);
}
```

---

## 6. Consumer Integration

### 6a. Evaluator

**With digests**: Pre-filter sessions before sending to LLM evaluator.

```typescript
const digests = getDigestsByParent(persistDir, parentSessionId);
const worthEvaluating = digests.filter(d => 
  d.root_cause !== 'provider_error' && 
  d.root_cause !== 'closed_by_user' &&
  d.turns_completed > 1
);
```

The evaluator still needs the transcript for quality scoring — the digest doesn't replace that. But it reduces the number of sessions sent to the LLM evaluator and provides structured metadata for the eval context.

### 6b. Web UI / Dashboard

The digest table is the **primary data source** for any session dashboard. A single query returns everything a human needs to understand a session.

**API endpoint pattern**:
```
GET /api/sessions?since=<iso>&agent=<name>&status=<status>
→ Returns session_digests rows joined with evaluations
```

### 6c. Coach / Training System

```sql
SELECT d.sessionId, d.agent, d.root_cause, d.summary,
       e.efficiency, e.quality, e.issues
FROM session_digests d
JOIN evaluations e ON d.sessionId = e.sessionId
WHERE e.efficiency <= 2 AND d.root_cause = 'stuck'
  AND d.created_at >= ?;
```

### 6d. Bob's Context Injection System

Bob's DigestCompiler reads the JSONL files, not the SQL table. But when the compiler needs to answer cross-agent questions (§5.4 of Bob's doc), it can fall back to SQL:

```sql
-- Cross-agent file modifications (for briefing "Team Activity" section)
SELECT d.agent, d.sessionId, je.value as file_path, d.created_at
FROM session_digests d, json_each(d.files_modified) je
WHERE d.agent != ? AND d.created_at > ?
ORDER BY d.created_at DESC LIMIT 10;
```

---

## 7. Request ↔ Session ↔ Digest Join Strategy

Current state of joins:
- `requests.sessionId` → session (3,640 of 15,927 requests have this — 23%)
- `sessions.requestId` → request (**always NULL** — column exists but nothing writes to it)

### Fix (as part of digest writer):

On `session_start`, look up the associated request and populate both directions:

```typescript
const req = db.prepare(
  'SELECT requestId FROM requests WHERE sessionId = ? LIMIT 1'
).get(event.sessionId) as { requestId: string } | undefined;

if (req) {
  db.run('UPDATE sessions SET requestId = ? WHERE sessionId = ?', 
    [req.requestId, event.sessionId]);
  // Also stored in session_digests.request_id
}
```

---

## 8. Migration Plan

### Phase 1: Schema + Forward Writing (Implementation Day 1)

**Files to modify**:
1. **`src/lib/requests.ts`** — Add `session_digests` CREATE TABLE + indexes to SCHEMA constant. Add helper functions: `upsertDigestStart()`, `updateDigestProgress()`, `updateDigestOutcome()`, `getDigest()`, `getDigestsByAgent()`, etc.
2. **`src/lib/session-subscribers.ts`** — Add `createDigestWriter()` subscriber
3. **`src/app/may.ts`** — Wire `createDigestWriter()` into EventBus subscription chain (line ~224)

**Risk**: Zero. Additive change, no existing behavior modified.

### Phase 2: Backfill (Implementation Day 1-2)

One-time SQL migration script that populates digests from existing `sessions` + `evaluations` tables:

```sql
INSERT OR IGNORE INTO session_digests 
  (sessionId, agent, task_summary, status, summary, error, root_cause,
   parent_session_id, ops_completed, turns_completed, created_at, updated_at)
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
  s.parentSessionId, 
  s.opCount,
  0,  -- turns_completed unknown for historical sessions
  s.startedAt, 
  COALESCE(s.endedAt, s.startedAt)
FROM sessions s;
```

**Backfill quality**: Gives us root_cause classification for all 16K+ sessions. Rich fields (deliverables, files_modified, lessons) only exist for new sessions going forward — acceptable.

### Phase 3: Recovery Migration (Implementation Day 3-4)

1. Add `getRecentFailureCount()` and `isCircuitBrokenFromDigests()` to requests.ts
2. Modify circuit breaker in cron.ts to use DB query instead of in-memory Map
3. Modify P62 recovery in may.ts to check `resume_attempted` from digest
4. Modify auto-resume in session-subscribers.ts to check `resume_attempted` from digest

**This is the highest-value change** — makes recovery state survive restarts.

### Phase 4: Consumer Migration (Day 5+)

1. Update evaluator to use digest for pre-filtering
2. Add API endpoints for UI consumption
3. Update health-trend handler to use digest aggregations
4. Wire Bob's cross-agent compiler to use SQL fallback for file queries

---

## 9. DB Function API

### Write Functions (called by DigestWriter subscriber)

```typescript
/** Phase 1: Create initial digest on session start */
export function upsertDigestStart(persistDir: string, opts: {
  sessionId: string;
  agent: string;
  taskSummary: string;
  taskSource: string;
  parentSessionId?: string | null;
  requestId?: string | null;
  workflowRunId?: string | null;
}): void;

/** Phase 2: Update progress on turn_end */
export function updateDigestProgress(persistDir: string, sessionId: string, opts: {
  turnsCompleted?: number;
  opsThisTurn?: number;  // added to cumulative ops_completed
  errorCount?: number;   // if > 0, increments consecutive_error_turns; else resets to 0
}): void;

/** Phase 3: Write final outcome on session_end */
export function updateDigestOutcome(persistDir: string, sessionId: string, opts: {
  status: string;
  summary?: string | null;
  deliverables?: Array<{ path: string; description: string }> | null;
  filesModified?: string[] | null;
  completedItems?: string[] | null;
  newItems?: string[] | null;
  blockers?: Array<{ reason: string; context: string }> | null;
  nextSteps?: string | null;
  lessons?: Array<{ category: string; content: string }> | null;
  verification?: string[] | null;
  error?: string | null;
  rootCause?: string | null;
  resumePoint?: string | null;
  turnsCompleted?: number;
  opsCompleted?: number;
}): void;

/** Increment resume_attempted counter (called by recovery classifier) */
export function incrementResumeAttempted(persistDir: string, sessionId: string): void;
```

### Read Functions (called by consumers)

```typescript
/** Get a single digest by sessionId */
export function getDigest(persistDir: string, sessionId: string): SessionDigest | null;

/** Get recent digests for an agent, ordered by created_at DESC */
export function getDigestsByAgent(
  persistDir: string, agent: string, opts?: { since?: number; limit?: number }
): SessionDigest[];

/** Get digests by status */
export function getDigestsByStatus(
  persistDir: string, status: string, opts?: { since?: number; limit?: number }
): SessionDigest[];

/** Get all child digests for a parent session */
export function getDigestsByParent(persistDir: string, parentSessionId: string): SessionDigest[];

/** Get digests where resume is possible */
export function getResumableDigests(persistDir: string, maxAgeMs?: number): SessionDigest[];

/** Count recent failures for circuit breaker check */
export function getRecentFailureCount(
  persistDir: string, agent: string, windowMs: number
): number;

/** Full circuit breaker check: are there >= threshold failures in the window? */
export function isCircuitBrokenFromDigests(
  persistDir: string, agent: string, threshold: number, windowMs: number
): boolean;
```

### SessionDigest Type

```typescript
export interface SessionDigest {
  sessionId: string;
  agent: string;
  taskSummary: string | null;
  taskSource: string | null;
  progress: string | null;
  turnsCompleted: number;
  opsCompleted: number;
  lastProgressAt: number | null;
  consecutiveErrorTurns: number;
  status: string | null;
  summary: string | null;
  deliverables: Array<{ path: string; description: string }> | null;
  filesModified: string[] | null;
  completedItems: string[] | null;
  newItems: string[] | null;
  blockers: Array<{ reason: string; context: string }> | null;
  nextSteps: string | null;
  lessons: Array<{ category: string; content: string }> | null;
  verification: string[] | null;
  error: string | null;
  rootCause: string | null;
  resumePoint: string | null;
  resumeAttempted: number;
  parentSessionId: string | null;
  requestId: string | null;
  workflowRunId: string | null;
  createdAt: number;
  updatedAt: number;
}
```

---

## 10. Performance Considerations

### Write Path
- Each session produces 3-10 digest writes: 1 start + 1-8 turn_end + 1 session_end
- SQLite WAL mode handles concurrent reads during writes
- Digest writes are best-effort (subscriber pattern) — don't block the session

### Read Path
- Dashboard queries hit indexed columns → sub-ms for single agent
- Aggregate queries (health dashboard) scan more rows but bounded by time window
- JSON columns (deliverables, files_modified) NOT indexed — use for display only

### Storage
- Estimated row size: ~2KB average (mostly JSON arrays)
- 16K existing sessions × 2KB = ~32MB (after backfill)
- Growth: ~200 sessions/day × 2KB = ~400KB/day — negligible

### What NOT to Index
- JSON columns — SQLite JSON queries scan regardless
- `summary` and `next_steps` — text search is rare
- `resume_attempted` — only used in compound queries where status is already indexed

---

## 11. Coordination Matrix: Who Builds What

| Component | Owner | Location |
|-----------|-------|----------|
| SQL schema (CREATE TABLE) | **Optimizer** | `src/lib/requests.ts` SCHEMA constant |
| DB write functions (upsert/update) | **Optimizer** | `src/lib/requests.ts` new functions |
| DB read functions (get/query) | **Optimizer** | `src/lib/requests.ts` new functions |
| `createDigestWriter()` SQL subscriber | **Optimizer** | `src/lib/session-subscribers.ts` |
| Root cause classifier | **Shared** | `src/lib/classify-error.ts` (existing, extend) |
| JSONL DigestWriter subscriber | **Bob** | `src/lib/session-subscribers.ts` |
| JSONL LessonsWriter subscriber | **Bob** | `src/lib/session-subscribers.ts` |
| DigestCompiler (briefing text) | **Bob** | new `src/lib/digest-compiler.ts` |
| `buildSessionContext()` integration | **Bob** | `src/lib/manager.ts` |
| Recovery classifier (unified) | **Shared** (Phase 3) | new `src/lib/recovery-classifier.ts` |
| Backfill migration script | **Optimizer** | one-time script |
| EventBus wiring | **Whoever goes first** | `src/app/may.ts` |

---

## 12. Resolved Design Decisions

### Q1: Should digests survive session archival?
**Answer: Yes, naturally.** Digest rows are in a separate table keyed by sessionId. When session directories move from active→history, the digest row stays in the DB. No `archived` flag needed — the sessions table's status already indicates this.

### Q2: Digest for workflow runs?
**Answer: Deferred.** Workflow runs aggregate multiple sessions. A `workflow_digests` table could summarize all steps, but the existing WorkflowRun JSON persistence is adequate. Individual step sessions already get digests. A workflow-level view is a JOIN: `SELECT * FROM session_digests WHERE workflow_run_id = ?`.

### Q3: Digest TTL?
**Answer: No TTL.** At 2KB/row and 200 sessions/day, storage growth is ~150MB/year. SQLite handles this easily. Historical data is valuable for trend analysis. If cleanup is ever needed, `DELETE WHERE created_at < ?` suffices.

### Q4: Interaction with Bob's JSONL files?
**Answer: Complementary, not competing.** SQL table serves queries/recovery/UI. JSONL files serve context injection. Both written by subscribers on the same events. The DigestWriter in session-subscribers.ts writes to SQL; Bob's DigestWriter writes to JSONL. They can be the same function or separate subscribers — implementation decision at coding time.

### Q5: `plan` field from Bob's design?
**Answer: Omitted from SQL schema.** Bob's DigestEntry includes `plan` (extracted from first assistant turn). This is valuable for context injection (JSONL) but low-value for SQL queries. If needed later, it's a single ALTER TABLE ADD COLUMN. No one will query "find sessions where plan contains X" — they'll query by status, agent, root_cause.

### Q6: Bob's `filesRead` and `execCommands`?
**Answer: JSONL only.** These are rich context data valuable for briefings (Bob's compiler) but not for SQL queries. The SQL table stores `files_modified` (from session_end event, already available) but not `filesRead` or `execCommands`. Bob's event enrichment (§6 Phase 1, option (a)) provides these to the JSONL writer.

---

## 13. Testing Strategy

### Unit Tests
- `classifyRootCause()` — test all error patterns
- `classifyTaskSource()` — test all task prefixes
- `deriveResumePoint()` — test finish params combinations
- DB write/read round-trip for all field types

### Integration Tests
- Simulate session_start → turn_end × N → session_end event sequence, verify digest row
- Backfill script on a test DB with known sessions
- Circuit breaker query accuracy vs the current in-memory Map behavior

### Regression Tests
- Existing tests still pass (additive change, no behavior modification)
- Recovery behavior matches current system during transition period
