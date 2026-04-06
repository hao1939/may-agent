# Session Digest System

**Status:** Approved for implementation  
**Date:** 2026-04-05  
**Authors:** Bob (architecture), Optimizer (storage/queries), Hao (direction)

---

## 1. The Problem

### What triggered this

A human sends a directive to May: "make agents better at using skills." May processes it, dispatches work, agents run sessions. Two hours later the human asks "what happened?" There's no good answer. The data exists — scattered across session JSONLs, the requests DB, agent workspace files, evaluation scores — but nothing connects "what I asked for" to "what actually happened."

### The deeper issues

1. **Human directives vanish.** Chat messages enter the live session context. After compaction or restart, the directive is gone. The human's intent is buried in thousands of lines of conversation history.

2. **Progress lost on crashes.** When the SSH SIGTTIN freeze killed the process, sessions with 100+ tool operations were aborted. The file changes survived on disk, but nobody knew what the agent was trying to do or where it left off. We had to manually resume 26 sessions.

3. **Recovery is fragmented.** Six separate mechanisms (AutoResume, circuit breaker, P62 recovery, escalation, stuck detector, watchdog) each with their own detection logic, in-memory Maps, and action paths. All Maps lost on restart. A fundamentally broken task gets retried infinitely because the retry counter reset.

4. **No audit trail.** "Why did tech-lead fail 6 times yesterday?" requires parsing raw JSONLs, querying the sessions DB, cross-referencing evaluations. Nobody does this systematically.

### What we want

One place to ask: what was this session about, what happened, what's the result, what's still open? Both human-readable and machine-queryable. Survives restarts. Feeds recovery, evaluation, and human audit from the same data.

---

## 2. How We Got Here

### Starting point: track human directives

The original ask was "how do we make sure agents follow orders?" We explored:

- **Directive tracking system** — a new DB table for human orders with status tracking. Rejected: over-engineered for the problem. The agents already have `message()` for task assignment and the requests DB for tracking.

- **orders.md / directives.md** — May writes directives to a file, reads it on every heartbeat. Rejected: goes backwards from DB-based tracking. Also, text rules don't change behavior (KE-002, 0/19). May would forget to maintain the file.

- **New tool for writing directives** — agents call `directive.create()` to persist structured tasks. Rejected: same KE-002 problem. Adding a tool doesn't mean agents will use it.

### Pivot: the real problem is session observability

The directive tracking problem is a symptom. The root cause: there's no structured understanding of what any session did. If every session had a digest ("here's what happened"), human directives track themselves — the human sees the directive in the chat, sees the dispatched sessions, sees each session's digest.

### Discovery: agents already journal

Bob maintains `workspace/todo.md` and `workspace/journal.md`. So does coach, scout, optimizer. They track milestones, results, state, next steps. This is the natural pattern — agents write down what they're doing.

But agent journals are per-agent workspace files. They're not queryable, not structured, not connected to the session lifecycle. And we previously removed `todo.md` in favor of the DB request tracker because agents were bad at maintaining files consistently.

### Discovery: the evaluator already reads transcripts

The evaluator processes nearly every session (17K evaluations for 16K sessions). It reads the full transcript, scores quality and efficiency. Adding "also produce a digest" to the same LLM call costs nothing — the transcript is already loaded.

### Convergence: digest as evaluation byproduct

The session digest is not a new system. It's an extension of evaluation. The evaluator already understands what happened in a session. We just need it to write that understanding down in a structured, queryable format.

---

## 3. Design Decisions

### DB table, not files

**Decision:** Store digests in a `session_digests` DB table with explicit columns.

**Why not files (Bob's initial JSONL proposal):** Bob proposed `<agent>-digest.jsonl` files alongside the existing memory JSONL. This is natural for agents (they can `read()` the file) but painful for queries. "Show me all failures with root causes" requires scanning every agent's JSONL. SQL handles this trivially.

**Why not columns on the `sessions` table (considered and rejected):** The `sessions` table has 16K+ rows, is written at session start and end (2 writes), and mirrors `meta.json`. Digests update multiple times per session (start, checkpoints, hooks, end) — different write cadence. Mixing them creates schema bloat and write contention.

**Why a separate table:** Clean separation. Sessions table stays simple (metadata mirror). Digests table captures lifecycle understanding. 1:many relationship (multiple digest entries per session).

### Multiple rows per session, not one updated row

**Decision:** Each lifecycle event appends a new row. The latest row is the current state.

**Why:** Append-only = audit trail. You can see the full timeline: "started → checkpointed at step 3 → stuck at step 5 → escalated." With a single updated row, you only see the final state. The history is the value for debugging and human audit.

### LLM on every digest, not just session end

**Decision:** Every digest trigger (except session_start) uses an LLM call to synthesize what happened.

**Why not mechanical extraction:** We initially proposed mechanical extraction for mid-session digests (just pull tool names and file paths from events). But mechanical gives you "edited auth.ts" while LLM gives you "found the null pointer bug in auth.ts line 42, fixing it by adding a guard clause." The understanding is the whole point — a list of tool calls is already in the JSONL.

**Cost concern addressed by incremental input:** Each LLM call reads `previous digest + delta transcript since last digest`, not the full transcript. A 50-turn session with 5 digests processes ~10 turns per call. Cost: ~$0.003-0.005 per digest. Mid-session digests are rare (~20/day), session-end digests piggyback on evaluation (free). Total: ~$0.10/day.

### Combine with evaluation

**Decision:** Session-end digest is produced by the same LLM call as the evaluation.

**Why:** The evaluator already reads the full transcript for every session. Extending its prompt to also produce digest fields adds ~100 output tokens. Zero additional cost. This also means the `evaluate-sessions` cron job can be dropped — everything is event-driven via the `session_end` bus event.

**Evidence:** 17,177 evaluations for 16,369 sessions (105% — some re-evaluated). The evaluator already covers the full population.

### Forced checkpoint = time-based trigger

**Decision:** If an agent hasn't checkpointed in N minutes, infrastructure forces a checkpoint. The checkpoint triggers a digest.

**Why not a separate time-based digest mechanism:** One mechanism (checkpoint) with two triggers (agent-initiated, timer-forced). The timer is the safety net. The checkpoint tool already exists. Adding a `details.forced: true` flag distinguishes the two. No new concept needed.

### Classifier replaces 6 recovery mechanisms

**Decision:** Detection stays as cheap code (turn counters, timers, DB scans). Understanding moves to LLM (digest). Decisions centralize in one classifier function.

**What we're replacing:**

| Mechanism | Current approach | Problem |
|---|---|---|
| AutoResume | In-memory Map, checks turnCount (broken — always 0) | Lost on restart, wrong signal |
| Circuit breaker | In-memory Map, counts consecutive errors | Lost on restart |
| P62 Recovery | In-memory Map, pattern-matches error strings | Lost on restart, brittle regex |
| Escalation | Parses finishParams, concatenates blocker strings | Raw strings, no understanding |
| Stuck detector | In-memory Map, counts error turns | Lost on restart |
| Watchdog | Timer, checks runtime | Stays as-is (defense-in-depth) |

**What we're gaining:** Persistent state (survives restarts), richer context (LLM-synthesized understanding instead of error string matching), one decision point (classifier function), full audit trail (action + reason stored on the digest row).

**Evidence that drove this:** We found 36 sessions killed by turn limits, 26 sessions interrupted by the SSH freeze that were never resumed because the retry counter was in an in-memory Map that reset on restart. The optimizer session with 198 ops and the coach session with 157 ops — both lost because in-memory state didn't survive.

---

## 4. Schema

```sql
CREATE TABLE IF NOT EXISTS session_digests (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId      TEXT NOT NULL,
  agent          TEXT NOT NULL,
  trigger        TEXT NOT NULL,
  step           INTEGER NOT NULL,  -- monotonic per session (1, 2, 3...)
  task           TEXT,              -- original task (on session_start; null on later rows)
  what_happened  TEXT,              -- LLM-written, 1-3 sentences (null for session_start)
  outcome        TEXT,              -- 'success'|'partial'|'failure'|'in_progress'|'interrupted'|null
  still_open     TEXT,              -- what remains to be done
  files_modified TEXT,              -- JSON array
  details        TEXT,              -- JSON object: trigger-specific metadata
  action         TEXT,              -- classifier output: 'resume'|'requeue'|'escalate'|'kill'|'nothing'|null
  action_reason  TEXT,              -- why classifier chose this action
  created_at     INTEGER NOT NULL,
  UNIQUE(sessionId, step)
);
CREATE INDEX IF NOT EXISTS idx_sd_session ON session_digests(sessionId, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sd_agent   ON session_digests(agent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sd_action  ON session_digests(action, created_at DESC)
  WHERE action IS NOT NULL;
```

**Why explicit columns (optimizer's approach, not bob's JSON blob):** SQL can filter by `outcome`, `trigger`, `action` without JSON parsing. The dashboard query "show me all failures" is `WHERE outcome = 'failure'`, not `WHERE json_extract(digest, '$.outcome') = 'failure'`.

---

## 5. Three Operations

### CREATE (session start)
No LLM. Insert metadata: sessionId, agent, task, timestamp. Cheap, synchronous.

### DIGEST (any significant state change)
LLM reads incremental context → writes what_happened, outcome, still_open, files_modified.

```
First digest:     LLM reads [session start → now]            (small early on)
Subsequent:       LLM reads [previous what_happened + delta]  (only new turns)
Session end:      LLM reads [last what_happened + remaining]  (piggybacked on eval)
```

### CLASSIFY (recovery decision)
Reads the latest digest. Returns action + reason. Written back to the same row. Only runs on recovery-relevant triggers.

---

## 6. Core Function

```typescript
async function upsertDigest(sessionId: string, trigger: string, ctx?: string): Promise<void> {
  const last = getLastDigest(sessionId);

  if (trigger === 'session_start') {
    insertDigest({ sessionId, agent, trigger, step: 1, task, created_at: Date.now() });
    return;
  }

  const delta = readTranscriptSince(sessionId, last?.created_at ?? 0);
  const result = await llmSynthesize({
    previous: last?.what_happened,
    delta,
    trigger,
    trigger_context: ctx
  });

  const step = (last?.step ?? 0) + 1;
  const id = insertDigest({ sessionId, agent, trigger, step, ...result, created_at: Date.now() });

  if (CLASSIFY_TRIGGERS.has(trigger)) {
    const { action, reason } = classifyDigest(result, trigger);
    updateDigestAction(id, action, reason);
    executeAction(sessionId, action, reason);
  }
}
```

One entry point for all 14 triggers. The function handles incremental input, LLM synthesis, classification, and action — all in one place.

---

## 7. Trigger Map

| Trigger | Source | LLM? | Classifies? | What LLM answers |
|---------|--------|:----:|:-----------:|---|
| `session_start` | manager.ts run()/resumeSession() | — | — | — |
| `checkpoint` | tools/checkpoint.ts (agent or forced by timer) | ✓ | — | What was accomplished? What's planned? |
| `end` | session_end event (piggybacked on eval) | ✓ | — | Full session summary |
| `stuck_detected` | stuck detector subscriber | ✓ | ✓ | What was agent trying? Why looping? |
| `circuit_break` | circuit breaker notification | ✓ | ✓ | What's in progress? What's recoverable? |
| `timeout` | watchdog timer | ✓ | ✓ | What's done, what's left, worth resuming? |
| `zombie_cleanup` | cleanupZombieSessions() | ✓ | ✓ | State when abandoned? |
| `auto_resume` | AutoResume subscriber | ✓ | — | What was done before interruption? |
| `resume_exhausted` | AutoResume escalation | ✓ | ✓ | What should a fresh session know? |
| `infra_retry` | runAgentWithRetry() | ✓ | — | What was interrupted mid-stream? |
| `overflow` | handleOverflow() | ✓ | ✓ | Session state at overflow point? |
| `escalation` | escalateBlockedSession() | ✓ | — | Concise problem summary for parent |
| `recovery_requeue` | P62 recovery subscriber | ✓ | — | What should replacement session know? |
| `shallow_heartbeat` | detectShallowHeartbeat() | ✓ | — | Nothing to do, or failed to act? |

---

## 8. The Classifier

```typescript
const CLASSIFY_TRIGGERS = new Set([
  'stuck_detected', 'circuit_break', 'timeout',
  'zombie_cleanup', 'resume_exhausted', 'overflow'
]);

type Action = 'resume' | 'requeue' | 'escalate' | 'kill' | 'nothing';

function classifyDigest(
  digest: { outcome: string; still_open: string | null; what_happened: string },
  trigger: string
): { action: Action; reason: string } {
  switch (trigger) {
    case 'stuck_detected':
    case 'circuit_break':
      return digest.outcome === 'in_progress' && digest.still_open
        ? { action: 'escalate', reason: digest.still_open }
        : { action: 'nothing', reason: 'No recoverable work' };

    case 'timeout':
      return digest.still_open
        ? { action: 'escalate', reason: `Timed out: ${digest.still_open}` }
        : { action: 'nothing', reason: 'Timed out, nothing critical left' };

    case 'zombie_cleanup':
      return digest.still_open
        ? { action: 'requeue', reason: `Zombie had unfinished: ${digest.still_open}` }
        : { action: 'nothing', reason: 'No recoverable work' };

    case 'resume_exhausted':
      return { action: 'escalate', reason: `Exhausted retries: ${digest.what_happened}` };

    case 'overflow':
      return digest.still_open
        ? { action: 'escalate', reason: `Context overflow: ${digest.still_open}` }
        : { action: 'nothing', reason: 'Overflow, no critical work left' };

    default:
      return { action: 'nothing', reason: 'Informational trigger' };
  }
}
```

---

## 9. What Gets Replaced

| Mechanism | Lines | In-memory state | After digest system |
|---|---|---|---|
| AutoResume | ~50 | Map\<sessionId, count\> | DB: `resume_attempted` via digest step count |
| Circuit breaker | ~45 | Map\<agent, {count, lastError}\> | DB: query recent failure digests |
| P62 Recovery | ~110 | Map\<"agent:taskHash", count\> | DB: digest step count per session |
| Escalation | ~40 | none (reads finishParams) | Digest `what_happened` replaces raw blocker strings |
| Stuck detector state | ~65 | Map\<sessionId, StuckState\> | DB: count digests with trigger=stuck_detected |
| **Total** | **~310** | **5 Maps lost on restart** | **~150 lines, persistent in DB** |

### What stays

- **Watchdog timer** — defense-in-depth, must fire even if DB is down
- **Stuck detector counter** — cheap turn-level detection, fires the trigger
- **Zombie scanner** — DB/disk state check, fires the trigger
- **Session JSONL** — turn-level detail, digests read from it
- **Cron circuit breaker** — separate concern (cron scheduling)

---

## 10. Key Queries

```sql
-- Session timeline (human audit)
SELECT * FROM session_digests WHERE sessionId = ? ORDER BY step;

-- Latest state (crash recovery)
SELECT * FROM session_digests WHERE sessionId = ? ORDER BY step DESC LIMIT 1;

-- All failures with root causes
SELECT agent, what_happened, outcome, still_open, action, action_reason
FROM session_digests WHERE outcome = 'failure' AND created_at > ?;

-- Agent health dashboard
SELECT agent,
  SUM(CASE WHEN trigger = 'end' THEN 1 ELSE 0 END) as clean_ends,
  SUM(CASE WHEN trigger IN ('stuck_detected','circuit_break','timeout') THEN 1 ELSE 0 END) as problems,
  SUM(CASE WHEN action = 'escalate' THEN 1 ELSE 0 END) as escalations
FROM session_digests WHERE created_at > ? GROUP BY agent;

-- Classifier action log (observability)
SELECT trigger, what_happened, action, action_reason
FROM session_digests WHERE action IS NOT NULL ORDER BY created_at DESC;

-- Anomaly feed (non-routine events)
SELECT * FROM session_digests
WHERE trigger NOT IN ('session_start', 'checkpoint', 'end')
  AND created_at > ? ORDER BY created_at DESC;

-- Session briefing (context injection at next session start)
SELECT what_happened, outcome, still_open, files_modified
FROM session_digests WHERE agent = ? AND trigger IN ('end', 'checkpoint')
ORDER BY created_at DESC LIMIT 5;
```

---

## 11. Implementation Phases

### Phase 1: Foundation (Day 1-2, additive, zero risk)
- Add `session_digests` table to DB schema
- Implement `upsertDigest()`, `getLastDigest()`, `readTranscriptSince()`, `llmSynthesize()`
- Wire `session_start` (CREATE), `checkpoint` (DIGEST), `end` (piggybacked on eval)
- Wire forced checkpoint timer
- **Test:** Digest rows appear for normal sessions

### Phase 2: All Triggers (Day 3, still additive)
- Wire remaining 11 triggers — each is one `upsertDigest()` call
- **Test:** All 14 trigger types produce rows

### Phase 3: Shadow Classifier (Day 4-5) ✅ DONE
- Implement `classifyDigest()` alongside existing mechanisms
- `logShadowComparison()` logs both decisions at every recovery trigger
- Manager passed to all 6 CLASSIFY_TRIGGER `upsertDigest` calls for LLM synthesis
- Lazy getter pattern (`managerOrGetter`) handles deferred initialization in subscribers
- 34 tests covering all triggers + shadow comparison expected outcomes
- **Test:** >95% agreement — monitoring via `[digest-shadow]` log lines

### Phase 4: Switchover (Day 6+, one at a time)
- 4a: P62 Recovery → classifier ✅ (biggest win: replaces error string matching)
- 4b: Circuit breaker → classifier ✅
- 4c: Escalation → classifier ✅ (blocked always escalates; failure only escalates if still_open)
- 4d: AutoResume → classifier
- Each: swap, monitor 24h, proceed or revert

### Phase 5: Context Injection
- Replace `## Recent Task History` in `buildSessionContext()` with digest-based briefing
- Richer context with fewer tokens

---

## 12. What We Explicitly Rejected

| Idea | Why rejected |
|---|---|
| File-based journal (JSONL per agent) | Good for agents, bad for queries. Can't filter/join across agents. |
| Per-turn digest writes | Duplicates JSONL. The session transcript already has turn-level detail. |
| Mechanical extraction (no LLM) for mid-session | Misses insight. "edited auth.ts" vs "found the null pointer bug." The understanding is the point. |
| Separate digest system from evaluation | Wastes LLM calls. Evaluator already reads transcripts. |
| orders.md / directives.md | Goes backwards from DB tracking. Text rules don't work (KE-002). |
| New directive-tracking tool | Same KE-002 problem. Adding a tool doesn't mean agents use it. |
| One row per session (updated in place) | Loses the timeline. Append-only = audit trail. |
| JSON blob column (Bob's initial approach) | Can't filter by outcome/trigger in SQL without json_extract. Explicit columns are queryable. |
| Columns on `sessions` table | Different write cadence (2 writes vs many). Schema bloat on 16K existing rows. |

---

## 13. Evidence That Informed the Design

- **KE-002:** Text rules don't change LLM behavior (0/19 experiments). Rules out "tell agents to maintain a directive file."
- **23% sessions don't call finish():** 46 of 200 sampled sessions ended without structured output (turn limits, crashes, interruptions). The digest system covers these — the evaluator still runs.
- **77% sessions DO call finish():** Structured data (status, summary, deliverables, blockers) exists but is only stored in JSONL tool calls, not queryable in DB.
- **310 lines of recovery mechanisms with 5 in-memory Maps:** All state lost on restart. The optimizer session with 198 ops was never resumed because the retry counter reset.
- **Bob, coach, scout maintain journals naturally:** The pattern works. Agents write milestones, track progress, note blockers. The digest system mechanizes this.
- **17,177 evaluations for 16,369 sessions:** The evaluator already covers the full population. Piggybacking is free.
- **~150 sessions/day, ~$0.003-0.005 per LLM digest:** Total cost ~$0.10/day for mid-session digests. Session-end digests are free (eval piggybacking).

---

## 14. Open Questions for Implementation

1. **Forced checkpoint interval:** What's the right N minutes? Too short = too many LLM calls. Too long = too much lost on crash. Suggest 15 minutes, configurable per agent.

2. **LLM model for digests:** Sonnet is reliable but Haiku could be 5x cheaper. Start with the model used for evaluation (already configured), optimize later.

3. **Transcript delta reading:** `readTranscriptSince(sessionId, timestamp)` needs to seek into the JSONL. For short deltas this is fast (read from end). For the first digest of a long session, it's the full file. Consider caching the last-read offset.

4. **Backfill:** Should we backfill digests for the 16K existing sessions? A SQL script can create minimal entries (task, status, error, root_cause) from the sessions table. Rich fields (what_happened, still_open) only exist going forward. Useful for the health dashboard immediately.

5. **Web UI integration:** The digest table is the natural data source for a session detail page. Show the timeline of digests, highlight classifier actions. This is a frontend task, not blocked by the backend work.
