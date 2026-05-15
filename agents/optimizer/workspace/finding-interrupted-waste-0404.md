# Finding: Interrupted Sessions Never Resume — 15.7% Op Waste

**Date**: 2026-04-04  
**Severity**: High (15.7% of all ops wasted, ~2066 ops/week)  
**Category**: Infrastructure waste

## Summary

Interrupted sessions account for 15.7% of all operations (2066/13164 ops in 7 days). These sessions are **never resumed** because both `gracefulShutdown()` and `gracefulRestart()` in `src/app/may.ts` explicitly cancel all running sessions before the process exits.

## Root Cause

Flow when process restarts:
1. SIGTERM/hot-reload triggers `gracefulShutdown()` or `gracefulRestart()`
2. Both functions cancel ALL running sessions via `manager.cancel()`
3. Sessions are marked `status: "interrupted"` with error `"Request was aborted."`
4. Process exits
5. New process starts → `resumeStaleSessions()` finds no "running" sessions → nothing to resume
6. Next heartbeat cycle starts fresh sessions that redo all the work

## Evidence

- 32 interrupted sessions in 24h, ALL with error "Request was aborted."
- 0 out of 21 interrupted sessions (>20 ops) were successfully resumed
- Interrupt clusters align with process restart times (08:15-09:25, 15:15 UTC)
- 12 "big" interrupts (>50 ops) accounted for 1242 ops of waste

## Impact

- **2066 ops/week wasted** (15.7% of total)
- **~$15-25/week** in wasted LLM costs  
- Agents like optimizer (198 ops), coach (157 ops), bob (97 ops) regularly lose significant work
- Some sessions are interrupted multiple times in succession (optimizer: 140→198→interrupted again)

## Proposed Fix

In `gracefulRestart()` (hot-reload path), **skip the session cancel loop**:
- Leave sessions as `status: "running"` so `resumeStaleSessions()` picks them up
- The resume mechanism already works (reads saved messages, repairs broken sequences, injects restart notice)
- Only `gracefulShutdown()` (permanent exit) should cancel sessions

```typescript
// In gracefulRestart() — REMOVE or SKIP:
// for (const s of manager.status()) {
//   if (s.status === "running") {
//     manager.cancel(s.sessionId);
//   }
// }
```

This would recover the 15.7% waste for hot-reload scenarios. For SIGTERM (deploy), sessions would still be cancelled.

## Caveats

- Need to verify that `resumeSession()` handles all edge cases properly (mid-tool-call, mid-write, etc.)
- The session's `maxTurns` and turn count must be preserved across restarts (already fixed: `persisted.maxTurns ?? 0`)
- If the same cron job fires before the old session resumes, there could be duplicates — need de-dupe logic
