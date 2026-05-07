# Design: Unified Event Model

**Status**: shipped
**Date**: 2026-04-29

## Problem

Domain events use `as any` to bypass the typed event bus. Two type systems coexist: typed `AgentEvent` union and untyped `DomainEvent` catch-all. This causes TS errors, duplication, and confusion.

## Fix

Add the missing event types to the typed union. Remove `DomainEvent`. Remove `as any`.

## Event Types

```typescript
// Current SystemEvent union in event-bus.ts:
| { type: "handler.started"; handler: string; agent: string }
| { type: "handler.completed"; handler: string; agent: string; durationMs: number }
| { type: "handler.failed"; handler: string; agent: string; error: string; durationMs: number }
| { type: "project.iteration"; project: string; iteration: number }
| { type: "project.status_changed"; project: string; from: string; to: string }
| { type: "session.start"; sessionId: string; agent: string; task: string; kind?: string; parentSessionId?: string }
| { type: "session.end"; sessionId: string; agent: string; status: string; summary?: string }
```

## Tables

| Table | What | Updated by |
|-------|------|------------|
| **events** | Append-only log of everything | DbWriter: `INSERT` for all events |
| **sessions** | Session details (fast lookups) | DbWriter: on `session_start`/`session_end` |
| **projects** | Project state cache | Project handler: on scan |

## Changes

1. Add handler/project/session event types to `SystemEvent` in `event-bus.ts`
2. Remove `DomainEvent` interface (already done)
3. Remove `as any` from cron.ts emitters
4. DbWriter: persist ALL bus events to events table (one `INSERT`)

---

## Operational status (appendix, 2026-05-02 — added by arc; refreshed 2026-05-07)

This section reflects what the runtime actually emits and consumes, so
readers do not mistake the spec above for a live wiring diagram. Keep
this table in sync when the wiring changes; the spec is aspirational
when it disagrees with this table.

### Emitter reality (query `SELECT event_type, COUNT(*) FROM events GROUP BY event_type` for current numbers)

| Event type | Emitted by | Status |
|---|---|---|
| `handler.started` | cron runner on every handler invocation | ✅ live |
| `handler.completed` | cron runner at handler success | ✅ live |
| `handler.failed` | cron runner at handler throw — rarely thrown because handler bodies catch internally | ⚠️ rarely emitted |
| `project.iteration` | both `project.ts` and `master-worker.ts`; payload shapes differ | ⚠️ live but two incompatible shapes |
| `session.failed` | session/runtime layer on session-end with error | ✅ live |
| `session.completed` | not currently emitted by any runtime path | ❌ aspirational |
| `project.status_changed` | no emitter exists | ❌ aspirational |
| `metric.breach` | `metrics-snapshot.ts` when `breached && !openAlert` | ⚠️ live; see consumer status below |
| `metric.stalled` | `metrics-snapshot.ts` on `stall_after_ms` window | ⚠️ live but no dedicated subscriber |
| `metric.recovered` | `metrics-snapshot.ts` when metric recovers from breach | ✅ live |
| `message.created` | message-bus emitter on agent-to-agent message create | ✅ live, low volume |

Note: `session.completed` has no real emitter — session lifecycle produces `session.end` events, not `session.completed`. `project.status_changed` likewise has no emitter.

### Consumer reality (event-only handlers in `agents/may/cron.json`)

| Handler | Subscribes to | Lifetime invocations | Status |
|---|---|---|---|
| `session-recovery` | `session.failed` (live, 102×) | 0 | ❌ never wired — see KE-455 |
| `session-eval` | `session.completed` (1×) | 0 | ❌ never wired |
| `escalation` | `session.escalated` | 0 | ❌ source not emitted, handler not wired |
| `metric-alert-reactor` | `metric.breach` (live, 62×) | 0 | ❌ **source emits 18/day, handler still dormant** — KE-731 (wedge), KE-732 (doc dual), KE-776 (dedup eats every breach). 62 pending breach events orphaned. |
| (no handler) | `metric.stalled` (live, 61×) | n/a | ❌ **no handler exists** — KE-781. Stall signal reaches may only via `loadInbox()`, gets dismissed as noise (KE-772). Companion proposal: `agents/arc/workspace/proposals/2026-05-07-subscribe-metric-stalled-events.md`. |
| `context-learn` | `context-learn` | 0 | ❌ replaced de facto by timer-driven `context-learn-poller` |

Two timer-driven handlers (`eval-poller`, `context-learn-poller`)
explicitly call themselves bandaids for the broken event-only chain in
their file headers. Until the cron-runner-to-bus binding is fixed,
**`on:`-only handlers in `cron.json` are decorative — they will not
fire even when their source event is emitted.**

### When extending this design

Before adding a new `on:`-only handler:

1. Confirm the source event is emitted (query `events` table for ≥1
   row in the last 7 days).
2. Add a timer-driven fallback OR confirm the cron-runner-to-bus
   binding has been fixed (check that an existing event-only handler
   has non-zero `handler.started` rows since the fix landed).

Before adding a new event type to the `SystemEvent` union:

1. Identify the emitter site in code, not just in this spec. A type
   added here without an emitter is the failure mode that produced
   `session.completed` and `project.status_changed` above.

### See also

- KE-454 — `handler.completed` fires on failed sessions
- KE-455 — every event-only handler has fired zero times
- KE-468 — `project.iteration` has two incompatible payload shapes
- `agents/arc/workspace/proposals/2026-05-01-fix-event-only-handler-subscriptions.md`
