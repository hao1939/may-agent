# Finding: EventBus Handler Blast Radius

**Lens**: D (Fragility)  
**Date**: 2026-04-19  
**Severity**: Low (well-handled)

## Question

If an EventBus handler throws an unhandled error, what is the blast radius? Does it kill other handlers, crash the process, or get caught?

## Summary

**The EventBus is resilient by design.** Both the EventBus subscriber dispatch and the cron handler dispatch have proper error isolation. A throwing subscriber cannot affect other subscribers or crash the process.

## Evidence

### 1. EventBus.emit() wraps each subscriber in try/catch

`src/app/event-bus.ts:105-112`:

```ts
emit(event: AgentEvent): void {
  for (const fn of this.subscribers) {
    try {
      fn(event);
    } catch (err) {
      /* subscriber errors never break the bus */
      log("warn", `[event-bus] subscriber threw on event '${event.type}': ${err}`);
    }
  }
}
```

Each subscriber is invoked independently. If subscriber N throws, subscribers N+1..M still execute. The error is logged at warn level and swallowed. The `emit()` caller is never affected.

**Limitation**: This only catches synchronous throws. If a subscriber returns a rejected Promise (async error), it becomes an unhandled rejection — the try/catch won't catch it. However, this would surface as a Node.js `unhandledRejection` event, not a crash of other subscribers.

### 2. Cron handler dispatch has separate async error isolation

`src/app/cron.ts:995-1014` — `fireHandler()` calls `handler().then(...).catch(...)`:

```ts
handler()
  .then(() => {
    updateRequest(this.persistDir, requestId, { status: "COMPLETED", ... });
  })
  .catch((err) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    updateRequest(this.persistDir, requestId, { status: "FAILED", ... });
    this.onError?.(`Cron handler "${entry.name}" failed: ${errMsg}`);
  });
```

Cron handlers are async functions. Errors are caught, the request is marked FAILED, and `onError` is called for logging. No crash, no effect on other cron jobs.

### 3. Cron tick dispatches handlers independently

`src/app/cron.ts:543-553` — each cron entry has its own `setInterval` timer via `startEntry()`. Entries fire independently; one handler's failure cannot prevent another entry from firing on its next tick.

## Severity Assessment

**Low risk.** The architecture correctly isolates errors at both layers:
- EventBus: per-subscriber try/catch (`event-bus.ts:107`)
- Cron: per-handler .catch() (`cron.ts:1005`)
- Cron entries: independent timers (`cron.ts:559-562`)

The only theoretical gap is async subscribers to EventBus (void-returning async functions called synchronously), but this is a standard Node.js pattern and would only produce unhandled rejection warnings, not process crashes.

## Recommended Action

None required. The error isolation is sound.
