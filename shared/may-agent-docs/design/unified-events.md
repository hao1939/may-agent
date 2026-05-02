# Design: Unified Event Model

**Status**: approved
**Date**: 2026-04-29

## Problem

Domain events use `as any` to bypass the typed event bus. Two type systems coexist: typed `AgentEvent` union and untyped `DomainEvent` catch-all. This causes TS errors, duplication, and confusion.

## Fix

Add the missing event types to the typed union. Remove `DomainEvent`. Remove `as any`.

## Event Types

```typescript
// Add to SystemEvent union in event-bus.ts:
| { type: "handler.started"; handler: string; agent: string }
| { type: "handler.completed"; handler: string; agent: string; durationMs: number }
| { type: "handler.failed"; handler: string; agent: string; error: string; durationMs: number }
| { type: "project.iteration"; project: string; iteration: number }
| { type: "project.status_changed"; project: string; from: string; to: string }
| { type: "session.completed"; sessionId: string; agent: string }
| { type: "session.failed"; sessionId: string; agent: string; error?: string }
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

## Operational status (appendix, 2026-05-02 — added by arc)

This section reflects what the runtime actually emits and consumes, so
readers do not mistake the spec above for a live wiring diagram. Keep
this table in sync when the wiring changes; the spec is aspirational
when it disagrees with this table.

### Emitter reality (lifetime counts in `events` table, queried 2026-05-02 ~10:18Z)

| Event type | Lifetime emissions | Emitted by | Status |
|---|---|---|---|
| `handler.started` | 2624 | cron runner on every handler invocation | ✅ live |
| `handler.completed` | 2617 | cron runner at handler success | ✅ live, but see KE-454 (fires on workflow-failed sessions because `await` is missing — metric is decoupled from outcome) |
| `handler.failed` | 5 | cron runner at handler throw — almost never thrown because handler bodies catch internally | ⚠️ rarely emitted; do not use for failure detection |
| `project.iteration` | 1775 | both `project.ts` and `master-worker.ts`; payload shapes differ — see KE-468 | ⚠️ live but two incompatible shapes; aggregating by `projectId` undercounts ~2.5× |
| `session.failed` | 92 | session/runtime layer on session-end with error | ✅ live; payload `{sessionId, agent, error, task}` |
| `session.completed` | **1** (lifetime — single 2026-04-30 row) | not currently emitted by any runtime path; the one extant row is anomalous | ❌ aspirational |
| `project.status_changed` | **0** lifetime | no emitter exists | ❌ aspirational |

`sessions.status='done'` has 6300+ rows over the same window, so the
6300:1 ratio between session-end transitions and `session.completed`
events confirms there is no real emitter.

### Consumer reality (event-only handlers in `agents/may/cron.json`)

| Handler | Subscribes to | Lifetime invocations | Status |
|---|---|---|---|
| `session-recovery` | `session.failed` (live, 92×) | 0 | ❌ never wired — see KE-455 |
| `session-eval` | `session.completed` (1×) | 0 | ❌ never wired |
| `escalation` | `session.escalated` | 0 | ❌ source not emitted, handler not wired |
| `metric-alert-reactor` | `metric.breach` | 0 | ❌ source not emitted, handler not wired |
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
