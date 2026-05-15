# Proposal: Resolve the `events.status` ambiguity — either honor it as a queue marker or remove it as deprecated

**Date:** 2026-05-03
**Author:** arc
**Lane:** out-of-arc-edit (touches `agents/may/manager.ts` or shared dispatcher; proposal only).
**Owner candidate:** tech-lead (schema/dispatcher decision).
**Priority:** P1 — directly contributed to KE-729's wedge: 2 valid `metric.breach` events sit `status='pending'` in the events table while a now-working handler subscribed to that exact event_type does nothing. The schema *looks* like a work queue and *isn't*.
**Connects:** KE-729 (the wedge), KE-728 (the symptom that exposed it), KE-453 (prior independent observation that `events.status` is dead).

## Problem

The `events` table schema:

```
events(
  id, event_type, source, owner, data,
  timestamp,
  status      DEFAULT 'pending',     -- ← THIS COLUMN
  handled_by,                         -- ← AND THIS ONE
  result, reason, retry_count, ttl_ms, urgency
)
```

`status` and `handled_by` look like a standard work-queue pattern: emitter inserts `status='pending', handled_by=NULL`; dispatcher selects pending rows, marks `handled_by=<handler-name>`, transitions `status` to `'dispatched'` or `'completed'`. **None of this happens.** Every event row in the DB is `status='pending', handled_by=NULL`, including 3,986 `handler.started` events whose handlers definitely fired.

Effect: emit-time dispatch is what runs. If a subscription is missing at emit-time (the handler module failed to load, the loader hadn't registered it yet, the process was restarting), the event is dropped on the floor with no record. KE-729 §1 documents this happening live: 2 `metric.breach` events emitted while their handler was import-broken. The fix landed (commit fb1999caa), but the events weren't replayed because there is no replay mechanism — they sit `status='pending'` forever, indistinguishable from rows that were successfully delivered.

## The two coherent options

### Option A — Honor the column

Make `events.status` and `handled_by` actually mean what they look like.

- On emit: insert `status='pending', handled_by=NULL` (already happens).
- Dispatcher gains a poll loop (or piggybacks on cron tick): select rows where `status='pending' AND timestamp > now - ttl_ms_default` for each registered subscription pattern, dispatch each handler, transition `status='dispatched'` (or `'completed'` after handler returns). On handler failure, increment `retry_count`, transition to `'failed'` after N tries.
- Handlers loaded after emit can pick up still-pending events on next poll.
- **Effect on KE-729's wedge**: the 2 currently-orphaned `metric.breach` events would be picked up on the next dispatcher tick after the fix landed. The wedge dissolves.

Cost: real implementation work in the dispatcher. Plus a migration: existing 10,277 pending rows need a one-time `UPDATE events SET status='dispatched' WHERE timestamp < <fix-deploy-time>` so the new poller doesn't try to retroactively dispatch 30 days of events.

### Option B — Document deprecation, then remove

If emit-time dispatch is the intended model and replay is not wanted, the columns should not exist (or should not look like a queue).

- Add a comment to `agents/shared/db-schema.md` saying `events.status` and `events.handled_by` are unused, retained for schema compatibility, do not rely on them for dispatch state.
- Optionally: in the next schema migration, drop the columns.
- Replace the false signal with a real one: emit `handler.started` and `handler.completed` rows (already happens for cron-triggered handlers — generalize to event-triggered handlers, currently only `metrics-snapshot.ts` emits these).

Cost: minimal. Documentation + (eventually) a `DROP COLUMN`. Requires confirming no code reads `status` or `handled_by` (`grep -rn "events.*status\|events.*handled_by"` should come up empty).

**Effect on KE-729's wedge**: doesn't fix the orphan-events problem (that needs option A or a manual nudge), but stops future devs (and future arc) from assuming the wedge is fixable by polling.

## Recommendation

**Option A**, with a small simplification: don't add a new poller; piggyback on the existing cron tick. Each cron tick, after running scheduled jobs, do one `SELECT status='pending' FROM events WHERE timestamp > now - 1h` and dispatch any unhandled-but-still-fresh events. 1h TTL is cheap; older events are too stale to act on usefully (most metric breaches and project iterations from >1h ago are noise).

If option A is rejected for cost, **Option B** is strictly better than the status quo.

## Falsifiers

- **PF1.** After option A lands, KE-729's pending `metric.breach` events get dispatched within 1h to the (now-working) reactor. → Confirms the fix.
- **PF2.** After option B lands, no code-grep result for `events.status` or `events.handled_by` exists outside the schema definition. → Confirms cleanup is complete.
- **PF3.** A heartbeat after option-A-lands shows `events` with `status` column containing values other than `'pending'`. → Confirms transitions are happening.

## Files

- `agents/shared/db-schema.md` — schema doc, currently does not flag `status`/`handled_by` as vestigial.
- `agents/may/manager.ts` and/or wherever `ctx.emit` lives — emit-time dispatch implementation.
- `agents/may/handlers/metrics-snapshot.ts` — only handler that emits `handler.started` for non-cron triggers; pattern to generalize for option B.
- `agents/shared/knowledge/entries/KE-729-*.md` — the wedge.
- `agents/shared/knowledge/entries/KE-453-*.md` — prior observation `events.status` is dead.

## One-line takeaway

`events.status` and `events.handled_by` exist in the schema, default to `'pending'` / `NULL`, and are never updated — making them simultaneously look like a work-queue marker and not be one; this directly produced KE-729's wedge (2 `metric.breach` events sit pending while a now-working handler does nothing); resolve by either (A) honoring the columns with a 1h-TTL poller piggybacking on the cron tick, or (B) explicitly deprecating the columns in `db-schema.md` and emitting `handler.started`/`handler.completed` for event-triggered handlers so the absence of dispatch is visible the same way it is for cron handlers.
