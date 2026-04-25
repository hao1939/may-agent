# Session Digest — Implementation Plan (v5 FINAL)

**Author:** Bob | **Date:** 2026-04-05 | **Status:** Ready to build
**Supersedes:** all prior versions. This is THE document for implementation.

---

## 1. Schema (optimizer's explicit columns)

```sql
CREATE TABLE IF NOT EXISTS session_digests (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId      TEXT NOT NULL,
  agent          TEXT NOT NULL,
  trigger        TEXT NOT NULL,
  step           INTEGER NOT NULL,
  task           TEXT,
  what_happened  TEXT,        -- LLM-written, 1-3 sentences (null on session_start)
  outcome        TEXT,        -- 'success'|'partial'|'failure'|'in_progress'|null
  still_open     TEXT,
  files_modified TEXT,        -- JSON array
  details        TEXT,        -- JSON object: structured metadata per trigger
  created_at     INTEGER NOT NULL,
  UNIQUE(sessionId, step)
);
CREATE INDEX IF NOT EXISTS idx_sd_session ON session_digests(sessionId, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sd_agent   ON session_digests(agent, created_at DESC);
```

## 2. Core function: `upsertDigest()`

```typescript
async function upsertDigest(sessionId: string, trigger: string, ctx?: string): Promise<void> {
  const last = getLastDigest(sessionId);         // ORDER BY step DESC LIMIT 1
  if (trigger === 'session_start') {
    // CREATE — no LLM, metadata only
    insertDigest({ sessionId, agent, trigger, step: 1, task, created_at: Date.now() });
    return;
  }
  const delta = readTranscriptSince(sessionId, last?.created_at ?? 0);
  const result = await llmSynthesize({
    previous: last?.what_happened, delta, trigger, trigger_context: ctx
  }); // Returns: { what_happened, outcome, still_open, files_modified }
  insertDigest({ sessionId, agent, trigger, step: (last?.step ?? 0) + 1,
    ...result, created_at: Date.now() });
}
// For `end`: eval prompt extended to also produce digest fields. One LLM call, two outputs.
```

**Incremental cost model:** Each call reads `previous what_happened + delta transcript` (~2-5KB).
A 50-turn session with 5 digests processes ~10 turns per call, never 50.

## 3. Trigger map (15 triggers, all except `session_start` use LLM)

| Trigger | Source file | Fires when |
|---------|-------------|------------|
| `session_start` | `manager.ts:887` | Session created (no LLM) |
| `checkpoint` | `tools/checkpoint.ts` | Agent or infra checkpoints |
| `end` | `may.ts:397` | Normal end (piggybacked on eval) |
| `end_heuristic` | `may.ts` | End when eval skipped |
| `stuck_detected` | `session-subscribers.ts:259` | Error turn threshold hit |
| `circuit_break` | `may.ts:233` | Stuck detector kills session |
| `timeout` | `manager.ts:623` | Watchdog timer fires |
| `zombie_cleanup` | `manager.ts:1066` | Stale running session found |
| `auto_resume` | `session-subscribers.ts:314` | Interrupted session resuming |
| `resume_exhausted` | `may.ts:252` | All resume attempts failed |
| `infra_retry` | `manager-retry.ts:266` | Infra retrying after error |
| `overflow` | `completion.ts:119` | Context overflow |
| `escalation` | `manager.ts:738` | Blocked/failed → parent |
| `recovery_requeue` | `may.ts:370` | Infra error → new session |
| `shallow_heartbeat` | `completion.ts:143` | Heartbeat did no work |

## 4. The classifier: digest + classify replaces 6 mechanisms

### What gets replaced

| # | Current mechanism | Detection | Action | Digest replacement |
|---|---|---|---|---|
| 1 | **Stuck detector** (`createStuckDetector`) | Counts consecutive error turns in-memory Map | Warns at 4, cancels at 6, fires circuit-break | **Detection stays** (turn counter is cheap). After cancel, fires `stuck_detected` trigger → digest → classifier decides next step |
| 2 | **Circuit breaker** (`onCircuitBreak`) | Callback from stuck detector | Sends diagnosis task to May | `circuit_break` trigger → digest → classifier: `escalate` with LLM-written context instead of raw error string |
| 3 | **Auto-resume** (`createAutoResume`) | `session_end` where status=interrupted + opCount>0 | Retries up to 2x, then escalates | `auto_resume` trigger → digest → classifier: `resume` or `escalate` based on understanding, not just attempt count |
| 4 | **Recovery requeue** (may.ts:365) | `session_end` where `classifyError(error)==='infra'` | Requeues task up to 3x, pattern-matches error strings | `recovery_requeue` trigger → digest → classifier: `requeue` or `escalate`. **Key win:** LLM understands error context, replaces brittle `classifyError()` string matching |
| 5 | **Escalation** (`escalateBlockedSession`) | `finish(status='blocked'\|'failure')` | Sends escalation task to parent/May | `escalation` trigger → digest → classifier: `escalate` with LLM summary instead of concatenated blocker strings |
| 6 | **Zombie cleanup** (`cleanupZombieSessions`) | Running in DB but not in memory, >30min | Marks interrupted, archives | **Cleanup stays** (DB/disk state, can't LLM away). After marking interrupted, fires `zombie_cleanup` trigger → digest → classifier decides if work is recoverable |

### The classifier function

```typescript
type Action = 'resume' | 'requeue' | 'escalate' | 'kill' | 'nothing';

function classifyDigest(digest: DigestRow, trigger: string): { action: Action; reason: string } {
  // Decision tree — reads LLM-synthesized digest, not raw errors
  switch (trigger) {
    case 'stuck_detected':
    case 'circuit_break':
      // Was it making progress despite errors? → escalate with context
      // Pure loop with no progress? → kill, nothing more to do
      return digest.outcome === 'in_progress' && digest.still_open
        ? { action: 'escalate', reason: digest.still_open }
        : { action: 'nothing', reason: 'No recoverable work' };

    case 'auto_resume':
      // Digest tells us what was interrupted — worth resuming?
      return digest.still_open
        ? { action: 'resume', reason: `Resume: ${digest.still_open}` }
        : { action: 'nothing', reason: 'Nothing left to do' };

    case 'resume_exhausted':
      return { action: 'escalate', reason: `Exhausted retries: ${digest.what_happened}` };

    case 'recovery_requeue':
      // LLM understood the error — was it transient infra or agent bug?
      return digest.outcome === 'failure'
        ? { action: 'escalate', reason: digest.what_happened }
        : { action: 'requeue', reason: 'Transient error, work in progress' };

    case 'escalation':
      return { action: 'escalate', reason: digest.what_happened };

    case 'zombie_cleanup':
      return digest.still_open
        ? { action: 'requeue', reason: `Zombie had unfinished: ${digest.still_open}` }
        : { action: 'nothing', reason: 'No recoverable work' };

    case 'timeout':
      return digest.still_open
        ? { action: 'escalate', reason: `Timed out with open work: ${digest.still_open}` }
        : { action: 'nothing', reason: 'Timed out, nothing critical left' };

    default:
      return { action: 'nothing', reason: 'Informational trigger' };
  }
}
```

**Key insight:** Detection (stuck counter, timeout timer, zombie scanner) stays — these are cheap, reliable triggers. Understanding (what happened, is it recoverable) moves to LLM via digest. Action (resume/requeue/escalate) moves to classifier reading the digest. **One place for understanding, one place for decisions.**

## 5. Migration phases

### Phase 1: Foundation (additive, breaks nothing)
- Add `session_digests` table to `persistence.ts`
- Implement `upsertDigest()`, `getLastDigest()`, `llmSynthesize()`
- Wire `session_start` (CREATE) and `checkpoint` triggers
- Wire `end` trigger (piggyback on eval LLM call)
- **Test:** Verify digest rows appear for normal sessions

### Phase 2: System hook triggers (still additive)
- Wire remaining 12 triggers — each is one `upsertDigest()` call at the existing event site
- **Test:** All 15 trigger types produce digest rows

### Phase 3: Shadow classifier
- Implement `classifyDigest()` alongside existing mechanisms
- Log both decisions: `[shadow] classifier=${action} vs existing=${what_happened}`
- Compare for 24-48h. Fix classifier decision tree as needed.
- **Test:** >95% agreement between classifier and existing mechanisms

### Phase 4: Switchover (one mechanism at a time)
- **4a:** Recovery requeue → classifier (biggest win: replaces `classifyError()` string matching)
- **4b:** Circuit breaker action → classifier (replaces raw error string in diagnosis task)
- **4c:** Escalation → classifier (replaces concatenated blocker strings)
- **4d:** Auto-resume → classifier (replaces blind retry-count logic)
- Each: swap, monitor 24h, proceed or revert.

## 6. What stays as-is

| Mechanism | Why it stays |
|-----------|-------------|
| **Watchdog timer** | Defense-in-depth. Fires `timeout` trigger → digest, but timer itself unchanged |
| **Stuck detector counter** | Cheap turn-level detection. Fires `stuck_detected` trigger, but counting logic unchanged |
| **Zombie scanner** | DB/disk state check. Fires `zombie_cleanup` trigger, but scan logic unchanged |
| **Session JSONL** | Turn-level detail. Digests read from it, never replace it |
| **Evaluation** | End digest piggybacks on eval. Eval itself unchanged |
| **Cron circuit breaker** | Separate concern (cron scheduling). Not session-level recovery |
