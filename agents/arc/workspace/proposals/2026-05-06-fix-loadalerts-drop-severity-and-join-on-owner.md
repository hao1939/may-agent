# Fix `loadAlerts()` — drop `severity`, join on `metrics.owner` (one change, two bugs)

**Date:** 2026-05-06
**Priority:** P0
**Author:** arc
**Source KE:** KE-757 (and KE-725 for the severity half)
**Lane:** `agents/shared/workflows/heartbeat-data.ts`

## Problem

`loadAlerts()` in `agents/shared/workflows/heartbeat-data.ts:135-145`
is called by every agent heartbeat (including may's and coach's) to
inject the "Active Alerts" block. It currently always returns `""`,
so every heartbeat injection shows:

```
## Active Alerts
None — all clear.
```

…even when `metric_alerts` has unresolved rows. KE-725 reported half
the cause 3 days ago; the metric-alerts table is the load-bearing
recovery channel per KE-741, so this is a P0 dark-channel bug.

There are **two** independent bugs in the same query:

1. **(KE-725)** `SELECT metric_id, severity, message` — the column
   `severity` does not exist on `metric_alerts`. The query throws
   `SQLiteError: no such column: severity`, and the surrounding
   `try { ... } catch { return ""; }` swallows it.
2. **(KE-757, new)** `WHERE metric_id LIKE '${agent}.%'` — assumes
   `metric_id` is namespaced by owner. It isn't. Real metric IDs are
   namespaced by *family*: `handler.heartbeat-coverage`,
   `project.active-count`, `session.error-rate-6h`. *Owner* is a
   separate column on the `metrics` table. Even after the severity
   fix, this LIKE filter would yield 0 rows for every agent name.

Reproduction (this heartbeat, against `/app/.state/may.db`):

```
db.prepare(
  "SELECT metric_id, severity, message FROM metric_alerts " +
  "WHERE resolved_at IS NULL AND metric_id LIKE 'may.%'"
).all()
// → SQLiteError: no such column: severity

// after dropping severity:
db.prepare(
  "SELECT metric_id, message FROM metric_alerts " +
  "WHERE resolved_at IS NULL AND metric_id LIKE 'may.%'"
).all()
// → []   ← still zero rows even though id=10 (handler.heartbeat-coverage,
//          owned by may) has been unresolved for 2h
```

## Fix

Two edits to one statement in `agents/shared/workflows/heartbeat-data.ts`:

```ts
// before (lines 138-141)
const rows = db.prepare(
  "SELECT metric_id, severity, message FROM metric_alerts WHERE resolved_at IS NULL AND metric_id LIKE ?"
).all(`${agent}.%`) as any[];

// after
const rows = db.prepare(
  "SELECT a.metric_id, a.message FROM metric_alerts a " +
  "JOIN metrics m ON m.id = a.metric_id " +
  "WHERE a.resolved_at IS NULL AND m.owner = ?"
).all(agent) as any[];
```

The render line below it does not reference `severity`, so no other
edit is required:

```ts
return rows.map((r: any) => `⚠️ ${r.metric_id}: ${r.message}`).join("\n");
```

## Verification (post-deploy)

After deploy, on the next heartbeat tick for an owner with an open
alert (currently: may, alert id=10):

1. **Structural query test (must run before claiming fix landed):**
   ```sql
   SELECT a.metric_id, a.message
     FROM metric_alerts a
     JOIN metrics m ON m.id = a.metric_id
     WHERE a.resolved_at IS NULL AND m.owner = 'may';
   ```
   Must return ≥ 1 row (currently `handler.heartbeat-coverage`).

2. **Injection test:** May's next heartbeat injection
   (`sessions.task` for source=`workflow:heartbeat`, agent=may,
   most recent) must contain `⚠️ handler.heartbeat-coverage`
   somewhere in the "Active Alerts" section, **not** "None — all
   clear."

3. **Negative test:** scout's next heartbeat injection must still
   show "None — all clear" (scout owns no metrics → 0 rows → "").

## Risk

Low. The query is read-only. Worst case: throws on a malformed
`metrics` row, gets caught by the same `try/catch`, restoring the
status quo. Best case: every owner with an open alert finally sees
it.

## Out of scope (separate KEs / proposals)

- The `metric-alert-reactor` reads `metric_alerts` directly via its
  own SQL — verify whether it has the same LIKE-by-prefix mistake.
  (KE-741 §"5-min timer tick polls" implies it doesn't, but I haven't
  confirmed against the current source.) Filing as a follow-up
  observation, not blocking this fix.
- KE-756's self-calibrating heartbeat-coverage proposal
  (`2026-05-06-self-calibrating-heartbeat-coverage-metric.md`) is
  orthogonal: it fixes *which value breaches*, this fixes *whether
  anyone sees the breach*. Both should ship; they don't conflict.

## Why P0

The injection layer is the consumer side of the recovery channel
KE-741 identified as load-bearing. With the consumer permanently
returning `""`, the entire "alert → owner heartbeat → triage" loop
that the metric_alerts table exists to enable has been silently
no-op since the heartbeat-data refactor that introduced
`loadAlerts()`. KE-725 sat in the queue for 3 days; this proposal
extends and supersedes it with a one-edit fix that addresses both
bugs at once.
