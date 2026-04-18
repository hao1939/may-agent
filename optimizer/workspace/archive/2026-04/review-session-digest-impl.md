# Session Digest Implementation Review

**Reviewer:** Optimizer  
**Date:** 2026-04-05  
**Schema canonical source:** `docs/design/session-digest.md` Section 4  
**Implementation:** `src/lib/session-digest.ts` + wiring in manager.ts, session-subscribers.ts, manager-retry.ts, may.ts, checkpoint.ts

---

## 1. Schema Match — ✅ PASS

The `CREATE TABLE` in `src/lib/requests.ts` (lines 225-244) matches Section 4 exactly:
- All 14 columns present with correct types
- `UNIQUE(sessionId, step)` constraint present
- All 3 indexes present:
  - `idx_sd_session` on `(sessionId, created_at DESC)` ✓
  - `idx_sd_agent` on `(agent, created_at DESC)` ✓
  - `idx_sd_action` on `(action, created_at DESC) WHERE action IS NOT NULL` (partial index) ✓

## 2. Trigger Coverage — ✅ PASS (14/14)

All 14 triggers from Section 7 are wired:

| Trigger | Wired in | Classifies? | Status |
|---------|----------|:-----------:|--------|
| `session_start` | session-subscribers.ts:401 | — | ✅ |
| `checkpoint` | tools/checkpoint.ts:209 | — | ✅ |
| `end` | session-subscribers.ts:429 | — | ✅ |
| `stuck_detected` | session-subscribers.ts:298 | ✓ | ✅ |
| `circuit_break` | session-subscribers.ts:312 | ✓ | ✅ |
| `timeout` | manager.ts:631 | ✓ | ✅ |
| `zombie_cleanup` | manager.ts:1130 | ✓ | ✅ |
| `auto_resume` | session-subscribers.ts:379 | — | ✅ |
| `resume_exhausted` | session-subscribers.ts:358 | ✓ | ✅ |
| `infra_retry` | manager-retry.ts:296 | — | ✅ |
| `overflow` | manager.ts:672 | ✓ | ✅ |
| `escalation` | manager.ts:775 | — | ✅ |
| `recovery_requeue` | may.ts:385 | — | ✅ |
| `shallow_heartbeat` | manager.ts:702 | — | ✅ |

## 3. Key Queries (Section 10) — ✅ PASS

All 7 queries from Section 10 are implementable against the schema:
- Session timeline → `getDigestTimeline()` ✓
- Latest state → `getLastDigest()` ✓
- All failures → `getFailureDigests()` ✓
- Agent health → `getAgentDigestHealth()` ✓
- Classifier action log → `getActionLog()` ✓
- Anomaly feed → not wrapped in a function but query works ✓
- Session briefing → `getRecentDigests()` ✓

## 4. Classifier — ✅ CORRECT

`CLASSIFY_TRIGGERS` set matches design doc's "Classifies?" column exactly:
`stuck_detected, circuit_break, timeout, zombie_cleanup, resume_exhausted, overflow`

`classifyDigest()` returns one of: `resume, requeue, escalate, kill, nothing`
— matches schema's `action` enum. Logic is reasonable per-trigger.

## 5. ⚠️ ISSUES FOUND

### Issue A: Table not yet created in production DB (BLOCKING)

The `session_digests` table does NOT exist in `.state/may.db`. The code is committed (040aefa, d23e77e) and the SCHEMA string includes `CREATE TABLE IF NOT EXISTS session_digests`, but the running process was started before these commits landed. The `dbCache` Map in `getDb()` caches the DB connection from first open — subsequent calls return the cached connection and DON'T re-exec the SCHEMA.

**Impact:** All `upsertDigest()` calls are silently failing (caught by try/catch). Zero digest data is being collected.

**Fix:** Process restart will trigger fresh `getDb()` → `db.exec(SCHEMA)` → table created. No code change needed — just a restart. But we should also add a migration guard: on existing cached connections, run `CREATE TABLE IF NOT EXISTS session_digests` to handle the case where schema additions happen between restarts.

### Issue B: Double transcript read in `upsertDigest()` (MINOR PERF)

When `what_happened` is not provided and LLM synthesis runs (lines ~474-487), the code calls `readTranscriptDelta()` for the LLM. Then if `files_modified` is also not provided (line ~492), it calls `readTranscriptDelta()` AGAIN for file extraction. The transcript is read from disk twice.

**Fix:** Cache the delta result from the first read and reuse it:
```typescript
// Before LLM synthesis:
const delta = readTranscriptDelta(persistDir, input.sessionId, last?.step ?? 0);
// ... use delta for LLM ...
// ... reuse delta for file extraction instead of re-reading ...
```

### Issue C: `readTranscriptDelta` heuristic is fragile (LOW RISK)

The "estimate messages consumed by previous digests" heuristic (line ~246) divides total messages evenly across steps. This works poorly when most digests cluster at session end (common pattern: `session_start` + `end` = 2 steps, but step 2 covers 95% of messages). The estimation formula `(messages.length * (lastDigestStep - 1)) / (lastDigestStep + 1)` under-reads the delta in early sessions.

**Impact:** Low. LLM gets slightly more context than needed (overlap from previous digest window). Costs a bit more but doesn't cause errors.

### Issue D: `created_at` uses milliseconds — ✅ CONSISTENT

The code uses `Date.now()` (milliseconds) for `created_at`. Verified: `sessions.startedAt` also uses milliseconds. Consistent. The design doc's example queries using `unixepoch()` (seconds) are wrong in the doc but the implementation is correct.

### Issue E: No `kill` action ever issued by classifier (BY DESIGN?)

The `classifyDigest()` function never returns `action: 'kill'`. The schema documents it as a valid action value, but no code path produces it. This may be intentional (conservative start), but should be documented.

## 6. Convenience Functions — ✅ WELL DESIGNED

- `createStartDigest()` — lightweight sync, no LLM ✓
- `createEndDigest()` — accepts pre-computed fields (piggybacked on eval) ✓
- `createCheckpointDigest()` — extracts files_modified and next_steps from checkpoint data ✓
- All three are properly error-guarded (try/catch, best-effort)

## 7. Error Handling — ✅ GOOD

Every `upsertDigest()` call is `.catch()`'d so digest failures never break the session lifecycle. The `createDigestWriter()` subscriber uses nested try/catch. Good defensive pattern.

## 8. Summary

**Overall: WELL IMPLEMENTED.** Schema matches design exactly. All 14 triggers wired. Queries implemented. Classifier logic correct.

**Critical blocker:** Table doesn't exist in production DB yet. Needs process restart (or manual table creation via `db.exec(SCHEMA)` call).

**Minor fixes deployed:** 
1. Double transcript read → single cached read (perf)
2. Null-safety: `files_modified.length` would throw if null → added null check
