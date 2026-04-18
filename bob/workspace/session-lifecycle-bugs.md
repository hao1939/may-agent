# Session Lifecycle Bug Analysis — manager.ts

**Analyst**: Bob | **Date**: 2026-04-09 | **Scope**: Stuck sessions, race conditions, memory leaks

---

## Bug 1: `input()` Double-Wake Race Condition
**Severity**: HIGH | **File**: `src/lib/manager.ts` (lines ~1620-1660)

### Description
When two concurrent `input()` calls arrive for the same idle session, both can see `session.status === "idle"` before either sets it to `"running"`. Both calls then:
1. Set `session.status = "running"`
2. Call `runAgentWithRetry()` with `agent.prompt(text)`
3. Overwrite `session.promise` (second call stomps the first)
4. Overwrite `sessionResults` (second call stomps the first)

### Code Path
```typescript
// Both callers see this as true simultaneously:
if (session.status === "idle") {
  session.status = "running";  // No atomic check-and-set
  ...
  session.promise = runAgentWithRetry(...);
  this.sessionResults.set(sessionId, resultPromise);
}
```

### Impact
- Two competing `agent.prompt()` calls run on the same Agent instance simultaneously
- The first `session.promise` is orphaned — nobody awaits it, and its `handleCompletion` callback fires independently
- `handleCompletion` may archive the session while the second prompt is still running
- The `sessionResults` map loses reference to the first promise — `waitFor()` callers see only the second result

### Reproduction
Call `manager.input(sessionId, "msg1")` and `manager.input(sessionId, "msg2")` without awaiting the first. This is plausible in a web UI where a user double-clicks send, or where automated systems inject messages rapidly.

---

## Bug 2: `gatedPrompt` — Indefinite Session Stall (No Timeout on ApiGate Queue)
**Severity**: HIGH | **File**: `src/lib/api-gate.ts` (lines ~96-140), `src/lib/manager.ts` (lines ~1740-1755)

### Description
When `apiGate.acquire()` queues a session because all slots are full, the session stays in `status: "running"` indefinitely if:
- All slot holders crash without calling their release function
- The signal parameter is not passed (and it isn't — see `gatedPrompt()`)

### Code Path
```typescript
// manager.ts gatedPrompt():
private gatedPrompt(session: ActiveSession, callFn: () => Promise<void>): Promise<void> {
    ...
    return this.apiGate
      .acquire(gateKey, session.sessionId, session.agentName)  // NO signal param!
      .then((release) => callFn().finally(release));
}

// api-gate.ts acquire():
async acquire(baseUrl, sessionId, agent, signal?: AbortSignal): Promise<() => void> {
    // signal is optional and gatedPrompt never passes it
    // Without signal, the queued promise can wait forever
}
```

### Impact
- Session stays `"running"` forever in the registry
- `resumeStaleSessions` on restart would try to resume it, but the underlying state is unrecoverable
- The session's timeout timer (if configured) DOES fire because `setupTimeout` runs before `gatedPrompt`, but `cancel()` calls `agent.abort()` — which may not abort a promise that hasn't started yet (the agent hasn't been prompted)
- `cancel()` calls `apiGate.releaseAll()` which removes the session from the queue, but the `runAgentWithRetry` initial call promise (`gatedPrompt`) never resolves or rejects — it's leaked

### Deeper: `cancel()` During Gate Wait
When `cancel()` is called on a session waiting in the ApiGate queue:
1. `session.agent.abort()` is called — but the agent hasn't started streaming (it's waiting for the gate)
2. `apiGate.releaseAll()` removes the session from the queue — but the Promise from `acquire()` is never resolved or rejected (it's just removed from the array)
3. The `gatedPrompt` promise hangs forever → `runAgentWithRetry` never resolves → `session.promise` never settles → `handleCompletion` never fires
4. Session stays in `activeSessions` map forever

### Fix Suggestion
Pass the agent's abort signal to `apiGate.acquire()`. Alternatively, have `releaseAll()` reject queued entries instead of just removing them.

---

## Bug 3: `handleCompletion` Throws → Session Stuck in `activeSessions`
**Severity**: MEDIUM | **File**: `src/lib/manager.ts` (lines ~395-490)

### Description
`handleCompletion` is called as a callback from `runAgentWithRetry`. If any step in the pipeline throws an uncaught exception (e.g., `determineOutcome`, `buildSessionInfo`, `upsertDigest`, bus `emit`), the session is never removed from `activeSessions` and never archived.

### Code Path
```typescript
// In runAgentWithRetry (manager-retry.ts):
onComplete(session);  // If this throws, the promise rejects

// In handleCompletion (manager.ts):
detectErrors(session);              // Pure — unlikely to throw
clearPostFinishErrors(session);     // Pure — unlikely to throw
handleOverflow(session, this.agents); // Writes to filesystem — could throw
detectShallowHeartbeat(session);    // Pure
const outcome = determineOutcome(session);  // Pure
session.archiveStatus = outcome.archiveStatus;
...
this.activeSessions.delete(session.sessionId);  // Only reached if nothing above throws
```

### Impact
If `handleOverflow` throws (e.g., disk full), or if `buildSessionInfo` throws (unexpected null), the session remains in `activeSessions` with status `"running"`. The session promise rejects with the thrown error, but:
- `sessionResults` gets a rejected promise → `waitFor()` throws
- The session is never removed from `activeSessions` → `status()` still lists it as running
- The session is never cleaned up → memory leak
- `cleanupZombieSessions` won't catch it because it's still in `activeSessions`

### Note
`handleOverflow` has a try/catch internally (`writeProgressFile` is best-effort), so the practical risk here is lower. But the `emit()` call for session_end events, and the `onSessionComplete` callback, are wrapped in try/catch. The main risk surface is `buildSessionInfo` or `determineOutcome` receiving unexpected state.

---

## Bug 4: `resumeSession` + `run` Race on Same Session ID
**Severity**: MEDIUM | **File**: `src/lib/manager.ts`

### Description
If `resumeStaleSessions()` runs concurrently with `run()` using `opts.sessionId` set to a stale session ID, both can create an `ActiveSession` for the same ID:

1. `resumeStaleSessions()` iterates stale sessions and calls `resumeSession(id, ...)`
2. Meanwhile, a caller invokes `run(name, task, { sessionId: id })` — perhaps from a detached session re-entering
3. Both call `this.activeSessions.set(sessionId, session)` — the second overwrites the first

### Code Path
```typescript
// run():
this.activeSessions.set(sessionId, session);  // No check if already present

// resumeSession():
this.activeSessions.set(sessionId, session);  // No check if already present
```

### Impact
- The first session's Agent instance is orphaned — its promise runs but nobody tracks it
- `handleCompletion` fires for both sessions, but `activeSessions.delete()` in the first one removes the entry that the second one relies on
- Double-subscribe to the same JSONL persistence → possible corrupted/interleaved messages

### Practical Likelihood
Low in normal operation (resumeStaleSessions runs once at startup before new sessions are created). But possible if a detached session uses a pre-assigned `sessionId` that matches a stale session being resumed.

---

## Bug 5: `sessionResults` Map Never Cleaned Up — Unbounded Memory Growth
**Severity**: MEDIUM | **File**: `src/lib/manager.ts`

### Description
The `sessionResults` map stores a `Promise<TaskResult>` for every session ever started by this manager instance. The comment says "Survives session removal from activeSessions so waitFor() works even if the session completes before waitFor() is called." However, entries are **never deleted**.

### Code Path
```typescript
private sessionResults = new Map<string, Promise<TaskResult>>();

// In run():
this.sessionResults.set(sessionId, session.promise.then(() => this.buildResultFromSession(session)));

// In input():
this.sessionResults.set(sessionId, resultPromise);

// NOWHERE: this.sessionResults.delete(sessionId);
```

### Impact
Each entry holds:
- A resolved Promise (small — ~50 bytes overhead)
- The `TaskResult` closure which references `session` → which references `Agent` → which references the full `messages` array (potentially 100KB+ per session)

Over a long-running process with thousands of sessions, this is a genuine memory leak. The `activeSessions` map is cleaned up properly (sessions are deleted on completion), but `sessionResults` grows without bound.

### Fix Suggestion
Delete entries from `sessionResults` in `handleCompletion` after a brief delay (or in `cleanupZombieSessions`). Or use a WeakRef-based approach. Or clean up entries older than N minutes.

---

## Bug 6: `buildResultFromSession` Captures Stale Session State
**Severity**: LOW | **File**: `src/lib/manager.ts`

### Description
In `run()`, the result promise is built as:
```typescript
this.sessionResults.set(
  sessionId,
  session.promise.then(() => this.buildResultFromSession(session)),
);
```

`buildResultFromSession` reads `session.agent.state.messages` at call time. But the `session` object was already removed from `activeSessions` by `handleCompletion`. The closure captures the `session` reference, which still holds the Agent and its messages. This is correct for reading data, but the `session.archiveStatus` and `session.finishResult` fields are set in `handleCompletion` **before** the session is deleted — so this works by accident because `handleCompletion` runs synchronously before `session.promise` resolves.

However, if `handleCompletion` were ever made async (e.g., for async digest generation), the `.then()` callback could race with `handleCompletion`, reading incomplete session state.

### Impact
Currently safe due to synchronous execution. Fragile to future refactoring.

---

## Bug 7: `close()` + `handleCompletion` Race — Double Archival
**Severity**: LOW | **File**: `src/lib/manager.ts` (lines ~1760-1830)

### Description
`close()` sets `session.closed = true` to prevent `handleCompletion` from acting. But there's a window:

1. `handleCompletion` starts executing (clears timeout, passes the `if (session.closed) return` guard)
2. Concurrently, `close()` is called — sets `session.closed = true` and calls `cancel()`
3. `handleCompletion` is already past the closed guard — continues to archive
4. `close()` also archives (after cancel's abort triggers)

### Code Path
```typescript
// handleCompletion (already past the guard):
handleCompletion(session): void {
    this.clearTimeout(session);
    if (session.closed) return;  // <-- already passed this
    ...
    this.activeSessions.delete(session.sessionId);  // First delete

// close() (running concurrently):
close(sessionId: string): void {
    session.closed = true;  // Too late — handleCompletion already passed the guard
    this.cancel(sessionId);
    ...
    this.activeSessions.delete(sessionId);  // Second delete — no-op (already gone)
```

### Impact
In practice, JavaScript is single-threaded so true concurrency doesn't happen. But if `handleCompletion` has any async gaps (awaiting upsertDigest, etc.), `close()` could interleave. The `session.closed` flag is checked at the top of `handleCompletion`, but the async digest operations (upsertDigest calls with `.catch()`) run on the microtask queue and could allow interleaving.

Currently safe because `handleCompletion` is synchronous — all the `upsertDigest` calls are fire-and-forget (`.catch()` only). If these were ever awaited, the race would materialize.

---

## Bug 8: `resumeSession` Doesn't Restore `parentAgentName`
**Severity**: LOW | **File**: `src/lib/manager.ts` (lines ~1280-1330)

### Description
When `resumeSession` recreates an `ActiveSession`, it does NOT set `parentAgentName`:
```typescript
const session: ActiveSession = {
    ...
    parentSessionId: persisted.parentSessionId,
    // parentAgentName: NOT SET
    ...
};
```

But `handleCompletion` → `escalateBlockedSession` uses `session.parentAgentName` to route escalations:
```typescript
const parentName = session.parentAgentName;
if (parentName) {
    trackRequest(..., { toAgent: parentName, ... });
}
```

### Impact
Resumed sessions that end in `blocked` or `failure` status will not escalate to their parent agent. The escalation is silently skipped because `parentAgentName` is undefined.

---

## Bug 9: `infraRetryCount` Not Persisted → Unlimited Retries After Resume
**Severity**: LOW | **File**: `src/lib/manager.ts`, `src/lib/manager-retry.ts`

### Description
When a session is resumed after a crash, `infraRetryCount` is reset to 0:
```typescript
const session: ActiveSession = {
    ...
    infraRetryCount: 0,  // Reset on resume
    ...
};
```

If the session keeps hitting transient errors, each restart gives it a fresh retry budget. A session could theoretically loop: hit infra errors → exhaust retries → crash → resume → fresh retries → repeat indefinitely.

### Impact
In practice, `resumeStaleSessions` is called once on process restart, and sessions with persistent errors will eventually be caught by `cleanupZombieSessions` (30-minute threshold). But there's no upper bound on total lifetime retries.

---

## Bug 10: `callDepths` Map Never Cleaned for Crashed Root Sessions
**Severity**: LOW | **File**: `src/lib/manager.ts`

### Description
The `callDepths` map tracks nesting depth per root session:
```typescript
private callDepths = new Map<string, number>();
```

If a root session crashes without its `callAgent` finally-block running (e.g., process crash mid-call), the entry remains in `callDepths` forever. Since `findRootSession` walks up the parent chain, and crashed sessions are eventually removed from `activeSessions`, `findRootSession` returns the crashed session ID as the root — and the stale `callDepths` entry persists.

### Impact
Minor memory leak. The map entry is tiny (string → number). No functional impact since the root session ID won't be reused.

---

## Summary Table

| # | Bug | Severity | Stuck Session? | Race? | Memory Leak? |
|---|-----|----------|---------------|-------|--------------|
| 1 | `input()` double-wake | HIGH | ✓ (orphaned promise) | ✓ | ✓ |
| 2 | `gatedPrompt` no abort signal | HIGH | ✓ (indefinite stall) | | |
| 3 | `handleCompletion` throws | MEDIUM | ✓ | | ✓ |
| 4 | `resumeSession`/`run` same ID | MEDIUM | ✓ (orphaned agent) | ✓ | |
| 5 | `sessionResults` never cleaned | MEDIUM | | | ✓ |
| 6 | Stale session state in closure | LOW | | ✓ (future risk) | |
| 7 | `close()`/`handleCompletion` race | LOW | | ✓ (future risk) | |
| 8 | `parentAgentName` not restored | LOW | | | |
| 9 | `infraRetryCount` not persisted | LOW | | | |
| 10 | `callDepths` stale entries | LOW | | | ✓ (minor) |

### Top Priority Fixes
1. **Bug 2**: Pass abort signal to `apiGate.acquire()` in `gatedPrompt`, or have `releaseAll` reject queued promises
2. **Bug 1**: Add a guard in `input()`: if `session.status !== "idle"` after the check (reentrant call), return the existing promise instead of starting a new one
3. **Bug 5**: Add cleanup of `sessionResults` in `handleCompletion` or `cleanupZombieSessions`
