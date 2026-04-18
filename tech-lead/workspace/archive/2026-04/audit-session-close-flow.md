# Audit: Session Close/Archive End-to-End Flow

**Date**: 2026-04-13  
**Lens**: B — Session close complexity  
**Scope**: manager.ts (handleCompletion), completion.ts, persistence.ts, session-subscribers.ts, db-writer.ts, may.ts bus subscribers  

## Trigger

LLM returns `stop_reason=end_turn` after a `finish()` tool call → pi-agent-core resolves the `prompt()`/`continue()` promise → manager calls `handleCompletion(session)`.

## Exact Call Sequence (line numbers from current main)

### Layer 1: handleCompletion (manager.ts:736-764)
1. `clearTimeout(session)` — cancel any pending timeout timer
2. Guard: if `session.closed`, bail (session already archived by explicit close())
3. **try** → `handleCompletionInner(session)` — the real pipeline
4. **catch** → emergency cleanup: set error, updateSessionStatus, unsubscribe, removeSentinel, cleanupSession, delete from activeSessions, cleanupCallDepths, delayed sessionResults cleanup

### Layer 2: handleCompletionInner (manager.ts:770-889) — 6 stages

**Stage A: Error detection** (completion.ts)
1. `detectErrors(session)` — checks for silent stream errors, empty responses (L772)
2. `clearPostFinishErrors(session)` — strips post-finish artifact errors (L773)
3. Copy `agent.state.errorMessage` → `session.error` if not already set (L780)
4. If overflow error: fire-and-forget `upsertDigest()` (async, non-blocking) (L788)

**Stage B: Chat session early return** (L803-822)
5. If `autoClose === "never"` and not aborted/overflow → set `session.status = "idle"`, `registry.updateSessionStatus()` → **1 × meta.json write** (read + write via atomic tmp+rename), `removeSentinel()` → **1 × unlink**, return
6. If overflow on chat → fall through to archive path

**Stage C: Shallow heartbeat + outcome** (L824-840)
7. `detectShallowHeartbeat(session)` — flags zero-turn heartbeats as errors
8. If shallow detected: fire-and-forget `upsertDigest()` (async)
9. `determineOutcome(session)` → extracts finishParams, archiveStatus, outcome text, finishResult (pure, no I/O)

**Stage D: Meta.json write** (L841-846)
10. `registry.updateSessionStatus(sessionId, archiveStatus, error)` — **1 × meta.json read + atomic write (tmp + rename = 3 fs ops)**
11. **try-catch wraps this** — the 2026-04-11 P0 fix. If meta.json write fails, logs error but continues to emit session_end. ✅ Confirmed merged.

**Stage E: Cleanup** (L848-862)
12. `session.unsubscribe()` — detach event listener from agent
13. `session.endedAt = Date.now()`
14. `removeSentinel(sessionId)` — **1 × existsSync + 1 × unlinkSync** (deletes `[STARTED]` file)
15. `cleanupSession(session)` (L674-686):
    - `cleanupStepCounter(sessionId)` — in-memory Map delete
    - `archiveSession(persistDir, sessionId)` — **1 × mkdirSync + 1 × existsSync (check dest) + optional rmSync + 1 × renameSync** (moves session dir to history/)
16. `activeSessions.delete(sessionId)` — in-memory Map delete
17. `cleanupCallDepths(sessionId)` — in-memory Map delete
18. `setTimeout(() => sessionResults.delete(sessionId), 60_000)` — deferred memory cleanup

**Stage F: Escalation + notification** (L864-889)
19. If blocked/failure: `escalateBlockedSession()` → fire-and-forget `upsertDigest()` + `trackRequest()` (**1 × DB write**)
20. `buildSessionInfo(session, outcome, getWorkspacePath)` — pure, no I/O
21. `this.emit({ type: "session_end", ... })` — emits to EventBus → triggers all subscribers

### Layer 3: Bus Subscribers (6 listeners fire synchronously on session_end)

| # | Subscriber | Source | I/O on session_end |
|---|-----------|--------|-------------------|
| 1 | **DbWriter** (db-writer.ts) | may.ts:206 | `updateSessionDb()` → **1 × SQLite UPDATE** (status, error, outcome, opCount, endedAt) |
| 2 | **ContextUpdater** (session-subscribers.ts:21) | may.ts:216 | If `context_updates` present: **1 × readFile + 1 × writeFile** to `agents/<name>/context.md` |
| 3 | **RequestTracker** (session-subscribers.ts:63) | may.ts:217 | If `new_items`: **N × DB INSERT**. If `completed_items`: **1 × SELECT + N × UPDATE** (fuzzy match) |
| 4 | **DigestWriter** (session-subscribers.ts:344) | may.ts:218 | `createEndDigest()` → **1 × readFile (digest JSONL) + 1 × appendFile** |
| 5 | **StuckDetector** (session-subscribers.ts:143) | may.ts:219 | Cleans up state map — **0 I/O** on session_end |
| 6 | **AutoResume** (session-subscribers.ts:250) | may.ts:238 | Only fires if `status === "interrupted"` — **0 I/O for normal completion** |

### Layer 4: Deferred Subscribers (async, after bus emission)

| # | Subscriber | Source | I/O |
|---|-----------|--------|-----|
| 7 | **Recovery subscriber** (may.ts:~395) | inline in may.ts | If error: `upsertDigest()` → **1 × JSONL read/append + optional LLM call for classification** |
| 8 | **Auto-evaluator** (may.ts:~436) | inline in may.ts | `setTimeout(3000)` → `evaluateTask()` — only fires if `parentSessionId === taskSessionId` (child of current May task). When it fires: **reads all session metas, reads transcript JSONL per child session, LLM call for evaluation, DB upsert** |
| 9 | **Escalation subscriber** (may.ts:~467) | inline in may.ts | If blocked/failure: `upsertDigest()` + optional human escalation |

## Total Counts

### Layers of Indirection
**4 layers**: handleCompletion → handleCompletionInner (6 stages) → bus.emit → 6-9 subscribers

### I/O Operations (normal success path, task session with finish())

| Category | Count | Details |
|----------|-------|---------|
| **Filesystem reads** | 2-3 | meta.json read (updateSessionStatus), digest JSONL read, optional context.md read |
| **Filesystem writes** | 4-5 | meta.json atomic write (tmp+rename=2), [STARTED] sentinel unlink, session dir rename (archive), digest JSONL append, optional context.md write |
| **SQLite writes** | 2-4 | DbWriter UPDATE, RequestTracker INSERTs/UPDATEs |
| **Total synchronous I/O** | ~8-12 | Varies by finish() params content |
| **Deferred I/O** | 2-5 | Recovery digest, auto-eval (3s delay), escalation digest |

### Status Written To (redundancy check)
Session final status is persisted in **3 places**:
1. `meta.json` on disk (updateSessionStatus, L841) — source of truth
2. SQLite `sessions` table (DbWriter subscriber) — queryable index
3. Digest JSONL (DigestWriter subscriber) — audit trail

This is the same **triple-redundant status** finding from `audit-persistence-write-path.md` — still present, still intentional (each serves a different purpose).

## Findings

### 1. meta.json try-catch fix is merged ✅
The P0 fix (2026-04-11) wraps `registry.updateSessionStatus()` in try-catch at L841-846. If meta.json write fails, the pipeline continues to emit `session_end`, so DB, digest, and other subscribers still fire. This was the critical fix that prevented meta.json failure from blocking all downstream persistence.

### 2. No redundant I/O identified
Each I/O operation serves a distinct purpose:
- meta.json → crash recovery source of truth (filesystem)
- SQLite → queryable index for dashboard/API
- Digest JSONL → audit trail for classifier
- context.md → agent context persistence
- Archive rename → move completed session out of active dir

### 3. Fragility: archiveSession() inside try-catch
`archiveSession()` (L684) does `renameSync(src, dest)` which can fail if the history dir has permissions issues or disk is full. It's wrapped in try-catch (best-effort), so failure leaves the session in the active dir. This means `listActiveSessionIds()` returns stale sessions — matches the finding in `audit-active-sessions-dead-weight.md` (2765 stale sessions).

### 4. Evaluation queuing is conditional and delayed
`evaluateTask()` only fires for child sessions of the current May task (gated by `parentSessionId === taskSessionId`). It runs after a 3-second delay. Most sessions (heartbeats, standalone tasks) are **never auto-evaluated**. This is by design but worth noting — the evaluation coverage is narrow.

### 5. Bus subscriber ordering is implicit
All 6+ subscribers fire on the same `session_end` event. There's no guaranteed ordering. If DigestWriter fires before DbWriter, the digest might reference a session not yet in the DB. In practice this hasn't caused issues because each subscriber is independent, but it's a latent coupling point.

### 6. Two separate session_end emission paths
`handleCompletionInner()` (L872) and the explicit `close()` method (L1991) both emit `session_end` with slightly different shapes. The close() path at L1977-2000 builds its own `closeInfo` instead of using `buildSessionInfo()`. This means close() and handleCompletion produce structurally different `session_end` events — potential source of subscriber bugs.

## Summary

The session close flow is **4 layers deep with 8-12 synchronous I/O ops** and 2-5 deferred I/O ops. The critical P0 meta.json fix is confirmed merged. The main architectural concern is the **two divergent session_end emission paths** (handleCompletion vs close()) which could cause subscriber inconsistencies. The triple-redundant status write is intentional but should be documented as such.
