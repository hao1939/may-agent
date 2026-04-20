# Design: Ownership-Driven System

## Core Principle

Everything has an owner. The owner is an agent. The owner is accountable.

## Four Rules

### 1. When something happens, emit an event

Events are how the system communicates. Not file writes, not polling, not direct calls. When something happens — emit an event. The event system routes it to whoever should handle it.

```
Metric breaches     → emit metric.breach
Project commented   → emit project.commented
Session errors      → emit session.error
Workflow completes  → emit workflow.done
Agent finds issue   → emit <agent>.finding
Handler fails       → emit handler.error
```

This is the single integration point. Everything flows through events.

### 2. Metrics and events have owner and source

Every metric declares an owner — the agent accountable for it.
Every event carries a source — where it came from.

```
metric:
  id: coder.quality
  owner: coach          ← accountable agent
  threshold: 0.7

event:
  type: metric.breach
  source: metrics-snapshot    ← what emitted it
  owner: coach               ← inherited from metric owner
  data: { metric: coder.quality, value: 0.65 }
```

Naming convention determines default ownership:
- `<agent>.*` → that agent owns it (e.g., `coach.skill-effectiveness` → coach)
- `system.*` → may owns it (supervisor)
- `project.*` → project owner from project.md

### 3. Owner is an agent

Not a system, not a handler, not "infra." An agent who can:
- Observe (read metrics, check status)
- Judge (is this a problem? what should I do?)
- Act (investigate, fix, escalate, delegate)
- Be held accountable (did you handle this?)

### 4. Events must be handled. No handler → owner handles.

When an event fires:

```
Event fires
  ↓
Registered handler exists? → Handler runs (e.g., metrics-snapshot handles metric.breach)
  ↓ no
Owner agent gets forked with: "Event X happened. You own this. Investigate and act."
  ↓
Agent acts or escalates
```

Nothing falls through the cracks. Every event reaches someone who can act.

## How It Connects Everything

### Metrics → Events → Handlers → Agents

```
metrics-snapshot measures coder.quality
  → value 0.65 < threshold 0.7
  → emits event: metric.breach { metric: coder.quality, owner: coach }
  → handler registered for metric.breach? YES → metrics-snapshot auto-forks coach
  → coach gets: "[metric-alert] coder.quality breached (0.65 < 0.7). Investigate and fix."
```

### Projects → Events → Workflows → Agents

```
Human adds comment to project.md
  → project-resume detects mtime change
  → emits event: project.commented { project: agents/bob/..., owner: bob }
  → handler registered? YES → project-resume runs persistent-task workflow
  → workflow processes comment, reviewer guides worker
```

### Unhandled Events → Owner Fallback

```
New event type: scout.paper-relevant { paper: "...", owner: scout }
  → No handler registered for scout.paper-relevant
  → Fallback: fork scout with "Event scout.paper-relevant fired. You own this. Data: ..."
  → Scout decides what to do in a freestyle session
```

### Handler Failures → Owner Notification

```
metrics-snapshot handler fails (error)
  → Handler owner: may
  → May gets: "Handler metrics-snapshot failed: <error>. You own this handler."
```

## Ownership Map

### Metrics ownership (from metric definitions)

| Pattern | Owner | Responsibility |
|---------|-------|---------------|
| `coder.*` | coach | Code quality, coder training |
| `coach.*` | coach | Training effectiveness |
| `scout.*` | scout | Research coverage, findings |
| `tech-lead.*` | tech-lead | Build health, code changes |
| `optimizer.*` | optimizer | Efficiency, workflow coverage |
| `evaluator.*` | evaluator | Evaluation coverage |
| `qa.*` | qa | Review coverage |
| `bob.*` | bob | Experiments, hypotheses |
| `system.*` | may | System health, throughput |
| `project.*` | may | Project tracking |
| `workflow.*` | may | Workflow health |

### Handler ownership

| Handler | Owner | Why |
|---------|-------|-----|
| metrics-snapshot | may | System-wide measurement |
| project-resume | may | Project lifecycle |
| watchdog | may | System health |
| standing-orders-check | may | Compliance |
| agents-auto-commit | may | Infrastructure |

### Project ownership

From `**Owner**` field in project.md. Clear, explicit, no ambiguity.

## What Changes

### In metrics table
Already has `owner` field. ✅ No change needed.

### In event system
Events need an `owner` field. When dispatching:
1. Check for registered handlers (`on` field in cron.json)
2. If no handler → fork the owner agent with the event data

**Implementation**: Add fallback fork in `Cron.dispatchEvent()`:
```typescript
dispatchEvent(eventType: string, data?: Record<string, unknown>): number {
  const subscribers = this.eventSubscriptions.get(eventType);
  if (subscribers?.size) {
    // Existing: trigger registered handlers
    for (const entryName of subscribers) { ... }
    return triggered;
  }
  // NEW: no handler registered → fork the owner
  const owner = data?.owner as string;
  if (owner) {
    manager.run(owner, `[event] ${eventType}: ${JSON.stringify(data)}`);
    return 1;
  }
  return 0;
}
```

### In cron entries
Add `owner` field to handler definitions:
```json
{
  "name": "metrics-snapshot",
  "handler": "metrics-snapshot",
  "owner": "may",
  "intervalMs": 3600000
}
```

If handler fails → notify owner.

### In heartbeats
Agents already check their metrics. With clear ownership, the heartbeat naturally covers:
- My metrics → am I breaching?
- My projects → any paused with conditions met?
- My events → anything unhandled?

## The Closed Loop

```
Something happens
  → Event fires (with source + owner)
  → Handler exists? → Handler runs
  → No handler? → Owner agent forked
  → Agent acts (or escalates via chain: agent → May → Hao)
  → Result captured (metric changes, project updates, session outcome)
  → Nothing falls through
```

This is the self-driving system: metrics signal, events trigger, handlers execute, agents own outcomes. Every piece has an accountable agent. Every signal reaches someone who can act.
