# Design: Unified Handler Event Interface

**Status:** Proposal
**Date:** 2026-04-21
**References:** [event-driven-handlers.md](event-driven-handlers.md), [project-handler-events.md](project-handler-events.md), [core-principles.md](core-principles.md)

## Problem

Handlers don't know what triggered them. The handler signature is:

```typescript
// handler-context.ts
interface HandlerModule {
  create: (ctx: HandlerContext, entry: CronEntry) => () => Promise<void>;
}
```

The returned function takes **no arguments**. Whether it was a 5-minute timer tick, a `metric.breach` event, or a manual `triggerNow()` — the handler is blind.

This matters because:
- **Project handler** can't distinguish timer-catch vs event-trigger (see project-handler-events.md)
- **Any handler** subscribed to events via `on` can't branch on which event fired
- **Metrics** can't track event-driven ratio without this information
- **P1 violation** — timer ticks are not events, they're a separate invisible code path

## Principle

**Everything is an event.** A timer tick is an event. A bus event is an event. A manual trigger is an event. The handler always receives the event that woke it up.

## Design

### TriggerEvent type

```typescript
interface TriggerEvent {
  type: string;                        // "timer.tick" | "metric.breach" | "project.completed" | ...
  source: "timer" | "event" | "manual";  // how it was triggered
  entry: string;                       // cron entry name
  data?: Record<string, unknown>;      // event payload (for bus events)
  timestamp: number;
}
```

### Handler signature change

```typescript
// Before
interface HandlerModule {
  create: (ctx: HandlerContext, entry: CronEntry) => () => Promise<void>;
}

// After
interface HandlerModule {
  create: (ctx: HandlerContext, entry: CronEntry) => (event?: TriggerEvent) => Promise<void>;
}
```

The `event` parameter is **optional** — existing handlers that ignore it continue to work unchanged. Zero breakage.

### Cron system changes

Three places in `cron.ts` call the handler. Each wraps the call with a TriggerEvent:

**1. Timer tick** (interval fires):
```typescript
// Before:
handler()

// After:
handler({
  type: "timer.tick",
  source: "timer",
  entry: entry.name,
  timestamp: Date.now(),
})
```

**2. Event dispatch** (`dispatchEvent` → `triggerNow`):
```typescript
// In dispatchEvent(), pass the event through:
dispatchEvent(eventType: string, data?: Record<string, unknown>): number {
  // ...existing dedup logic...
  if (this.triggerNow(entryName, {
    force: true,
    triggerEvent: { type: eventType, source: "event", entry: entryName, data, timestamp: Date.now() }
  })) triggered++;
}
```

**3. Manual trigger** (`triggerNow` called directly):
```typescript
handler({
  type: "manual.trigger",
  source: "manual",
  entry: entry.name,
  timestamp: Date.now(),
})
```

`triggerNow` gains an optional `triggerEvent` in its options. If not provided, it creates a manual trigger event.

### What handlers can do with it

**Project handler** (the motivating case):
```typescript
return async (event?: TriggerEvent) => {
  // ... existing scan logic ...

  if (launched > 0) {
    const source = event?.source ?? "timer";
    const metricName = source === "timer"
      ? "handler.project.timer-catches"
      : "handler.project.event-triggers";
    ctx.emit({ type: "metric", name: metricName, value: launched });
  }
};
```

**Metric alert handler** (could branch on event data):
```typescript
return async (event?: TriggerEvent) => {
  if (event?.type === "metric.breach") {
    // Targeted: only check the breached metric
    const metricId = event.data?.metric as string;
    // ...
  } else {
    // Timer fallback: scan all metrics
    // ...
  }
};
```

**Existing handlers** (no change needed):
```typescript
return async () => {  // event parameter ignored
  // ... works exactly as before ...
};
```

## Implementation

| File | Change | LOC |
|------|--------|-----|
| `src/lib/handler-context.ts` | Add `TriggerEvent` type, update `HandlerModule` signature | ~10 |
| `src/app/cron.ts` | Timer path: wrap `handler()` call with timer event | ~3 |
| `src/app/cron.ts` | `dispatchEvent`: pass event type/data through to `triggerNow` | ~5 |
| `src/app/cron.ts` | `triggerNow`: accept optional `triggerEvent`, pass to handler | ~5 |
| `agents/may/handlers/project.ts` | Use `event.source` for metrics (optional, can come later) | ~5 |
| **Total** | | **~28** |

## Backward Compatibility

- `event` parameter is optional — existing handlers compile and run unchanged
- Timer behavior unchanged — just wraps the tick as an event before calling
- Event dispatch behavior unchanged — just passes event data through
- No changes to cron.json format
- No changes to handler registration

## Relationship to Other Docs

- **event-driven-handlers.md**: Describes the `on` field and event dispatch. This design completes the picture — handlers now *receive* the event, not just get triggered by it.
- **project-handler-events.md**: The `timer-catches` vs `event-triggers` metric becomes trivially implementable once handlers know their trigger source.
- **P1 (everything is an event)**: Timer ticks become events. The handler interface is unified.
