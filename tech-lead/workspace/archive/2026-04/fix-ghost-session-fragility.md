# Fix: Ghost Session Fragility in manager.ts

**Date**: 2026-04-12
**Lens**: D (Fragility)
**Session**: s_1775958848156_1768

## Problem

In `manager.ts`, `activeSessions.set(sessionId, session)` runs at line 986.
After that, ~28 lines of code execute before `session.promise` is assigned
(line ~1034). This includes:

1. `bridgeAgentEvents()` — wires event bus
2. `readSessionMeta()` + `emit(session_start)` — notifies subscribers
3. `buildSessionContext()` — 5+ unprotected function calls:
   - `runActiveRecall()` — file reads
   - `readLatestCheckpointForAgent()` — file reads
   - `routeKnowledge()` — file reads + matching
   - `readFileSync(contextFiles)` — file reads (race: existsSync then read)
   - `readFileSync(context.md)` — file read
4. `routeFewShotExamples()` — file reads

If **any** of these throw, the session is stuck in `activeSessions` with no
`promise` set. Consequences:
- `waitFor()` on this session hangs forever
- `isAgentHeartbeatRunning()` sees the ghost → blocks all future heartbeats
- Session stays "running" in meta.json forever
- Only clears on process restart (or timeout, if configured)

## Evidence

- 2 sessions found with `endedAt IS NULL` and age >13 days (status: done though,
  so likely from a different bug — DB write missed, not ghost sessions)
- No confirmed ghost sessions from this specific path yet
- But the code path is real: `runActiveRecall` reads from disk without try-catch,
  a corrupt or missing failure-history file would trigger it

## Fix Applied

Wrapped the entire section from `activeSessions.set()` to `session.promise`
assignment in a try-catch. On failure:

```typescript
} catch (err) {
  // Ghost session prevention: clean up to prevent permanent blocking
  this.activeSessions.delete(sessionId);
  this.clearTimeout(session);
  log("error", `[run] Session ${sessionId} startup failed after activation: ${err}`);
  try {
    const existingMeta2 = readSessionMeta(this.registry.persistDir, sessionId);
    if (existingMeta2) {
      this.registry.saveSession(sessionId, {
        ...existingMeta2,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } catch { /* best-effort — don't mask the original error */ }
  throw err;
}
```

The catch block:
1. Removes session from `activeSessions` — prevents ghost
2. Clears timeout timer — prevents dangling timer
3. Logs the error — makes failures visible
4. Updates meta.json to `status: error` — prevents stale "running" in registry
5. Re-throws — so the caller (fireHeartbeat) still gets the error

## Why not move `activeSessions.set()` later?

The comment says "Add to activeSessions before notifying listener (subscribe()
needs it)". The `bridgeAgentEvents` and `emit(session_start)` calls need the
session to be in the active map for subscribers that query it. Moving it later
would break that contract. The try-catch approach preserves the ordering
requirement while adding cleanup on failure.

## Verification

- `tsc --noEmit` — clean (exit code 0)
- `vitest --run test/manager*.test.ts` — 97/97 tests pass
- File: `src/lib/manager.ts` — only file modified
