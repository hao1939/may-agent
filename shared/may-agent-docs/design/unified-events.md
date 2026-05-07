# Design: Unified Event Model

**Status**: approved
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

### Emitter reality (lifetime counts in `events` table, queried 2026-05-07 ~02:48Z)

| Event type | Lifetime emissions | Emitted by | Status |
|---|---|---|---|
| `handler.started` | 6706 | cron runner on every handler invocation | ✅ live |
| `handler.completed` | 6694 | cron runner at handler success | ✅ live, but see KE-454 (fires on workflow-failed sessions because `await` is missing — metric is decoupled from outcome) |
| `handler.failed` | 8 | cron runner at handler throw — almost never thrown because handler bodies catch internally | ⚠️ rarely emitted; do not use for failure detection |
| `project.iteration` | 1913 (last 7d: 1547) | both `project.ts` and `master-worker.ts`; payload shapes differ — see KE-468 | ⚠️ live but two incompatible shapes (lifetime: 1778 `{project,iteration}` vs 135 `{projectId}`, ~13:1 split); aggregating by `projectId` undercounts ~14× |
| `session.failed` | 102 | session/runtime layer on session-end with error | ✅ live; payload `{sessionId, agent, error, task}` |
| `session.completed` | **1** (lifetime — single 2026-04-30 row) | not currently emitted by any runtime path; the one extant row is anomalous | ❌ aspirational |
| `project.status_changed` | **0** lifetime | no emitter exists | ❌ aspirational |
| `metric.breach` | 62 (first row 2026-05-03 21:47Z) | `agents/may/handlers/metrics-snapshot.ts:266` when `breached && !openAlert`; `alert_type` is hardcoded `'threshold'` regardless of mode (KE-775) | ⚠️ live; nominal consumer (`metric-alert-reactor`) wedged dormant by KE-455-class issue + KE-776 dedup-eats-everything bug. All 62 rows `status='pending'`, `handled_by=NULL`. Many fire from rate-mode noise on rolling-window counters (KE-774) and carry the lying breach message (KE-765). |
| `metric.stalled` | 61 (first row 2026-05-06 19:19Z, all `project.iterations-24h`) | `agents/may/handlers/metrics-snapshot.ts:398` on `stall_after_ms` window | ⚠️ live but **zero subscribers ever** — KE-781. Surfaces only via `loadInbox()` → may's heartbeat preamble, where it is dismissed alongside the lying breach noise (KE-772). The stall message ("stalled: no change for 120min") is the only correctly-worded breach signal for windowed-counter metrics; do not delete the stall arm when fixing rate-mode (proposal `2026-05-06-drop-rate-mode-from-windowed-counter-metrics.md` carries this guard since 2026-05-07). |
| `message.created` | 13 (first row 2026-05-06 11:52Z) | message-bus emitter on agent-to-agent message create | ✅ live, low volume; consumer wiring not yet audited here |

`sessions.status='done'` has 6300+ rows over the same window, so the
6300:1 ratio between session-end transitions and `session.completed`
events confirms there is no real emitter.

**`metric.breach` is no longer "the new arrival."** Between 2026-05-04
(6 lifetime) and 2026-05-07 (62 lifetime), emission has stabilized at
~18/day. The wedge is structural, not transient: every row sits at
`status='pending'`, `handled_by=NULL`. The dormant-consumer story is
unchanged from 2026-05-04; what *has* changed is that the emitter is
now noisy enough (rate-mode alerts on rolling counters, KE-774) that
the breach signal would be untrustworthy even if a consumer woke up.
Fix the emitter (KE-774, KE-765, KE-775) before fixing the consumer.

**`metric.stalled` is the new arrival.** First row 2026-05-06 19:19Z;
emits one row per `metrics-snapshot` cron tick (~5 min) per stalled
metric. Currently only `project.iterations-24h` triggers it, because
the other two windowed-counter metrics (`handler.completed-count`,
`system.real-output-24h`) churn on every cron cycle. Consumer side:
**no handler subscribes**; the events accumulate forever (no reaper).
This is the same dispatch-without-handler pattern as `metric.breach`,
but worse: at least breach has a *named* (dormant) consumer in
`cron.json`. Stall has none.

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
