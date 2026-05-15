# Design: Child Session Recovery on Restart

**Author**: May (supervisor)  
**Date**: 2026-04-14  
**Status**: Implemented (Option B + C)

---

## 1. Analysis: What Happens Today

When the may-agent process restarts, the startup sequence in `src/app/may.ts:1092-1096` runs:

```
1. manager.resumeStaleSessions({ kinds: ["job"] })         // resume job sessions
2. manager.resumeStaleSessions({ abort: true, kinds: ["call"] })  // ABORT call sessions
3. failOrphans() in cron.ts                                // mark requests FAILED
```

**The full code path for a killed call session:**

1. **`resumeStaleSessions({ abort: true, kinds: ["call"] })`** (manager.ts:1207) — For each stale call session, sets status to `"interrupted"` with reason `"Clean start (fresh)"` via `registry.updateSessionStatus()`. The session's JSONL is preserved on disk but the agent loop is never restarted.

2. **`failOrphans(entryName)`** (cron.ts:433-443) — For each cron entry, runs `UPDATE requests SET status = 'FAILED', error = 'orphaned by restart' WHERE artifact = ? AND status IN ('CREATED', 'IN_PROGRESS')`. This marks the parent heartbeat's request as failed.

3. **Parent heartbeat is gone.** The heartbeat that spawned the call session already completed (status: done). It ran `agents call`, which blocked waiting for the child. When the process died, the parent's `callAgent()` promise was lost. On restart, only the child is found stale — the parent is already archived or done.

4. **No retry mechanism.** The child's request record is either marked FAILED (if it was a cron artifact) or left IN_PROGRESS until zombie cleanup. Nobody re-dispatches the work. The next heartbeat cycle (30 min later) may or may not notice the gap.

**Forked sessions are different.** `agents fork` creates sessions with `kind: "job"`, which are *resumed* on restart (step 1 above). Only `kind: "call"` sessions are aborted. This means:
- `fork` = survives restart (resumed with JSONL context reload)
- `call` = killed on restart (aborted unconditionally)

The rationale for aborting call sessions was that they're "parent-owned" — the parent blocks on them, so if the parent is dead, resuming the child alone produces an orphan with no one waiting for its result. But this reasoning breaks down when the child was doing useful independent work (writing files, making commits).

## 2. Impact

**Frequency:** Every process restart kills all in-flight call sessions. Restarts happen for:
- Deployments / code updates (multiple per day during active development)
- Crash recovery
- Manual restarts by Hao

**Cost per incident:**
- **Wasted tokens**: A call session mid-execution has consumed tokens for its full context window + all tool calls so far. Typical cost: 50K-200K tokens per aborted session.
- **Wasted wall-clock time**: Work done by the child (partial file edits, analysis) may be lost or left in an inconsistent state.
- **30-minute delay**: The lost work isn't retried until the next heartbeat cycle picks it up (if it notices at all). Many tasks silently drop.
- **Partial state corruption**: If the child was mid-edit (e.g., half-written file, staged git changes), the abort leaves artifacts that confuse the next attempt.

**Estimated weekly impact** (assuming 2 restarts/day, ~1 call session active at restart time): ~4-8 lost sessions/week, ~400K-1.6M wasted tokens, multiple hours of delayed delivery.

## 3. Options

### Option A: Parent-Aware Abort

**Idea:** Before aborting a call session, check if its parent is also being resumed. If the parent will be resumed, don't abort the child — let the parent's resumed execution pick it up.

**How it would work:**
1. In `resumeStaleSessions`, collect all stale sessions first (both job and call).
2. For each stale call session, check `parentSessionId` — if the parent is in the "will be resumed" set (a job session), skip aborting this child.
3. Resume the parent (job) session. When its agent loop restarts, the `callAgent()` call needs to re-attach to the existing child session.

**Problems:**
- The parent's `callAgent()` was an in-memory `await` on a Promise. On restart, that Promise is gone. Re-attaching requires `callAgent()` to detect "child already running" and wait on it instead of starting a new one — significant plumbing.
- The parent's LLM context is restored from JSONL, but it doesn't "know" it's mid-call. The agent loop would replay from the last assistant message, likely issuing a *new* `agents call` — creating a duplicate child.
- Only helps when the parent is also resumable. If the parent was a heartbeat (kind: "job", already done), there's no parent to resume.

**Verdict:** High complexity, narrow applicability. The fundamental issue — the parent's in-memory blocking state can't be restored — makes this fragile.

### Option B: Track Incomplete Delegations for Retry

**Idea:** Use the request DB to ensure lost call sessions are retried. When a call session is aborted on restart, ensure its request is marked FAILED (already happens via `failOrphans`). Then, make the next heartbeat aware of failed requests so it can retry them.

**How it would work:**
1. **On abort** (already exists): `failOrphans()` marks requests as `status = 'FAILED', error = 'orphaned by restart'`.
2. **On next heartbeat** (new): Query for recently-failed requests with `error = 'orphaned by restart'` and retry them. This could be:
   - (a) Injected into the heartbeat prompt automatically ("These tasks were lost on restart, retry them").
   - (b) A cron-level retry: cron.ts re-dispatches failed requests before/after the heartbeat fires.
3. **Deduplication**: Use `requestId` to prevent double-dispatch. Mark retried requests with a new status or link to the retry request.

**Refinement — ensure all call sessions have requests:**
Currently, `callAgent()` in manager.ts does NOT create a request record — only the `agents` tool wrapper does (in manager-agents-tool.ts). Direct `callAgent()` calls from cron or internal code skip tracking. Fix: always create a request record in `callAgent()` itself.

**Problems:**
- Retry is delayed until the next heartbeat (up to 30 min). Better than "never retried" but still costly.
- The retried task starts from scratch — all tokens from the original attempt are wasted.
- Need to handle the case where the child produced partial results (half-written files). The retry might conflict.

**Verdict:** Simple, robust, leverages existing infrastructure. Doesn't recover in-progress work but ensures nothing is silently dropped. The 30-min delay is acceptable for most workloads.

### Option C: Resume Call Sessions

**Idea:** Instead of aborting call sessions, resume them like job sessions. Let them run to completion, and handle the "no parent waiting" case gracefully.

**How it would work:**
1. Change startup from `abort: true` to `abort: false` for call sessions:
   ```typescript
   // Before:
   manager.resumeStaleSessions({ abort: true, kinds: ["call"] });
   // After:
   manager.resumeStaleSessions({ kinds: ["call"] });
   ```
2. The resumed call session continues its agent loop from the last JSONL checkpoint. It runs to completion and writes its `finish()` result.
3. Since no parent is blocking on `callAgent()`, the result goes nowhere — unless we add a completion handler.
4. **Completion handler**: On call session completion, if `requestId` exists, update the request record to COMPLETED with the result summary. The parent (or next heartbeat) can query for it.

**Problems:**
- **Lost in-memory state**: Any state held in the agent's tool closures (not persisted in JSONL) is gone. For most tools this is fine — `read`, `bash`, `edit` are stateless. But custom tools with in-memory caches will break.
- **Orphaned results**: The child finishes but nobody reads the result. Need a mechanism to surface completed orphan results to the relevant agent.
- **Resource cost**: Resumed call sessions consume a model slot. If many were in-flight, restart becomes expensive.
- **Partial state**: The child may have been mid-tool-call (e.g., bash was running). The resumed session sees the last *completed* message, so mid-execution tool calls are lost. The agent may re-execute them (idempotency concern).

**Verdict:** Recovers the most value (partial work is continued, not discarded). Moderate complexity. The orphaned-result problem is solvable via the request DB.

## 4. Recommendation: Option B + C (Layered)

Use **Option C** (resume call sessions) as the primary mechanism, with **Option B** (request-based retry tracking) as the safety net.

**Why this combination:**

- **Option C** handles the common case: child session had 5 minutes of work, process restarts, child resumes and finishes in 2 more minutes. No tokens wasted, no delay.
- **Option B** handles the failure case: if the resumed child can't complete (agent not registered, corrupted JSONL, etc.), the request is marked FAILED and the next heartbeat retries it.
- **Option A** is unnecessary: we don't need to re-attach to a parent because resumed children run independently and report results via the request DB.

**Why not Option C alone:**
- Some call sessions will fail to resume (corrupted state, unregistered agent). Need the retry path.
- Need the request tracking regardless, to surface results to the parent agent.

**Why not Option B alone:**
- Wastes all tokens from the interrupted session. At 100K+ tokens per session, this adds up fast.
- 30-minute retry delay is unnecessary when we can just resume.

## 5. Implementation Sketch

### Phase 1: Resume Call Sessions (Option C)

**File: `src/app/may.ts` (~1093)**

```typescript
// Before:
const { interrupted: orphansCleaned } = manager.resumeStaleSessions({ abort: true, kinds: ["call"] });

// After:
const { resumed: callResumed, interrupted: callInterrupted } =
  manager.resumeStaleSessions({ kinds: ["call"] });
resumed.push(...callResumed);
// callInterrupted = sessions that couldn't resume (agent not found, etc.)
```

**File: `src/lib/manager.ts` — `resumeStaleSessions()` (~1207)**

No changes needed — the existing resume path already handles call sessions correctly. When `abort` is false, it calls `this.resumeSession()` which reloads JSONL and restarts the agent loop. The only difference is that no parent is waiting on the Promise.

**File: `src/lib/manager.ts` — completion handler (~`handleCompletion`)**

Add logic: if a completed session has `kind === "call"` and `requestId`, update the request to COMPLETED with the finish summary. This already partially exists but verify it fires for orphaned call sessions.

### Phase 2: Request-Based Safety Net (Option B)

**File: `src/lib/manager.ts` — `callAgent()` (~2370)**

Ensure every `callAgent()` creates a request record (not just the agents-tool wrapper):

```typescript
// In callAgent(), before this.run():
const requestId = trackRequest(this.registry.persistDir, {
  fromEntity: callerAgent ?? "system",
  toAgent: name,
  task,
  method: "call",
  sessionId: opts?.parentSessionId,
});
```

**File: `src/app/cron.ts` — `failOrphans()` (~433)**

Change: only fail requests whose sessions were actually interrupted (not resumed):

```typescript
// After resumeStaleSessions, collect interrupted session IDs
// Only fail requests for those sessions, not all orphans
```

**File: `src/app/cron.ts` — heartbeat injection (new)**

When building the heartbeat prompt, query for recently-failed orphaned requests:

```sql
SELECT * FROM requests
WHERE status = 'FAILED'
  AND error = 'orphaned by restart'
  AND completedAt > ?  -- within last 60 minutes
```

Inject into the heartbeat context: "The following tasks were lost on restart and need retry: [list]". The heartbeat agent decides whether/how to re-dispatch.

### Phase 3: Cleanup & Guardrails

- **Resource limit**: Cap resumed call sessions at N (e.g., 5). If more than N are stale, resume the N newest and abort the rest (with retry via Phase 2).
- **Timeout**: Resumed call sessions get a 15-minute timeout. If they don't complete, abort and mark for retry.
- **Logging**: Log resumed call sessions prominently so operators can see what survived restart.
- **Metrics**: Track `call_sessions_resumed` vs `call_sessions_aborted` counters.

### Migration

No schema changes needed. The request DB already has all required fields. The `kind` field on `PersistedSession` already distinguishes call vs job. The change is purely behavioral — stop aborting, start resuming.

---

## Summary

| Aspect | Current | Proposed |
|--------|---------|----------|
| Call sessions on restart | Aborted unconditionally | Resumed (with abort as fallback) |
| Lost work detection | Silent | Request DB tracks failures |
| Retry mechanism | None (wait for next heartbeat to notice) | Automatic retry injection into heartbeat |
| Token waste | 100% of interrupted session | ~0% if resume succeeds |
| Implementation effort | — | ~50 lines changed across 3 files |
