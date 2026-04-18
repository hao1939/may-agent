# Audit: activeSessions Map Fragility

**Date**: 2026-04-13  
**Scope**: `src/lib/manager.ts` — the `activeSessions: Map<string, ActiveSession>` field  
**File version**: 2472 lines  

---

## Summary

The `activeSessions` Map is the single in-memory truth for all running sessions. It is written in 3 places (`.set()`), read in 23+ places (`.get()/.has()/.values()`), and deleted in 4 places. The code has significant defensive measures already (ghost session try-catch, Bug 4 duplicate guard, zombie cleanup, `closed` flag). However, several fragility vectors remain.

---

## Finding F-1: `sessionResults` cleanup relies on setTimeout — process restart leaks permanently (P2)

**Evidence**: Lines 764, 860  
```ts
setTimeout(() => {
  this.sessionResults.delete(session.sessionId);
}, 60_000);
```

Both `handleCompletion` (line 764) and the error catch-block (line 860) schedule a 60-second delayed cleanup of `sessionResults`. If the session completes but the process restarts within that 60-second window, the `sessionResults` entry is lost (no leak), BUT the inverse is also true: if many sessions complete without the timer firing (event loop blockage, backpressure), entries accumulate.

**Impact**: Minor. In practice, 60s is fine for normal load. Would only matter under extreme concurrency where thousands of sessions finish per minute.

**Recommended fix**: Low priority. Could add a periodic sweep of `sessionResults` for entries whose promise is already settled, but the current approach is adequate.

---

## Finding F-2: `.get()` on miss — inconsistent handling (P2)

**Evidence**: Multiple sites return silently vs. throw on miss.

| Line | Method | On miss | Behavior |
|------|--------|---------|----------|
| 1670 | `progress()` | Falls through to archive | ✅ Correct |
| 1695 | `result()` | Falls through to archive | ✅ Correct |
| 1795 | `input()` | Throws | ✅ Correct |
| 2013 | `steer()` | Throws | ✅ Correct |
| 2069 | `subscribe()` | Throws | ✅ Correct |
| 1855 | `cancel()` | Silent return | ⚠️ Intentional (no-op cancel is safe) |
| 1937 | `close()` | Silent return | ⚠️ Intentional |
| 988 | `run()` parentAgentName lookup | Returns `undefined` | ⚠️ Silent — `parentAgentName` becomes `undefined` |
| 1424 | `resumeSession()` parentAgentName lookup | Falls back to meta | ✅ Correct |
| 2433 | `getSessionSummary()` | Falls through to archive | ✅ Correct |

**Verdict**: The `.get()` miss behavior is actually well-handled. The `cancel()` and `close()` no-ops are intentional and documented. The only minor inconsistency is parentAgentName lookup at line 988 — if the parent session already completed and was archived between the fork and the child's `run()` call, `parentAgentName` is silently `undefined`, which breaks escalation routing. The `resumeSession()` path (line 1424) correctly falls back to `readSessionMeta()`, but `run()` doesn't.

**Recommended fix**: Add `readSessionMeta()` fallback to line 988 (matching line 1424).

---

## Finding F-3: Ghost session try-catch covers post-activation but not pre-activation (P3)

**Evidence**: Lines 1048-1113

```ts
// Line 1048 — Point of no return
this.activeSessions.set(sessionId, session);

try {
  // Lines 1050-1098: bridgeAgentEvents, emit, buildSessionContext, runAgentWithRetry
  ...
  return sessionId;
} catch (err) {
  // Lines 1105-1113: Ghost session prevention
  this.activeSessions.delete(sessionId);
  ...
  throw err;
}
```

The ghost session fix (the try-catch at lines 1105-1113) covers the case where setup AFTER `activeSessions.set()` throws. This is correct and well-implemented.

What it does NOT need to cover: everything BEFORE line 1048 (session construction, directory creation) doesn't touch `activeSessions`, so a throw there is naturally clean.

**Verdict**: The ghost session fix is adequate. The `closed` flag (set by `close()` at line 1940) prevents `handleCompletion` from double-archiving. The `catch` block also updates the registry status to "error" and logs. Coverage is good.

---

## Finding F-4: Duplicate session ID guard is synchronous-only (P3)

**Evidence**: Line 959

```ts
if (this.activeSessions.has(sessionId)) {
  throw new Error(`Session "${sessionId}" is already active — cannot start a duplicate`);
}
```

This guard prevents starting a session with an already-active ID. It works because JavaScript is single-threaded — between the `has()` check and the `set()` at line 1048, no other code runs.

**Risk**: Near-zero in the current architecture. Would only be a problem if `run()` were made async before the `.set()` call (currently it's synchronous up to that point).

**Recommended fix**: None needed.

---

## Finding F-5: `handleCompletion` error catch-block — partial cleanup, no `sessionResults` (P2)

**Evidence**: Lines 748-769

```ts
} catch (err) {
  log("error", `[handleCompletion] Unexpected error for ${session.sessionId}: ${err}`);
  try {
    session.error = ...;
    session.archiveStatus = "error";
    session.endedAt = Date.now();
    this.registry.updateSessionStatus(...);
    session.unsubscribe?.();
    this.removeSentinel(session.sessionId);
    this.cleanupSession(session);
  } catch { /* best-effort */ }
  this.activeSessions.delete(session.sessionId);
  this.cleanupCallDepths(session.sessionId);
  setTimeout(() => {
    this.sessionResults.delete(session.sessionId);
  }, 60_000);
}
```

This catch-block mirrors `handleCompletionInner` but omits:
1. No `session_end` event emitted → session subscribers (evaluator, memory writer, digest) never fire
2. No `escalateBlockedSession()` call → blocked sessions silently disappear

**Impact**: If `handleCompletionInner` throws (which is the rare case this catch handles), the session is properly cleaned from memory but downstream subscribers miss the completion event. The evaluator never scores it, memory never logs it.

**Recommended fix**: Emit a minimal `session_end` event in the catch-block with `status: "error"`.

---

## Finding F-6: Process restart → empty `activeSessions` — mid-flight sessions become orphans (P1)

**Evidence**: `resumeStaleSessions()` (lines 1157-1261), `cleanupZombieSessions()` (lines 1268-1345)

When the process restarts:
1. `activeSessions` is empty (no persistence — it's a pure in-memory Map)
2. `resumeStaleSessions()` is called during startup to detect and resume orphans
3. Sessions are identified by scanning `[STARTED]` sentinel files and registry entries with `status: "running"`

**Current coverage**:
- ✅ Sentinel-based detection catches sessions that crashed mid-execution
- ✅ Registry scan catches sessions without sentinels
- ✅ `isProcessAlive()` check skips detached sessions whose process is still running
- ✅ `kind` filter allows selective resumption (chat vs. job vs. call)
- ✅ Broken message sequences (mid-tool-call crash) are repaired with error tool results

**Gap**: No guarantee that `resumeSession()` restores all `ActiveSession` fields accurately. Specifically:
- `toolErrorHistory`, `toolErrorCount`, `infraRetryCount`: reset to 0/empty — the resumed session loses its error context. This means tainted handoff detection (P20) is inaccurate for resumed sessions.
- `filesModified`: reset to empty `Set` — the activity tracker loses previously-modified files.
- `turnCount` is reconstructed from message count, which is approximate (compacted messages reduce the count).

**Impact**: Resumed sessions have slightly degraded observability but function correctly. The P20 tainted handoff verdict is unreliable for resumed sessions.

**Recommended fix**: Consider persisting `toolErrorCount` and `filesModified` in `meta.json` so they survive restart.

---

## Finding F-7: Race between `close()` and `handleCompletion` — properly guarded (P3 — no action needed)

**Evidence**: Lines 1937-1940, 740-741

```ts
// close() sets this first:
session.closed = true;  // line 1940

// handleCompletion checks it:
if (session.closed) return;  // line 740-741
```

The `closed` flag prevents double-processing. Since JS is single-threaded, `close()` sets the flag synchronously before calling `cancel()`, and the `handleCompletion` callback (which fires when the cancelled promise settles) sees `closed = true` and bails.

**Additional safety**: `close()` also checks `if (!this.activeSessions.has(sessionId)) return;` after cancel (line 1947), handling the case where a task session was already archived by cancel's handleCompletion path.

**Verdict**: This race is well-guarded. No action needed.

---

## Finding F-8: `cancel()` cascading delete uses live iterator (P3)

**Evidence**: Lines 1858-1863

```ts
for (const child of this.activeSessions.values()) {
  if (child.parentSessionId === sessionId && child.status === "running") {
    this.cancel(child.sessionId);
  }
}
```

`cancel()` iterates over `activeSessions.values()` and recursively calls `cancel()` on children. If a child's cancellation triggers `handleCompletion` synchronously (before the iterator advances), the child would be `.delete()`-ed from the Map during iteration.

**In practice**: `handleCompletion` fires asynchronously (when the promise settles after `agent.abort()`), so the iterator completes before any deletions occur. However, if a child session's promise is already settled when `abort()` is called, the microtask queue could fire `handleCompletion` before the loop finishes.

**Impact**: Very low risk. JavaScript Maps handle deletion-during-iteration gracefully (deleted entries are skipped, no crash). Worst case: a deeply nested child is skipped in one iteration but would be caught by zombie cleanup later.

**Recommended fix**: Optional — collect child IDs first, then cancel: `const childIds = [...this.activeSessions.values()].filter(c => c.parentSessionId === sessionId && c.status === "running").map(c => c.sessionId); for (const id of childIds) this.cancel(id);`

---

## Finding F-9: No upper bound on `activeSessions` size (P2)

**Evidence**: No size limit or admission control exists.

If an agent enters a loop spawning child sessions (e.g., a heartbeat that forks indefinitely), `activeSessions` grows without bound. Each entry holds an `Agent` instance with full message history in memory.

**Current mitigations**:
- Call depth limit (`_maxCallDepth`, default 10) prevents recursive `callAgent` chains
- Turn budget + timeout prevent individual sessions from running forever
- Zombie cleanup catches stale entries

**Gap**: No protection against "wide" spawning (one parent spawning hundreds of children). The call depth limit only guards depth, not breadth.

**Impact**: Memory exhaustion under pathological spawning patterns. In normal operation, the heartbeat cadence and session lifetimes keep counts low (typically <20 active).

**Recommended fix**: Consider a configurable `maxActiveSessions` guard in `run()` that rejects new sessions when the Map exceeds a threshold (e.g., 50).

---

## Severity Summary

| ID | Finding | Severity | Action |
|----|---------|----------|--------|
| F-1 | sessionResults cleanup via setTimeout | P3 | No action needed |
| F-2 | .get() miss inconsistency (parentAgentName in run()) | P2 | Add readSessionMeta fallback |
| F-3 | Ghost session try-catch coverage | P3 | Adequate — no action |
| F-4 | Duplicate session ID guard is sync-only | P3 | No action needed |
| F-5 | handleCompletion catch-block omits session_end event | P2 | Emit minimal session_end |
| F-6 | Process restart loses ActiveSession metadata | P1 | Persist toolErrorCount, filesModified |
| F-7 | close()/handleCompletion race | P3 | Well-guarded — no action |
| F-8 | cancel() live iterator | P3 | Optional: collect-then-cancel |
| F-9 | No upper bound on activeSessions size | P2 | Add maxActiveSessions guard |

**Top priority**: F-6 (P1) — resumed sessions lose error context, affecting tainted handoff accuracy.
