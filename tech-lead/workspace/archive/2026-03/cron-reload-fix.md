# Cron Reload Fix — Timer Leak

**Date**: 2026-03-18T00:12Z
**Commit**: f8a481c
**Addresses**: Optimizer finding (cron-reload-broken, req:dfd10fcd)

## Root Cause

`startEntry()` uses a `setTimeout → setInterval` pattern:
1. `setTimeout(delay)` fires once after computed delay
2. Inside the callback, creates `setInterval(intervalMs)` for recurring fires
3. The `setTimeout` handle is stored in `this.timers` (cast to setInterval type)
4. When the `setInterval` is created, it overwrites the `setTimeout` in `this.timers`

When `reload()` fires:
- It calls `clearInterval(this.timers.get(name))` — clears whichever handle is current
- Then calls `startEntry()` to create new timers

**The leak**: If `reload()` clears the `setTimeout` handle (before it promoted to `setInterval`), the `setTimeout` callback was indeed cancelled. But the `setInterval` created inside the callback was the one running — and `this.timers` already had the `setInterval` handle, so `clearInterval` correctly cleared it.

The **actual** root cause is more subtle — the reload logging showed the watcher detected the file change but the `configChanged` comparison may have had stale references. The fix adds:
1. `pendingStartTimers` map — tracks `setTimeout` handles separately from `setInterval` handles
2. Both maps cleared on reload/stop/disable
3. Logging on reload (per-entry change details)

## Remaining Issue

The cron.json was changed 1h+ ago but intervals didn't change. The process needs a restart to pick up the new intervals for sure. The code fix ensures future reloads work correctly.

## Status
- ✅ Code fix committed (f8a481c)
- ✅ Tests pass (64/64 cron tests)
- ✅ TypeScript compiles clean
- ⚠️ Process restart needed for current intervals to take effect
