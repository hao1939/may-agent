# Finding: Blast Radius of callAgent Failures in Cron Handlers

**Date**: 2026-04-17  
**Lens**: D (Fragility)  
**Severity**: Low — good isolation already exists

## Summary

Cron handler failures are well-isolated. Each handler runs on its own `setInterval` timer via `Cron.startEntry()`, and `fireHandler()` wraps each invocation in `.then()/.catch()` (src/app/cron.ts:903-920). A thrown/rejected handler updates the request to FAILED and logs via `onError` but does NOT affect other handlers or crash the cron loop.

## Evidence

### 1. Handler Isolation via Independent Timers
- **src/app/cron.ts:556-565**: Each entry gets its own `setTimeout` → `setInterval` pair in `startEntry()`. Handlers share no execution context.
- **src/app/cron.ts:881-923**: `fireHandler()` calls `handler().then(...).catch(...)` — the Promise chain fully catches errors. Failed handlers update request status to FAILED and call `onError` (logging only).

### 2. callAgent Failures Inside Handlers
- **agents/may/handlers/evaluator-heartbeat.ts:156-164**: `ctx.manager.callAgent("evaluator", ...)` is wrapped in try/catch. On failure, it logs and continues — does not propagate.
- **agents/may/handlers/evaluation-sync.ts:229+**: The entire handler body is wrapped in `try { ... } finally { db.close() }`. No callAgent usage here (heuristic evaluation is inline).

### 3. Overlap Protection
- **src/app/cron.ts:527-530**: `isRunning()` check in `fire()` prevents re-firing a handler that's still in progress. If a handler hangs, subsequent fires are skipped (logged as "still running") rather than stacking up.

## What Could Go Wrong

1. **Hanging handler with no timeout**: If a handler Promise never resolves (e.g., callAgent hangs), the request stays IN_PROGRESS forever, and `isRunning()` prevents all future fires of that entry. There's no handler-level timeout. The cron entry is effectively dead until process restart (which runs `failOrphans`).

2. **DB connection leak on handler crash**: `evaluation-sync.ts` properly closes its DB in `finally`. But if a handler creates a DB connection and throws before closing it, Bun's GC would eventually clean it up, but it's not guaranteed to be prompt.

## Recommended Actions

1. **Add handler-level timeout** (Medium priority): Wrap `handler()` calls in `fireHandler()` with a `Promise.race` against a configurable timeout (e.g., 10 minutes). On timeout, update request to FAILED. This prevents zombie entries.

2. No other changes needed — the architecture is sound. Error isolation between handlers is solid.
