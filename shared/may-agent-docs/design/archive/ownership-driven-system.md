# Design: Ownership-Driven System

## Three Rules

### 1. Everything is an event

When something happens — metric breaches, project changes, session fails, agent finds something — emit an event. Events are how the system communicates. Not file writes. Not polling. Not direct calls. Emit an event, and the system routes it.

### 2. Everything has an owner

Every metric, event, handler, and project has an owner. The owner is an agent — not a system, not "infra." An agent who can observe, judge, act, and be held accountable.

Ownership follows naming convention:
- `coach.skill-effectiveness` → coach owns it
- `system.handler-health` → may owns it (supervisor)
- Project `**Owner**: bob` → bob owns it

### 3. Events must be handled

An event cannot fire and disappear. When an event fires:
1. Registered handler? → Handler runs.
2. No handler? → Owner agent gets forked with the event.
3. Owner can't handle it? → Escalation chain (agent → May → Hao).

Nothing falls through the cracks.

## The Closed Loop

```
Something happens
  → Event fires (with source + owner)
  → Handler runs, or owner gets forked
  → Agent acts, or escalates
  → Result captured (metric, project update, session)
  → Nothing falls through
```

## How It Connects

### Metrics → Events → Agents

```
metrics-snapshot measures coder.quality → 0.65 < threshold 0.7
  → emits metric.breach { owner: coach }
  → handler auto-forks coach
  → coach investigates and fixes
```

### Projects → Events → Workflows

```
Human comments on project.md
  → project-resume detects change
  → runs persistent-task workflow
  → comment iteration processes feedback
```

### Unhandled Events → Owner Fallback

```
scout.paper-relevant fires → no handler registered
  → scout gets forked: "You own this event. Act on it."
```

### Handler Failure → Owner Notification

```
metrics-snapshot fails → may owns the handler
  → may gets: "Your handler failed. Fix it."
```

## Ownership Map

| Pattern | Owner | Responsibility |
|---------|-------|---------------|
| `coder.*` | coach | Code quality |
| `coach.*` | coach | Training |
| `scout.*` | scout | Research |
| `tech-lead.*` | tech-lead | Code health |
| `optimizer.*` | optimizer | Efficiency |
| `evaluator.*` | evaluator | Evaluation |
| `qa.*` | qa | Review quality |
| `bob.*` | bob | Architecture, experiments |
| `system.*` | may | System health |
| `project.*` | may | Project lifecycle |
| Handlers | may | Infrastructure |
| Projects | `**Owner**` field | Explicit |

## Implementation

### Event dispatch with owner fallback

```typescript
dispatchEvent(eventType: string, data?: Record<string, unknown>): number {
  // 1. Try registered handlers
  const subscribers = this.eventSubscriptions.get(eventType);
  if (subscribers?.size) {
    for (const entryName of subscribers) {
      this.triggerNow(entryName, { force: true });
    }
    return subscribers.size;
  }
  // 2. No handler → fork the owner
  const owner = data?.owner as string;
  if (owner) {
    manager.run(owner, `[event] ${eventType}: ${JSON.stringify(data)}`);
    return 1;
  }
  return 0;
}
```

### Cron entries gain `owner` field

```json
{
  "name": "metrics-snapshot",
  "handler": "metrics-snapshot",
  "owner": "may",
  "intervalMs": 3600000,
  "on": ["metric.breach"]
}
```

Handler fails → owner notified.

### Common-sense alignment

These rules map to existing thinking principles:
- "Event-driven" → Rule 1 (everything is an event)
- "Metric-oriented" → Rule 2 (metrics have owners who are accountable)
- Heartbeat autonomy → Rule 2+3 (owner observes, judges, acts — during heartbeat or via event)
