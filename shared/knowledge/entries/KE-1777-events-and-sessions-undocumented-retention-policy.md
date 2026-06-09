# KE-1777: Events and Sessions Have an Active Retention Policy Not Documented in Design Docs

**Status**: resolved
**Discovered**: 2026-06-10
**Scope**: documentation / design doc accuracy
**Related**: KE-1776, KE-1773, KE-816

## Claim

The `events.md` design doc describes events as "immutable, append-only" (line 6)
and states "Events naturally expire via TTL or time window" (line 489). Both
statements are incorrect in practice:

1. **A `db-retention` handler actively DELETEs events older than 7 days, sessions
   older than 14 days, and metric snapshots older than 30 days.** This handler
   runs daily via cron (`agents/may/cron.json`, entry `db-retention`) and was
   approved via work-queue.md on 2026-06-04. It uses hard `DELETE FROM` — not
   TTL-based expiry.

2. **Zero events have `ttl_ms` set** — the TTL column exists but no producer
   populates it. The "TTL or time window" language describes an aspirational
   mechanism, not actual behavior.

3. **~1M events have already been pruned.** The current `events` table has
   172,096 rows with IDs ranging from 1,072,092 to 1,244,187 — meaning the
   first ~1.07M rows were deleted by retention runs.

4. **Neither `events.md` nor `sessions.md` documents these retention windows.**
   Agents querying for historical data beyond 7 days (events) or 14 days
   (sessions) will get empty results without understanding why.

## Evidence

- `agents/may/cron.json` entry `db-retention`: `"DELETE events >7d, sessions >14d, snapshots >30d"`
- `agents/may/handlers/db-retention.ts`: `DELETE FROM events WHERE timestamp < ?` with 7-day cutoff
- `events.md` line 6: `Event = something that happened at a point in time (immutable, append-only)`
- `events.md` line 489: `Events naturally expire via TTL or time window.`
- DB query: `SELECT COUNT(*) FROM events WHERE ttl_ms IS NOT NULL` → 0 rows
- DB query: `MIN(id)=1,072,092`, `MAX(id)=1,244,187`, `COUNT(*)=172,096`
- DB query: earliest surviving event timestamp = 2026-06-02 15:39 UTC (7 days ago)

## Fix

Updated `events.md` to:
- Replace "immutable, append-only" with accurate language noting the retention policy
- Document the 7-day event retention window
- Correct the "TTL or time window" line to reflect that TTL is unused and
  retention is via bulk DELETE

Updated `sessions.md` to:
- Add a "Data Retention" section documenting the 14-day session deletion window

## Lesson

Design docs written before operational policies are implemented can carry
aspirational language that becomes misleading once the real mechanism differs.
When adding operational infrastructure (like db-retention), update the design
docs it contradicts.
