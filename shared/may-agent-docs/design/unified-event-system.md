# Design: Unified Event System

**Status:** Phase 1 implemented  
**Date:** 2026-04-21  
**References:** [event-driven-handlers.md](event-driven-handlers.md), [unified-handler-events.md](unified-handler-events.md), [core-principles.md](core-principles.md)

## Problem

The system had three separate mechanisms for reacting to things that happen:

| # | Mechanism | Where | Example |
|---|-----------|-------|---------|
| 1 | **Handler `on` dispatch** | cron.json `on` → `dispatchEvent()` → handler fires | `metric.breach` → project handler |
| 2 | **Hardcoded `bus.subscribe()`** | ~200 lines of inline closures in may.ts | `session_end` → auto-resume, auto-eval, escalation |
| 3 | **Direct `ctx.notify()`** | Inside handler code, bypasses events entirely | `health-trend` regression → Telegram |

Mechanism 1 is the event system. Mechanisms 2 and 3 predated it and were never migrated.

## Two kinds of bus traffic

### Infrastructure plumbing (stay on bus, not for handlers)

Observation and command events for UI, DB persistence, and internal coordination:

- `text`, `tool_call`, `tool_result`, `turn_end` — session observation (UI/DB)
- `session_start`, `session_end` — DB persistence + lifecycle
- `log`, `info` — system logging
- `cancel`, `resume`, `fork`, `input`, `steer` — commands
- `notification` — output to Telegram
- `reload`, `restart`, `shutdown` — management

### Agent-level events (go through handler dispatch)

Things that happened that handlers react to:

| Event | Status |
|-------|--------|
| `metric.breach` | ✅ metrics-snapshot → project handler |
| `project.completed` | ✅ project workflow → project handler |
| `project.blocked` | ✅ project workflow → project handler |
| `heartbeat.trigger` | ✅ → all heartbeat entries |
| `session.failed` | ✅ translator → session-recovery handler |
| `session.completed` | ✅ translator → session-eval handler |
| `session.escalated` | ✅ translator → escalation handler |
| Health regression | ❌ direct `ctx.notify()` (Phase 2) |

## Principle

**The handler dispatch system IS the unified event system.** `cron.json` `on` field = subscription. `dispatchEvent()` = routing. `TriggerEvent` = payload. Handler = reaction.

### Two methods, two purposes

RuntimeCtx exposes two distinct emit methods:

```typescript
interface RuntimeCtx {
  /** Emit an infrastructure/workflow event on the bus. UI, DB, logging consume these. */
  emit(event: { type: string; [key: string]: unknown }): void;

  /** Dispatch an agent-level event to handlers subscribed via cron.json `on` field. */
  dispatchEvent(eventType: string, data?: Record<string, unknown>): void;
}
```

`dispatchEvent()` wraps the `{ type: "emit" }` bus envelope internally — callers don't need to know about it:

```typescript
// Infrastructure event (workflow step progress, metrics recording)
ctx.emit({ type: "step_start", step: "worker-iteration-3" });

// Agent event (triggers handler reactions)
ctx.dispatchEvent("metric.breach", { metricId, owner, current, threshold });
```

## What was done (Phase 1)

### Session lifecycle → agent events

Replaced ~170 lines of inline `bus.subscribe()` logic in may.ts with:

**Thin translator** (stays in may.ts, ~20 lines) — classifies `session_end` bus events into agent events:
- `session_end` with error → `session.failed`
- `session_end` with finishParams blocked/failure → `session.escalated`
- `session_end` with parentSessionId (non-evaluator) → `session.completed`

**Three handlers** (in `agents/may/handlers/`):
- `session-recovery.ts` — two-tier classification (digest → classifyError), auto-resume or escalate
- `session-eval.ts` — run heuristic evaluation, emit context-learn events
- `escalation.ts` — consult digest classifier, escalate to human or ignore

**cron.json entries** — event-only (no timer), subscribing via `on`:
```json
{ "name": "session-recovery", "handler": "session-recovery", "on": ["session.failed"] }
{ "name": "session-eval",     "handler": "session-eval",     "on": ["session.completed"] }
{ "name": "escalation",       "handler": "escalation",       "on": ["session.escalated"] }
```

### RuntimeCtx surface expanded

Added to RuntimeCtx so handlers don't import from src/lib directly:
- `classifyError()`, `getLastDigest()`, `upsertDigest()`, `classifyDigest()` — digest/error classification
- `escalate()` — writes escalations.jsonl + Telegram notification
- `readSessionMeta()` — session metadata lookup
- `dispatchEvent()` — clean API for agent events

### Orphaned events removed

`project.status-changed` (6 call sites) and `project.iteration` (1 call site) had zero subscribers. Removed from `agents/shared/workflows/project.ts`. Every event should have a handler.

### Call sites migrated to dispatchEvent

- `agents/shared/workflows/project.ts` — `ctx.dispatchEvent("project.completed", ...)`
- `agents/may/handlers/metrics-snapshot.ts` — `ctx.dispatchEvent("metric.breach", ...)`

## Remaining work

### Phase 2: Detection/reaction separation

1. `health-trend` handler: emit `metric.regression` event via `ctx.dispatchEvent()` instead of direct `ctx.notify()`
2. Create `metric-alert` handler subscribing to `metric.regression` + `metric.breach`
3. Audit other handlers that call `ctx.notify()` as a reaction to a condition

### Phase 3: Retire request tracking (~30 call sites)

The `requests` table is a hand-maintained state machine that duplicates the event stream:

| requests table | events equivalent |
|---------------|-------------------|
| `trackRequest(from, to, task)` → CREATED | `session_start` event |
| `updateRequest(id, IN_PROGRESS)` | `session_start` with sessionId |
| `updateRequest(id, COMPLETED)` | `session_end` with outcome |
| `updateRequest(id, FAILED)` | `session_end` with error |

Migration: replace 30+ `trackRequest()` call sites with event emissions, migrate Requests UI tab to query events table, deprecate `requests` table.

### Phase 4: Cleanup

1. Archive `event-driven-handlers.md` (superseded by this doc + unified-handler-events.md)
2. Count remaining `bus.subscribe()` in may.ts — target: only infra consumers + thin translator

## Architecture

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
                                   dispatchEvent()
                                          │
                                   ┌──────▼──────┐
                                   │ Cron dispatch│
                                   │ (cron.json)  │
                                   └──────┬──────┘
                                          │
                           ┌──────────────┼──────────────┐
                    ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
                    │  Handlers   │ │  Handlers  │ │  Handlers   │
                    │ (project)   │ │ (recovery) │ │ (escalation)│
                    └─────────────┘ └────────────┘ └─────────────┘
```

## Success criteria

1. ✅ `bus.subscribe()` in may.ts: only infra consumers + thin translator (was ~18, now ~14)
2. ✅ All session lifecycle reactions visible in cron.json `on` fields
3. ✅ Zero agent-level decisions in inline bus subscribers
4. ✅ Events table shows `session.failed`, `session.completed`, `session.escalated` — verifiable in Events tab
5. ✅ `dispatchEvent()` API — handlers/workflows use clean interface, no envelope trick
6. ⬜ Zero `trackRequest()` calls remain (Phase 3)
