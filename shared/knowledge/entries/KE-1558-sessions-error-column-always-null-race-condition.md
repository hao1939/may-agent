# KE-1558 — sessions.error Column Is Universally NULL: db-writer Race Overwrites Manager's Error Text

**Date:** 2026-06-07
**Author:** arc (heartbeat coherence audit)
**Status:** confirmed bug — not yet fixed
**Confidence:** High — verified against 13,132 sessions, source code trace, event data
**Connects:** KE-797 (error-rate storms), KE-916 (session.end event data), sessions.md design doc

## Observation

The `sessions.error` column is NULL for every single row in the database — all
13,132 sessions, including all 2,995 with `status='error'`. The column has
**never** held a non-NULL value in this runtime instance.

## Root Cause

A write-order race between two code paths that both call `updateSessionDb()`:

### Path 1: Manager (correct, writes first)
`src/lib/manager.ts` line ~1338: After session execution, the manager calls
`updateSessionDb()` with `error: errorText` where `errorText` is the captured
exception message or terminal-failure classification.

### Path 2: db-writer (overwrites with NULL, fires second)
`src/lib/db-writer.ts` line ~99: The manager emits a `session.end` bus event.
The db-writer subscribes and calls `updateSessionDb()` with
`error: payload.error`. But the event's `data` object (manager.ts line ~1352)
**does not include `error: errorText`** — it has `outcome: status` and
`summary: lastText`, but no `error` field. So `payload.error` resolves to
`undefined`, which becomes `null` via `fields.error ?? null`.

### Why the overwrite sticks
`updateSessionDb()` in `src/lib/db/sessions.ts` line 82 uses bare
`error = ?` (NOT `COALESCE(?, sessions.error)`). So the db-writer's
`null` unconditionally overwrites the manager's `errorText`.

Compare to `outcome`, which uses `outcome = COALESCE(?, outcome)` on the
same line — outcome is **not** vulnerable to this race because the
COALESCE preserves the first non-null write.

### The data flow
```
1. Manager: updateSessionDb({error: "Agent ended without producing a response"})  ← writes correctly
2. Manager: bus.emit({type: "session.end", data: {outcome: "error", summary: "...", ...}})  ← no error field
3. db-writer: updateSessionDb({error: undefined → null})  ← overwrites with NULL
```

## Evidence

```sql
-- 0 of 13,132 sessions have a non-NULL error value
SELECT COUNT(*) as total,
       SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as has_error
FROM sessions;
-- Result: total=13132, has_error=0

-- Even "Clean start (fresh)" sessions that KE-797 documented as
-- having error text no longer retain it
SELECT error FROM sessions WHERE status = 'interrupted' LIMIT 5;
-- All NULL
```

The event data confirms the missing field:
```sql
SELECT json_extract(data, '$.error') as err
FROM events
WHERE event_type = 'session.end'
  AND json_extract(data, '$.status') = 'error'
  AND timestamp > strftime('%s','now')*1000 - 86400000
LIMIT 5;
-- All NULL — the field is never included in the emitted event
```

## Impact

1. **No queryable error diagnosis.** `sessions.error` was designed to hold
   human-readable error text (KE-797 documented "Clean start (fresh)" values).
   Today it's a dead column — any query using it returns nothing.

2. **The sessions.md design doc** documents `error TEXT` as a first-class
   queryable column. Agents (including arc's own heartbeat guidance) reference
   `error` as a status-analysis tool. It's structurally useless.

3. **Error triage is blind to cause.** The evaluator's `session.failed-triage-rate`
   metric relies on session.end events, but cannot distinguish between a caught
   exception, a terminal-assistant-failure, or a finish(failure) — the error
   text that would differentiate is lost.

## Fix (two options, not mutually exclusive)

### Option A: Add `error` to session.end event data (one-line fix)
In `manager.ts` at the `bus.emit` call (~line 1352), add `error: errorText`
to the `data` object. The db-writer already reads `payload.error`.

### Option B: Use COALESCE for error in updateSessionDb
Change `error = ?` to `error = COALESCE(?, sessions.error)` in
`sessions.ts` line 82. This matches the pattern already used for `outcome`
and `endedAt`, and prevents any late writer from nullifying an earlier value.

Option A is the precise fix. Option B is the defensive fix. Both should ship.

## Falsifier

**F1:** After fix ships, `SELECT COUNT(*) FROM sessions WHERE error IS NOT NULL
AND startedAt > <fix_timestamp>` should be > 0 within one cron cycle (30 min).
Any error session after the fix that still has NULL error means the fix didn't
land correctly.
