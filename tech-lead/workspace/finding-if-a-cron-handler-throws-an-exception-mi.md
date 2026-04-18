# Finding: Cron Handler Isolation

**Lens**: D (Fragility)  
**Date**: 2026-04-18  
**Severity**: None — system is well-designed  

## Question

If a cron handler throws an exception mid-execution, does it poison subsequent handlers in the same tick?

## Answer: Handlers are fully isolated — no shared dispatch loop exists

The cron system does **not** iterate handlers in a shared loop. Each cron entry gets its own independent `setTimeout` → `setInterval` timer in `startEntry()` (`src/app/cron.ts:395-410`). Handlers fire on their own schedule and cannot block or poison each other.

## Evidence

### 1. Independent timers per entry

`src/app/cron.ts:395-410` — `startEntry()` creates a per-entry `setTimeout` that promotes to `setInterval`. Each entry's `fire()` closure runs independently:

```ts
const startTimer = setTimeout(() => {
  this.pendingStartTimers.delete(entry.name);
  fire();
  const timer = setInterval(fire, entry.intervalMs);
  timer.unref();
  this.timers.set(entry.name, timer);
}, delay);
```

### 2. Error handling per execution mode

- **JS handlers** (`fireHandler`, `src/app/cron.ts:488-512`): The handler promise uses `.catch()` — errors are caught, logged via `this.onError?.()`, and the request is marked `FAILED`. No rethrow.

- **Heartbeats** (`fireHeartbeat`, `src/app/cron.ts:430-485`): Sync portion wrapped in `try/catch` (`src/app/cron.ts:441,484`). Async `manager.waitFor()` uses `.catch()` (`src/app/cron.ts:467`). Errors update the request to `FAILED` and log.

- **Detached jobs** (`fireDetachedJob`, `src/app/cron.ts:530-567`): `spawnDetachedAgent()` wrapped in `try/catch` (`src/app/cron.ts:536,554`). Spawn failures are tracked as `FAILED` requests.

### 3. No shared iteration

`start()` (`src/app/cron.ts:193-199`) loops over entries only to call `startEntry()` for each — this just registers timers, it doesn't execute handlers synchronously. After `start()` returns, each timer fires independently on the event loop.

## Conclusion

**No fragility found.** The architecture is inherently isolated — one handler's failure cannot affect any other handler. Errors are caught, logged, and tracked in the requests table. This is a clean design.
