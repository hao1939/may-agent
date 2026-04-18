# Finding: Cron Handler Isolation

**Lens**: D (Fragility)  
**Date**: 2026-04-18  
**Severity**: Low (isolation is good) / Medium (no hang timeout)

## Summary

Cron handlers are **fully isolated** — one failure cannot block others. However, there is **no timeout for JS handlers**: a hanging handler will block its own slot forever.

## Evidence

### Isolation: Each entry gets its own timer

Each enabled cron entry gets an independent `setInterval` via `startEntry()` (`src/app/cron.ts:270-285`). There is no shared loop — entries fire independently on their own timers.

### Error handling: per-handler catch

- **JS handlers** (`fireHandler`, `src/app/cron.ts:437-462`): The handler promise has `.catch()` that logs the error and marks the request FAILED. Errors don't propagate.
- **Heartbeats** (`fireHeartbeat`, `src/app/cron.ts:302-435`): Wrapped in try/catch (`src/app/cron.ts:338,424`), and `manager.waitFor()` has `.catch()` (`src/app/cron.ts:402`). Errors are contained.
- **Detached jobs** (`fireDetachedJob`, `src/app/cron.ts:480-518`): Spawn is in try/catch (`src/app/cron.ts:486,507`). Process runs in separate OS process — inherently isolated.

### Gap: No timeout for hanging JS handlers

If a JS handler promise never resolves, `isRunning()` (`src/app/cron.ts:229-240`) returns true forever (the request stays IN_PROGRESS), so subsequent fires are skipped (`src/app/cron.ts:290-293`). But there's no mechanism to kill or abort the hanging handler. The slot is permanently blocked until process restart.

Heartbeats have the same theoretical risk via `manager.waitFor()` never resolving, but the `watchdog` cron (`agents/may/cron.json`, 10min interval) cancels sessions stuck >30min, which provides a safety net for heartbeats. JS handlers have no equivalent watchdog.

### Overlap protection works per-entry

The `fire()` closure in `startEntry()` (`src/app/cron.ts:272`) checks `isRunning(entry.name)` before firing — this is per-entry, not global. One slow handler doesn't affect others.

## Recommended Action

**No urgent fix needed.** The architecture is sound — handlers are isolated with per-handler error catching.

**Nice-to-have (P2):** Add a timeout wrapper to `fireHandler()` — if a JS handler doesn't resolve within `handlerConfig.timeoutMs` (or a default like 5 min), mark it FAILED and move on. This would prevent a single buggy handler from permanently losing its cron slot.
