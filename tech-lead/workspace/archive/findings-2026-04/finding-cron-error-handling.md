# Finding: Cron Handler Error Handling — Fragility Analysis

**Date**: 2026-04-16  
**Lens**: D (Fragility)  
**Severity**: LOW — errors are contained, not silent, but no retry exists

## Summary

Cron handler errors are **caught and logged but never retried**. An unhandled throw in any cron execution path (heartbeat, JS handler, or detached job) will NOT crash the process — it's caught by `.catch()` or `try/catch`, logged via `this.onError()`, and the request is marked `FAILED` in the DB. The next scheduled fire will run normally.

## Evidence

### Three execution modes in `src/app/cron.ts`:

1. **Heartbeat** (`fireHeartbeat`, ~line 639): 
   - Outer `try/catch` (line 867) catches sync errors during setup
   - `.catch()` (line 841) catches async errors from `manager.callAgent()`
   - Both log via `this.onError()` and `updateRequest(..., { status: "FAILED" })`

2. **JS Handler** (`fireHandler`, ~line 883):
   - `handler().then(...).catch(...)` pattern (line 911)
   - Errors logged and request marked FAILED
   - No retry logic

3. **Detached job** (`fireDetached`, ~line 930+):
   - Spawns separate OS process — errors handled via process exit code monitoring

### What `onError` does:
- In `src/app/may.ts` line ~1146+, `Cron` is constructed with `onError` wired to `bus.emit({ type: "log", level: "error", ... })` — goes to console/event log. NOT silent.

### What's missing:
- **No retry**: If evaluation-sync or research-sync throws, that run is lost. Next scheduled fire starts fresh.
- **No alerting escalation**: Repeated failures don't trigger any notification beyond individual error logs. The auto-pause system only applies to **heartbeat** mode, not JS handlers.
- **No circuit breaker for handlers**: A handler that consistently throws will keep firing every interval, logging errors each time, with no backoff or pause.

## Assessment

This is actually **well-designed for the current use case**:
- Cron handlers are idempotent sync jobs (evaluation-sync, research-sync) that process whatever is pending. A missed run means the next run picks up the work.
- Process stability is preserved — no single handler can crash the system.
- Failures are visible in both logs and the request DB.

The gap is minor: **JS handlers lack the auto-pause protection that heartbeats have**. If `evaluation-sync` enters a persistent failure loop (e.g., DB corruption), it will log errors every interval forever with no escalation.

## Recommended Action

**No immediate fix needed.** If handler reliability becomes a concern, consider:
- Extending auto-pause to JS handler mode (track consecutive failures per handler name)
- Adding a simple "N consecutive failures → notify" threshold for handlers
- This would be a small enhancement, not urgent
