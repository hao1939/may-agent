# Design: Event-Driven Handler System

## Core Idea

Handlers are functions. Events trigger them. A timer is one kind of event.

Today: cron entries = handler + timer. Everything polls.
After: handler registrations = handler + triggers (timer, event, or both).

## Event Model

An event is a named signal with optional data:

```typescript
interface SystemEvent {
  type: string;        // dot-notation: "project.commented", "metric.breach"
  data?: Record<string, unknown>;  // optional payload
  timestamp: number;
}
```

Events are fire-and-forget. No acknowledgment, no return value. Handlers decide what to do.

## Handler Triggers

A cron.json entry gains an optional `on` field — event types that trigger the handler:

```json
{
  "name": "project-resume",
  "handler": "project-resume",
  "intervalMs": 300000,
  "on": ["project.commented", "workflow.blocked"],
  "enabled": true
}
```

This handler runs:
- Every 5 minutes (timer)
- Immediately when `project.commented` fires
- Immediately when `workflow.blocked` fires

Timer-only (backward compatible — no `on` field):
```json
{
  "name": "watchdog",
  "handler": "watchdog",
  "intervalMs": 600000
}
```

Event-only (no timer):
```json
{
  "name": "metric-alert",
  "handler": "metric-alert",
  "on": ["metric.breach"]
}
```

## Event Types

Starting set — expand as needed:

| Event | Emitted by | Payload | Typical consumer |
|-------|-----------|---------|-----------------|
| `project.commented` | CLI/socket (human) | `{ project: string }` | project-resume |
| `project.changed` | persistent-task workflow | `{ project: string, status: string }` | project-resume |
| `metric.breach` | metrics-snapshot handler | `{ metric: string, value: number, threshold: number, owner: string }` | metric-alert handler |
| `workflow.done` | persistent-task workflow | `{ project: string, iterations: number }` | project-resume |
| `workflow.blocked` | persistent-task workflow | `{ project: string, reason: string }` | project-resume |
| `session.error` | manager | `{ sessionId: string, agent: string, error: string }` | error-scan |

Naming convention: `<domain>.<action>` — matches metric naming.

## Emitting Events

### From handlers (internal):
```typescript
ctx.emit("project.commented", { project: "agents/bob/..." });
```

### From workflows:
```typescript
ctx.emit({ type: "project.changed", data: { project: path, status: "active" } });
```

Already exists — `WorkflowContext.emit()` takes a `WorkflowEvent`. Extend to support system events.

### From CLI (external):
```bash
may-agent --emit project.commented '{"project":"agents/bob/workspace/projects/context-learning"}'
```

### From socket (external):
```json
{"type": "emit", "event": "project.commented", "data": {"project": "agents/bob/..."}}
```

## Implementation

### 1. Event dispatcher (new, ~40 lines)

```typescript
// src/lib/event-dispatcher.ts
class EventDispatcher {
  private subscriptions: Map<string, Array<() => Promise<void>>> = new Map();

  subscribe(eventType: string, handler: () => Promise<void>): void {
    const list = this.subscriptions.get(eventType) || [];
    list.push(handler);
    this.subscriptions.set(eventType, list);
  }

  async dispatch(event: SystemEvent): Promise<void> {
    const handlers = this.subscriptions.get(event.type) || [];
    // Run all matching handlers (don't await — fire and forget)
    for (const handler of handlers) {
      handler().catch(err => log("error", `Event handler error: ${err}`));
    }
  }
}
```

### 2. Cron system changes (~20 lines)

When loading cron entries, for each entry with `on` field:
```typescript
for (const eventType of entry.on) {
  dispatcher.subscribe(eventType, () => runHandler(entry));
}
```

The handler function is the same one the timer calls. No new code for the handler itself.

### 3. Socket command (~10 lines)

Add to socket command handler:
```typescript
case "emit":
  dispatcher.dispatch({ type: cmd.event, data: cmd.data, timestamp: Date.now() });
  break;
```

### 4. CLI flag (~10 lines)

```bash
may-agent --emit <event-type> [json-data]
```

Sends `{"type":"emit","event":"...","data":{...}}` via socket.

### 5. HandlerContext.emit() (~5 lines)

Add to HandlerContext interface:
```typescript
emit(eventType: string, data?: Record<string, unknown>): void;
```

Calls `dispatcher.dispatch()`.

### 6. Workflow event bridge (~5 lines)

When WorkflowContext emits events, bridge system events to the dispatcher.

## Total: ~90 lines of src/ changes

## Backward Compatibility

- Entries without `on` field work exactly as before (timer only)
- Entries with `on` field get event triggers in addition to timer
- Existing `intervalMs` behavior unchanged
- No changes needed to existing handlers

## Dedup / Rate Limiting

If the same event fires rapidly (e.g., multiple file changes), the handler shouldn't run 10 times in 1 second. Simple dedup:

```typescript
// Per handler: skip if last run was < 5s ago
const lastRun = lastRunTimes.get(entry.name) || 0;
if (Date.now() - lastRun < 5000) return;
```

## How This Changes Our System

### Before (poll-based):
```
Human adds comment → waits 5 min → handler scans → finds change → runs workflow
```

### After (event-based):
```
Human adds comment → emits project.commented → handler fires immediately → runs workflow
```

### Before (metric alert):
```
Metric breaches → logged to DB → nobody sees for 30-60 min → maybe agent notices in heartbeat
```

### After:
```
Metric breaches → emits metric.breach → alert handler fires → forks owner with task
```

## Migration Path

1. Implement event dispatcher + socket command + CLI flag
2. Add `on` fields to key cron entries (project-resume, metric alerts)
3. Emit events from persistent-task workflow (project.changed, workflow.done/blocked)
4. Emit events from metrics-snapshot (metric.breach)
5. Eventually: heartbeat timers become just another event trigger, not special
