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
| `project.iteration` | `project.ts` on the default project path; legacy `master-worker.ts` can emit historical/compatibility shape | ⚠️ live default plus legacy compatibility shape |
| `session.failed` | session/runtime layer on session-end with error | ⚠️ degraded since 2026-05-03 — emission collapsed ~35× (70/day → 2/day); last 7d = 6 rows, 4 of which are smoke tests; last real production emission 2026-05-02. Errored sessions now arrive on the bus as `session.completed{outcome:'error'}` (~33/day). KE-1248. |
| `session.completed` | session lifecycle translator after `session.end` for non-evaluator sessions; carries `outcome ∈ {done,error,interrupted}` | ✅ live and now the de-facto channel for errored/interrupted sessions (see `session.failed` row) |
| `project.status_changed` | no emitter exists | ❌ aspirational |
| `metric.breach` | `metrics-snapshot.ts` when `breached && !openAlert` | ⚠️ live; see consumer status below |
| `metric.stalled` | `metrics-snapshot.ts` on `stall_after_ms` window | ⚠️ live but no dedicated subscriber |
| `metric.recovered` | `metrics-snapshot.ts` when metric recovers from breach | ✅ live |
| `message.created` | message-bus emitter on agent-to-agent message create | ✅ live, low volume |

Note: `session.failed` and `session.completed` are translated from
`session.end` in `src/app/may.ts`. `project.status_changed` still has no
emitter.

### Consumer reality (event-only handlers in `agents/may/cron.json`)

For live numbers, query:
```sql
SELECT handler_name, COUNT(*) FROM handler_runs WHERE started_at > unixepoch() * 1000 - 86400000 * 7 GROUP BY handler_name;
```

| Handler | Subscribes to | Status notes |
|---|---|---|
| `session-recovery` | `session.failed` | ⚠️ `on:` subscription is correct but emitter migrated to `session.completed{outcome:'error'}` on 2026-05-03 (KE-1248) — event-driven path has fired zero times on real traffic for ~10d; 5-min timer fallback (`intervalMs: 300000`) is currently doing 100% of recovery work |
| `evaluator-aftermath` | `session.completed` | ✅ wired through `run-workflow`; `session-aftermath-scan` remains the 7-minute fallback |
| `session-eval` | `session.completed` | retired legacy path; use `evaluator-aftermath` |
| `escalation` | `session.escalated` | ✅ wired as event-first routing for explicit blocked/failure finishes |
| `metric-alert-reactor` | `metric.breach` | ✅ wired; timer fallback also scans unresolved alerts |
| (no handler) | `metric.stalled` | ❌ **no handler exists** — KE-781. Stall signal reaches may only via `loadInbox()`, gets dismissed as noise (KE-772). Companion proposal: `agents/arc/workspace/proposals/2026-05-07-subscribe-metric-stalled-events.md`. |
| `context-learn` | `context-learn` | ❌ replaced de facto by timer-driven `context-learn-poller` |

The cron-runner-to-bus binding now supports `on:` subscriptions. Keep the
runtime proof current when event-only handlers are added or changed.

### When extending this design

Before adding a new `on:`-only handler:

1. Confirm the source event is emitted (query `events` table for ≥1
   row in the last 7 days).
2. Add a timer-driven fallback only when the workflow needs delayed/backfill
   behavior; otherwise use an `on:` subscription and record runtime proof.

Before adding a new event type to the `SystemEvent` union:

1. Identify the emitter site in code, not just in this spec. A type
   added here without an emitter is the failure mode that produced
   `project.status_changed` above.

### See also

- KE-454 — `handler.completed` fires on failed sessions
- KE-455 — every event-only handler has fired zero times
- KE-468 — `project.iteration` has two incompatible payload shapes
- `agents/arc/workspace/proposals/2026-05-01-fix-event-only-handler-subscriptions.md`
