# Session Digests — Schema v5

**Multiple rows per session.** Each lifecycle event appends a row. ALL digests use LLM.
Classifier output stored inline — no separate table.

## Table

```sql
CREATE TABLE IF NOT EXISTS session_digests (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId TEXT NOT NULL,
  agent     TEXT NOT NULL,
  trigger   TEXT NOT NULL,  -- see Trigger Types below
  step      INTEGER NOT NULL, -- monotonic per session (1, 2, 3...)
  task      TEXT,             -- original task (on session_start; null on later rows)
  what_happened  TEXT,        -- LLM-written, 1-3 sentences (null for session_start)
  outcome   TEXT,             -- 'success'|'partial'|'failure'|'in_progress'|null
  still_open     TEXT,
  files_modified TEXT,        -- JSON array
  details   TEXT,             -- JSON object: structured metadata per trigger
  action    TEXT,             -- classifier output: 'resume'|'requeue'|'escalate'|'kill'|'nothing'|null
  action_reason TEXT,         -- why classifier chose this action (null if no action)
  created_at INTEGER NOT NULL,
  UNIQUE(sessionId, step)
);
CREATE INDEX IF NOT EXISTS idx_sd_session ON session_digests(sessionId, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sd_agent   ON session_digests(agent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sd_action  ON session_digests(action, created_at DESC)
  WHERE action IS NOT NULL;
```

## Migration (if table exists from phase 1)

```sql
ALTER TABLE session_digests ADD COLUMN action TEXT;
ALTER TABLE session_digests ADD COLUMN action_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_sd_action ON session_digests(action, created_at DESC)
  WHERE action IS NOT NULL;
```

## Four Operations

| Operation | Trigger | Description |
|-----------|---------|-------------|
| **CREATE** | `session_start` | Metadata only — sessionId, agent, task, timestamp |
| **DIGEST** | all others | LLM reads incremental context → writes `what_happened`, `outcome` |
| **CLASSIFY** | recovery triggers | Reads latest digest, sets `action` + `action_reason` on same row |
| **QUERY** | coaching/health | Read-only analytics across digests |

**CLASSIFY** runs after DIGEST on recovery-relevant triggers (`stuck_detected`, `circuit_break`,
`timeout`, `zombie_cleanup`, `resume_exhausted`, `overflow`). One function: reads digest, returns action.
Written back to the same row via `UPDATE ... SET action=?, action_reason=? WHERE id=?`.

## Incremental LLM Input

Every digest (except `session_start`) calls LLM with incremental context:
- **First digest** (step=2): LLM reads full transcript so far (~small early on)
- **Subsequent digests**: LLM reads `previous what_happened + delta transcript` (only new turns)
- **Session end**: LLM reads `last what_happened + remaining transcript` (piggybacked on eval)

Cost: ~2-5KB per mid-session digest. Never full transcript.

## Trigger Types

| Trigger | Source | Classifies? |
|---------|--------|:-----------:|
| `session_start` | session creation (no LLM) | — |
| `checkpoint` | agent checkpoint() — `details.forced` if infra | — |
| `end` | evaluateTask() (piggybacked on eval) | — |
| `stuck_detected` | createStuckDetector | ✓ |
| `circuit_break` | onCircuitBreak | ✓ |
| `timeout` | setupTimeout | ✓ |
| `zombie_cleanup` | cleanupZombieSessions | ✓ |
| `resume_exhausted` | escalate callback | ✓ |
| `auto_resume` | session-subscribers | — |
| `escalation` | escalateBlockedSession | — |
| `recovery_requeue` | session_end recovery | — |
| `infra_retry` | runAgentWithRetry | — |
| `overflow` | handleOverflow | ✓ |

## Key Queries

```sql
-- Full session timeline
SELECT * FROM session_digests WHERE sessionId=? ORDER BY step;
-- Crash recovery: latest state
SELECT * FROM session_digests WHERE sessionId=? ORDER BY step DESC LIMIT 1;
-- Anomaly feed
SELECT * FROM session_digests
  WHERE trigger NOT IN ('session_start','checkpoint','end')
  AND created_at > ? ORDER BY created_at DESC;
-- Agent health
SELECT agent,
  SUM(CASE WHEN trigger='end' THEN 1 ELSE 0 END) as clean,
  SUM(CASE WHEN trigger IN ('stuck_detected','circuit_break','timeout') THEN 1 ELSE 0 END) as problems
FROM session_digests WHERE created_at > unixepoch()-86400 GROUP BY agent;
-- Classifier action log
SELECT trigger, what_happened, action, action_reason FROM session_digests
  WHERE action IS NOT NULL AND created_at > ? ORDER BY created_at DESC;
-- Requeue vs escalate by agent
SELECT agent, action, COUNT(*) FROM session_digests
  WHERE action IN ('requeue','escalate') GROUP BY agent, action;
-- Kill rate (are we killing too aggressively?)
SELECT agent, COUNT(*) as kills FROM session_digests
  WHERE action='kill' AND created_at > unixepoch()-86400 GROUP BY agent;
```
