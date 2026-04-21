# Design: Unified Event System

**Status:** Proposal  
**Date:** 2026-04-21  
**References:** [event-driven-handlers.md](event-driven-handlers.md), [unified-handler-events.md](unified-handler-events.md), [core-principles.md](core-principles.md)

## Problem

The system has three separate mechanisms for reacting to things that happen:

| # | Mechanism | Where | Example |
|---|-----------|-------|---------|
| 1 | **Handler `on` dispatch** | cron.json `on` → `dispatchEvent()` → handler fires | `metric.breach` → project handler |
| 2 | **Hardcoded `bus.subscribe()`** | ~200 lines of inline closures in may.ts | `session_end` → auto-resume, auto-eval, escalation |
| 3 | **Direct `ctx.notify()`** | Inside handler code, bypasses events entirely | `health-trend` regression → Telegram |

Mechanism 1 is the event system we designed. It works. But mechanisms 2 and 3 predate it and were never migrated. The result: agent-level decisions (should I resume this session? should I escalate? should I alert the human?) are scattered across infrastructure code instead of flowing through the event system.

## Two kinds of bus traffic

The EventBus carries two fundamentally different kinds of events:

### Infrastructure plumbing (stay on bus, not for handlers)

These are **observation and command** events. They exist for the UI, DB persistence, and internal coordination:

- `text`, `tool_call`, `tool_result`, `turn_end` — session observation (UI/DB)
- `session_start` — DB persistence trigger
- `log`, `info` — system logging
- `cancel`, `resume`, `fork`, `input`, `steer` — commands
- `notification` — output to Telegram
- `reload`, `restart`, `shutdown` — management

Handlers don't consume these. They're not "events" in the agent sense — they're infrastructure signals.

### Agent-level events (should ALL go through handler dispatch)

These represent **things that happened** that agents/handlers may need to react to:

| Event | Emitted today? | Handler subscribes? |
|-------|---------------|-------------------|
| `metric.breach` | ✅ via `{ type: "emit", event: "metric.breach" }` | ✅ project handler |
| `project.completed` | ✅ | ✅ project handler |
| `project.blocked` | ✅ | ✅ project handler |
| `heartbeat.trigger` | ✅ | ✅ all heartbeat entries |
| Session error → resume decision | ❌ hardcoded bus.subscribe() in may.ts | ❌ |
| Session end → eval decision | ❌ hardcoded bus.subscribe() in may.ts | ❌ |
| Session escalation → human alert | ❌ hardcoded bus.subscribe() in may.ts | ❌ |
| Health regression → alert | ❌ direct ctx.notify() | ❌ |

The bottom four are the problem. They're **agent-level decisions** stuck in infrastructure code.

## Principle

**The handler dispatch system IS the unified event system.** It already exists, already works, and already handles `metric.breach` / `project.*` / `heartbeat.trigger` correctly. The fix is migration, not invention.

Specifically:
- `cron.json` `on` field = event subscription
- `dispatchEvent()` = event routing
- `TriggerEvent` = event payload to handler
- Handler code = reaction logic

Everything agent-level should flow through this. Nothing else.

## Design

### Step 1: Session lifecycle → agent events

The existing bus subscribers in may.ts (~200 lines, starting ~line 361) read `session_end` events and make decisions inline. Instead, they should **translate** bus events into agent-level events and let handlers react.

**Current flow:**
```
session_end (bus) → inline subscriber → decides to resume/eval/escalate → acts directly
```

**Target flow:**
```
session_end (bus) → thin translator → emits agent event → handler dispatch → handler reacts
```

#### New agent events

| Event | Emitted when | Replaces |
|-------|-------------|----------|
| `session.failed` | Session ends with error, eligible for resume | Auto-resume logic in may.ts ~361 |
| `session.completed` | Session ends normally, needs evaluation | Auto-eval logic in may.ts ~427 |
| `session.escalated` | Session finish() includes escalation | Escalation logic in may.ts ~466 |

#### Translator (stays in may.ts, becomes thin)

The existing `bus.subscribe()` blocks shrink to event translators — they read `session_end` and emit the appropriate agent event. No decisions, no side effects, just classification:

```typescript
bus.subscribe((event) => {
  if (event.type !== "session_end") return;
  
  if (event.status === "error") {
    bus.emit({ type: "emit", event: "session.failed", data: { 
      sessionId: event.sessionId, agent: event.agent, error: event.error 
    }});
  } else if (event.finishParams?.escalate) {
    bus.emit({ type: "emit", event: "session.escalated", data: {
      sessionId: event.sessionId, agent: event.agent,
      reason: event.finishParams.escalate
    }});
  } else {
    bus.emit({ type: "emit", event: "session.completed", data: {
      sessionId: event.sessionId, agent: event.agent,
      outcome: event.outcome
    }});
  }
});
```

#### Handlers subscribe via cron.json

```json
{
  "name": "session-recovery",
  "handler": "session-recovery",
  "on": ["session.failed"],
  "enabled": true,
  "description": "Decide whether to auto-resume failed sessions."
}
```

```json
{
  "name": "session-eval",
  "handler": "session-eval",
  "on": ["session.completed"],
  "enabled": true,
  "description": "Trigger heuristic evaluation on completed sessions."
}
```

```json
{
  "name": "escalation",
  "handler": "escalation",
  "on": ["session.escalated"],
  "enabled": true,
  "description": "Route escalations to owner or human."
}
```

The handler logic is the same code that currently lives inline in may.ts — it just moves into handler modules where it's configurable, testable, and visible in cron.json.

### Step 2: Detection emits event, handler decides reaction

Today, `health-trend` detects a regression and calls `ctx.notify()` directly — the detection and the reaction are fused. Instead:

**Current:**
```
health-trend handler detects regression → ctx.notify("agent X dropped 20pp")
```

**Target:**
```
health-trend handler detects regression → ctx.emit({ type: "emit", event: "metric.regression", data: {...} })
metric-alert handler subscribes → decides to notify, nudge agent, or ignore
```

This separates **detection** from **reaction**. The health-trend handler's job is to detect. Another handler (or the owner's heartbeat) decides what to do about it.

The same applies to any handler that currently calls `ctx.notify()` as a reaction to a condition. `ctx.notify()` remains available as an **output action** — handlers call it when they've decided to alert the human. But the decision should come from a handler, not be baked into detection logic.

### Step 3: Informational events — persist only, no handler needed

Some events are purely informational audit trail:

- `project.status-changed` — emitted 6× per project run
- `project.iteration` — emitted every loop

These are persisted to the events table by DbWriter. No handler needs to subscribe. They're not "orphaned" — they're audit data. This is fine. Not every event needs a handler. The distinction:

- **Actionable events** → need a handler (or owner fallback)
- **Informational events** → persisted to DB, visible in dashboards/heartbeat context

### Step 3: Remove unhandled events (done)

`project.status-changed` (emitted 6×) and `project.iteration` (emitted every loop) had zero subscribers. Removed from `agents/shared/workflows/project.ts`. Events that nobody handles shouldn't be emitted — every event should have a handler.

Kept: `project.completed` and `project.blocked` (project handler subscribes via `on`).

### Non-goal: handler dispatch for infrastructure events

`session_start`, `text`, `tool_call`, etc. stay as bus-level plumbing. They're consumed by:
- DbWriter (persistence)
- Web UI (live streaming)
- ChatSession (user-facing output)

These are **not** agent events. They don't go through `dispatchEvent()`. The bus remains the transport layer; handler dispatch is the agent reaction layer.

## Migration plan

### Phase 1: Session lifecycle events (high impact, ~150 LOC moved)

1. Create three handlers: `session-recovery`, `session-eval`, `escalation`
2. Move logic from may.ts inline subscribers into handlers
3. Replace inline subscribers with thin translators (emit agent events)
4. Add cron.json entries with `on` subscriptions
5. Delete the inline logic from may.ts

**Validation:** Same behavior, but now visible in cron.json and testable as handler modules.

### Phase 2: Detection/reaction separation (medium impact)

1. `health-trend` handler: emit `metric.regression` event instead of direct `ctx.notify()`
2. Create `metric-alert` handler subscribing to `metric.regression` + `metric.breach`
3. Other handlers that call `ctx.notify()` as a reaction: audit and migrate as needed

### Phase 3: Cleanup

1. Archive `event-driven-handlers.md` (superseded by this doc + unified-handler-events.md)
2. Update event table in `event-driven-handlers.md` (remove stale entries like `project.commented`)
3. Count remaining `bus.subscribe()` in may.ts — target should be only infrastructure consumers (DB writer, UI streaming, command routing)

## After migration

```
                    ┌─────────────────────────────────────────┐
                    │              EventBus                     │
                    │  (transport layer — all events flow here)│
                    └──────┬──────────────┬───────────────┬────┘
                           │              │               │
                    ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
                    │ Infra subs  │ │ Translator │ │  DbWriter   │
                    │ (UI, cmd)   │ │ (classify) │ │ (persist)   │
                    └─────────────┘ └─────┬──────┘ └─────────────┘
                                          │
                                   emit agent events
                                          │
                                   ┌──────▼──────┐
                                   │ dispatchEvent│
                                   │ (cron.json)  │
                                   └──────┬──────┘
                                          │
                           ┌──────────────┼──────────────┐
                    ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
                    │  Handlers   │ │  Handlers  │ │  Handlers   │
                    │ (project)   │ │ (recovery) │ │ (escalation)│
                    └─────────────┘ └────────────┘ └─────────────┘
```

**Bus** = transport. **Translators** = classify infra events into agent events. **dispatchEvent** = route agent events to handlers. **Handlers** = react.

## Files affected

| File | Change | Phase |
|------|--------|-------|
| `src/app/may.ts` | Inline subscribers → thin translators | 1 |
| `agents/may/handlers/session-recovery.ts` | New handler (moved from may.ts) | 1 |
| `agents/may/handlers/session-eval.ts` | New handler (moved from may.ts) | 1 |
| `agents/may/handlers/escalation.ts` | New handler (moved from may.ts) | 1 |
| `agents/may/cron.json` | Add 3 new entries with `on` subscriptions | 1 |
| `agents/may/handlers/health-trend.ts` | Emit event instead of direct notify | 2 |
| `agents/may/handlers/metric-alert.ts` | New handler for metric reactions | 2 |
| Design docs | Archive event-driven-handlers.md, update INDEX | 3 |

## Success criteria

1. `bus.subscribe()` in may.ts contains only: infra consumers (DbWriter, UI, command router) + thin translators (classify → emit)
2. All agent-level event reactions are visible in cron.json `on` fields
3. Zero agent-level decisions in inline bus subscribers
4. `grep -c 'bus.subscribe' src/app/may.ts` drops from ~10 to ~4-5
