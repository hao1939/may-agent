# Session Digest System — Final Design (v4)

**Author:** Bob | **Date:** 2026-04-05 | **Status:** Final spec (supersedes all previous)
**Key change v4:** Digest as observability log — every lifecycle hook that changes session state triggers a digest update.

---

## Architecture: Every State Change → Digest Update

Digests record what happened in a session. Any hook that detects or changes session state writes a digest entry.

### Schema

```typescript
interface DigestEntry {
  sessionId: string;
  agent: string;
  trigger: string;           // see Trigger Map below
  step: number;              // monotonic per session (1, 2, 3...)
  timestamp: number;
  what_happened: string;     // 1-3 sentences
  outcome: string;           // "success"|"partial"|"failure"|"in_progress"|"interrupted"
  still_open: string | null;
  files_modified: string[];
  key_decisions?: string[];  // only on LLM-produced digests
  evaluation?: { quality: number; efficiency: number; verdict: string };
}
```

---

## Complete Trigger Map

Every system hook that changes session state, where it lives, and how the digest is produced:

| Trigger | Source File:Line | What It Detects | Method | What Gets Captured |
|---------|-----------------|-----------------|--------|--------------------|
| `checkpoint` | `tools/checkpoint.ts` execute fn | Agent saves progress | **Heuristic** | summary, next_steps, files_modified from checkpoint params |
| `end` | `may.ts:397` bus subscriber → `evaluateTask()` | Normal session completion | **LLM** (piggybacked on eval) | what_happened, outcome, key_decisions, files_modified |
| `end_heuristic` | `may.ts` (skipped eval path) | Session ends, eval skipped | **Heuristic** | finishParams.summary/status/deliverables |
| `stuck_detected` | `session-subscribers.ts:259` createStuckDetector | N consecutive error-only turns (warn@4, kill@6) | **Heuristic** | "Stuck: {N} consecutive error turns. Last tool: {name}" |
| `circuit_break` | `may.ts:233` onCircuitBreak callback | Stuck detector terminates session | **Heuristic** | agent, reason, turn count at termination |
| `infra_retry` | `manager-retry.ts:266` runAgentWithRetry | Transient API error, retrying | **Heuristic** | retry attempt N/5, error class (429/502/empty), delay |
| `retry_exhausted` | `manager-retry.ts` (falls through loop) | All 5 infra retries failed | **Heuristic** | "Infra retries exhausted (5/5). Last error: {msg}" |
| `overflow` | `completion.ts:119` handleOverflow | Context window exceeded | **Heuristic** | progress snapshot (task, partial results, files modified) |
| `auto_resume` | `session-subscribers.ts:314` createAutoResume | Interrupted session auto-resumes | **Heuristic** | "Resumed attempt {N}/2. Previous error: {msg}" |
| `resume_exhausted` | `may.ts:252` escalate callback | 2 resume attempts failed | **Heuristic** | "Resume exhausted (2/2). Escalating to human." |
| `timeout` | `manager.ts:623` setupTimeout | Session exceeded time limit | **Heuristic** | "Timed out after {ms}ms. Turn count: {N}" |
| `zombie_cleanup` | `manager.ts:1066` cleanupZombieSessions | Orphaned "running" session >30min | **Heuristic** | "Zombie: running in DB but not in memory. Stale {min}min." |
| `escalation` | `manager.ts:738` + `may.ts:433` | blocked/failure → parent or May | **Heuristic** | finishParams.status, summary, blockers |
| `recovery_requeue` | `may.ts:370` session_end subscriber | Infra error → new session queued | **Heuristic** | "Requeued as {newSessionId}. Attempt {N}/3. Error: {class}" |
| `shallow_heartbeat` | `completion.ts:143` detectShallowHeartbeat | Heartbeat with 0 tool calls | **Heuristic** | "Shallow heartbeat: 0 turns, responded from compacted context" |

**15 triggers total.** Only `end` uses LLM (piggybacked on existing eval call). All others are heuristic — zero extra cost.

---

## LLM vs Heuristic Decision

**LLM digest** (1 trigger): `end` — needs context synthesis. What did the session accomplish overall? Piggybacked on the evaluator call that already reads the transcript. Cost: $0.00 incremental (~50 extra output tokens).

**Heuristic digest** (14 triggers): Everything else. These events have a clear, mechanical description. No need for LLM to say "stuck detected" — just record the facts.

**Rule:** If the event description can be a template string with variables, it's heuristic. If it requires reading the transcript to summarize, it's LLM.

---

## Implementation: Where Each Hook Writes

All hooks call the same `upsertDigest(persistDir, entry)` function.

| Hook Location | Change |
|---------------|--------|
| `tools/checkpoint.ts` | After JSONL write, build digest from params |
| `may.ts:397` (eval subscriber) | After `evaluateTask()`, extract digest from LLM response |
| `session-subscribers.ts` createStuckDetector | On warn (4 turns) and kill (6 turns), write digest |
| `may.ts:233` onCircuitBreak | Write digest before sending diagnosis task |
| `manager-retry.ts` runAgentWithRetry | On each retry and on exhaustion, write digest |
| `completion.ts` handleOverflow | After writing progress file, write digest |
| `session-subscribers.ts` createAutoResume | On resume and on exhaustion, write digest |
| `manager.ts` setupTimeout | In timeout callback, before cancel, write digest |
| `manager.ts` cleanupZombieSessions | On each zombie found, write digest |
| `manager.ts` escalateBlockedSession | Write digest with blocker details |
| `may.ts:370` recovery subscriber | On requeue and on exhaustion, write digest |
| `completion.ts` detectShallowHeartbeat | After flagging error, write digest |

**Total implementation:** ~20 one-liner `upsertDigest()` calls across 6 files + the existing checkpoint and eval-end paths.

---

## DB Storage

```sql
CREATE TABLE IF NOT EXISTS session_digests (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId TEXT NOT NULL,
  agent     TEXT NOT NULL,
  trigger   TEXT NOT NULL,
  step      INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  digest    TEXT NOT NULL,  -- JSON blob
  UNIQUE(sessionId, step)
);
CREATE INDEX IF NOT EXISTS idx_digest_session ON session_digests(sessionId);
CREATE INDEX IF NOT EXISTS idx_digest_agent_ts ON session_digests(agent, timestamp);
```

---

## Cost Summary

| Category | Volume/day | LLM cost |
|----------|-----------|----------|
| `end` (LLM, piggybacked) | ~150 | $0.00 incremental |
| All 14 heuristic triggers | ~200-400 | $0.00 |
| **Total** | ~350-550 entries | **$0.00/day** |

---

## Consumer Queries

```sql
-- Full session timeline (the "observability log")
SELECT trigger, timestamp, digest FROM session_digests
WHERE sessionId = ? ORDER BY step;

-- Last known state (crash recovery)
SELECT digest FROM session_digests
WHERE sessionId = ? ORDER BY step DESC LIMIT 1;

-- Anomaly feed (everything except normal checkpoints and ends)
SELECT sessionId, agent, trigger, digest FROM session_digests
WHERE trigger NOT IN ('checkpoint', 'end', 'end_heuristic')
  AND timestamp > ? ORDER BY timestamp DESC;

-- Agent health (stuck/timeout/zombie patterns)
SELECT agent, trigger, COUNT(*) as cnt FROM session_digests
WHERE trigger IN ('stuck_detected','circuit_break','timeout','zombie_cleanup')
  AND timestamp > ? GROUP BY agent, trigger;
```

---

## Phasing

1. **Phase 1:** `upsertDigest()` function + DB table. Wire `checkpoint` and `end` triggers.
2. **Phase 2:** Wire remaining 13 heuristic triggers (one-liners, low risk).
3. **Phase 3:** Migrate existing systems (autoResume, escalation, recovery) to read from digests.
