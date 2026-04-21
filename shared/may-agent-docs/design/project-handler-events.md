# Design: Project Handler — Event-Driven Triggers & Health Metrics

**Status:** Reviewed — ready to implement
**Date:** 2026-04-21
**References:** [project-system.md](project-system.md), [event-driven-handlers.md](event-driven-handlers.md)

## Problem

The project handler has two trigger mechanisms: a 5-minute timer and event subscriptions. Currently the **timer does 100% of the work**. The event subscriptions are dead — they reference events that nobody emits.

### Current `on` list (cron.json)
```json
"on": ["project.commented", "project.changed", "workflow.done", "workflow.blocked", "metric.breach"]
```

### What the workflow actually emits
```
project.iteration    — after each iteration
project.completed    — evaluator PASS on done
project.blocked      — evaluator assessed blocker
project.status-changed — on status transitions
```

**Mismatch**: `project.commented`, `project.changed`, `workflow.done`, `workflow.blocked` don't exist anywhere in the codebase. Only `metric.breach` is real (emitted by metrics-snapshot).

## Fix

### 1. Align event subscriptions with real events

```json
"on": ["project.completed", "project.blocked", "metric.breach"]
```

- `project.completed` → check for metric projects that should pause, or follow-up work
- `project.blocked` → detect blocked projects needing attention or reactivation
- `metric.breach` → reactivate paused metric projects (already works)

Not subscribing to `project.iteration` — that fires every iteration and the handler doesn't need to react mid-workflow. The workflow handles iteration logic internally.

### 2. Timer becomes safety net, not primary trigger

The 5-minute timer scan remains. But if events are working correctly, the timer should find **zero projects to launch** — every project needing attention was already picked up by an event.

When the timer does catch something, it means:
- An event wasn't emitted (workflow bug)
- An event was emitted but the handler didn't subscribe to it (config bug)
- A human edited project.md directly (no event path — timer is the correct mechanism here)

### 3. Add handler health metrics

**`handler.project.timer-catches`** — count of projects launched by the timer scan that weren't already triggered by an event.

**`handler.project.event-triggers`** — count of projects launched in response to a bus event.

Together they produce an **event-driven ratio**:
```
ratio = event-triggers / (event-triggers + timer-catches)
```

| Ratio | Meaning |
|-------|---------|
| >95% | Events are working well. Timer is a healthy safety net. |
| 50-95% | Events cover most cases. Investigate what the timer is catching. |
| <50% | Events aren't working. Timer is doing the heavy lifting. Fix event subscriptions or emission. |

### What these metrics tell you

| Question | Metric |
|----------|--------|
| Are events healthy? | timer-catches near 0 |
| Are projects getting stuck? | High timer-catches means events aren't firing |
| Is the timer redundant? | If timer-catches stays 0 for weeks, lengthen the interval |
| How much work is event-driven? | event-driven ratio |

### Implementation

In the handler, track whether the current invocation was from a timer tick or a bus event.

**Note:** The handler signature today is `() => Promise<void>` — there's no trigger source argument. The cron system would need a small change to pass trigger context. Options:
- **Simple (no src/ change):** Count total handler invocations vs events received on the bus. If handler fires exceed events, the difference is timer-triggered.
- **Proper (src/ change):** Add trigger source to handler invocation — cron system sets a flag before calling the handler. ~5 LOC in cron.ts.

The `on` list fix and the concept of the metric are the core value. Trigger source tracking can come later.

```typescript
// On event-triggered invocation:
ctx.emit({ type: "metric", name: "handler.project.event-triggers", value: launchedCount });

// On timer-triggered invocation (only count projects the timer found that events missed):
ctx.emit({ type: "metric", name: "handler.project.timer-catches", value: launchedCount });
```

~10 LOC in the handler + cron.json fix.

### Note on `project.commented`

Human comments have no event path today — editing project.md doesn't emit anything. The timer is the correct detection mechanism for comments (mtime check). If comment latency matters, add CLI support: `may-agent --emit project.commented '{"project":"..."}'`. Low priority — 5-minute latency for comments is acceptable.

## Summary

| Change | LOC |
|--------|-----|
| Fix `on` list in cron.json | 3 |
| Track trigger source in handler | ~5 |
| Emit timer-catches / event-triggers metrics | ~5 |
| Total | ~13 |
