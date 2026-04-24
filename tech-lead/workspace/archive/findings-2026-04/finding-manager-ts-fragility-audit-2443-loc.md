# Manager.ts Fragility Audit (2443 LOC)

**File**: `src/lib/manager.ts`  
**Date**: 2026-04-16  
**Auditor**: tech-lead (Lens D)

---

## Finding 1: Silent swallow of DB/meta write failures in completion path

**Severity**: P1  
**Lines**: 814-819

The `handleCompletionInner` method catches meta.json write failures (`registry.updateSessionStatus`) and logs them but continues execution. The session gets deleted from `activeSessions` (line 825) and emits `session_end`, but the on-disk status may still be "running". This creates a DB/disk/memory divergence: the process thinks the session ended, but disk says it's running, and the zombie cleanup (line 1240+) won't catch it until 30 minutes later.

```typescript
try {
  this.registry.updateSessionStatus(session.sessionId, outcome.archiveStatus, session.error);
} catch (metaErr) {
  log("error", `[completion] Failed to write meta.json for ${session.sessionId}: ${metaErr}`);
  // Continue — still emit session_end so DB, digest, and other subscribers fire
}
```

**Blast radius**: Session appears as zombie on next startup; `resumeStaleSessions` may re-run it, causing duplicate work. Downstream consumers (digest, evaluation) may see inconsistent state.

---

## Finding 2: activeSessions.delete without sessionResults.delete creates memory leak window

**Severity**: P2  
**Lines**: 825, 733-737

In the normal completion path (line 825), `activeSessions.delete` is called immediately but `sessionResults` is cleaned up via `setTimeout(() => sessionResults.delete(...), 60_000)` (after the code shown at ~line 835). In the error path of `handleCompletion` (line 733), the same pattern applies. However, if the process crashes or restarts within that 60s window, `sessionResults` entries are lost anyway (they're in-memory Promises). The real risk: if `handleCompletion` throws *before* the setTimeout is set up but *after* activeSessions.delete, the sessionResults entry leaks forever until process restart.

**Blast radius**: Minor memory leak per leaked session. Not cascading, but compounds over long-running processes.

---

## Finding 3: Ghost session window in run() between activeSessions.set and promise assignment

**Severity**: P2  
**Lines**: 1020-1094

There's a well-documented window (lines 1076-1094 comment says "Ghost session prevention") where the session is added to `activeSessions` (line 1020) but `session.promise` hasn't been assigned yet. If anything between lines 1020-1074 throws, the catch block cleans up. However, the catch block does `this.activeSessions.delete(sessionId)` and `throw err` — it does NOT clean up `sessionResults` (which was set at ~line 1070). If the throw happens between sessionResults.set and the catch, the promise in sessionResults resolves to a result from a session that was never properly started.

```typescript
this.activeSessions.set(sessionId, session);
try {
  // ... ~50 lines of setup ...
  session.promise = runAgentWithRetry(...);
  this.sessionResults.set(sessionId, session.promise.then(...));
  return sessionId;
} catch (err) {
  this.activeSessions.delete(sessionId);  // ← cleans activeSessions
  // sessionResults NOT cleaned up if set before throw
  throw err;
}
```

**Blast radius**: A `waitFor(sessionId)` call from a parent agent could hang indefinitely on a never-resolving promise, blocking that parent session.

---

## Finding 4: close() vs handleCompletion race on session.closed flag

**Severity**: P2  
**Lines**: 1909-1947, 714-716

`close()` sets `session.closed = true` (line 1919) and then calls `cancel()`. Meanwhile, `handleCompletion` checks `if (session.closed) return` (line 716) as a guard. But there's a subtle race: if `handleCompletion` has already passed the guard check (line 716) and is executing inside `handleCompletionInner` when `close()` sets the flag, both paths will try to archive/cleanup the same session. The `activeSessions.delete` calls are idempotent, but `registry.updateSessionStatus` and `cleanupSession` could write conflicting statuses (close writes "interrupted", completion writes the actual outcome).

**Blast radius**: Session ends up with wrong archived status. Evaluations and digests may record incorrect outcomes.

---

## Finding 5: Zombie cleanup has 30-minute blind spot and double-counts terminal sessions

**Severity**: P3  
**Lines**: 1240-1320

`cleanupZombieSessions()` uses a 30-minute threshold (`staleThresholdMs = 30 * 60 * 1000`). Sessions that crash within the first 30 minutes remain in "running" state on disk until the next cleanup cycle after the threshold passes. Also, Phase 2 (lines 1282-1294) counts ALL terminal sessions still in the active directory, not just ones it cleaned up, inflating the `cleaned` count. This makes the return value unreliable as a metric.

```typescript
// Phase 2: Count terminal sessions still in the active directory.
for (const sessionId of activeIds) {
  if (this.activeSessions.has(sessionId)) continue;
  const meta = readSessionMeta(persistDir, sessionId);
  if (!meta) continue;
  const terminalStatuses = ["done", "error", "interrupted"];
  if (terminalStatuses.includes(meta.status ?? "")) {
    cleaned++;  // ← counts pre-existing terminal sessions, not just zombies
  }
}
```

**Blast radius**: Low. Misleading cleanup count; 30-min window means short-lived crashes show as running longer than expected to external observers.

---

## Severity Summary

| Severity | Count | Findings |
|----------|-------|----------|
| P1       | 1     | #1 (silent meta write failure) |
| P2       | 3     | #2 (memory leak), #3 (ghost sessionResults), #4 (close/completion race) |
| P3       | 1     | #5 (zombie cleanup counting) |

---

## Non-Findings

- **Error propagation between agents**: Agent failures do NOT cascade. Each session has its own try/catch in `handleCompletion` (line 716-737). A child agent failure is caught, archived, and the parent is notified via escalation — clean isolation.
- **Shared mutable state**: Sessions share only the `activeSessions` Map and `callDepths` Map by reference, but individual session objects are not shared between concurrent operations. No shared mutable data structures between running agents.
- **DB write failures in zombie cleanup**: Already wrapped in best-effort try/catch blocks (lines 1259-1265). Failure doesn't cascade.
