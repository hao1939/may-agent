# Investigation: metric-alert-reactor timer path failed on removed `metric_values` table

**Date:** 2026-05-04 00:35Z  
**Owner:** dev  
**Status:** fixed in handler code; needs runtime observation after next 5-minute tick

## Summary

The live metric-alert path was still not producing remediation sessions even after `metric-alert-reactor` had `intervalMs: 300000` in `agents/may/cron.json`. The timer fallback path attempted to read the current metric value from a non-existent `metric_values` table, caught the resulting DB error, logged it, and returned before forking the owning agent.

I patched `agents/may/handlers/metric-alert-reactor.ts` to use `metrics.current`, which is the canonical current value already maintained by `metrics-snapshot`, instead of querying the removed `metric_values` table.

## Evidence

- Active metrics showed the alert source is real and current: `project.active-count = 0` with threshold `1`; `project.blocked-over-6h = 2` with threshold `1`.
- `metric_alerts` has two unresolved rows for those metrics, both owned by `may`.
- There were 6 pending `metric.breach` events, aged 144-264 minutes, but no `handler.started` / `handler.completed` / `handler.failed` lifecycle events containing `metric-alert-reactor` in the last 24h and no metric-alert remediation sessions.
- Schema check showed `metric_alerts` columns are `id, metric_id, alert_type, message, resolved_at, created_at`, and `metric_values` does not exist.
- Reproducing the exact timer query from the handler failed with `no such table: metric_values`.
- Candidate query using `metrics.current` returned the two unresolved alert rows with correct current values:
  - `project.active-count`, current `0`
  - `project.blocked-over-6h`, current `2`

## Root cause

Schema drift: `metric-alert-reactor`'s timer fallback was added or retained with an obsolete `metric_values` table reference. The handler catches timer DB errors internally, so this failure does not emit `handler.failed`; the only symptom is the absence of remediation sessions and repeated pending `metric.breach` events.

This is distinct from the older KE-455/on-only wiring issue. `cron.json` now includes `intervalMs: 300000` for `metric-alert-reactor`, but the timer path could not progress because its SQL was invalid.

## Change made

In `agents/may/handlers/metric-alert-reactor.ts`, replaced:

```sql
(SELECT value FROM metric_values WHERE metric_id = m.id ORDER BY ts DESC LIMIT 1) as current
```

with:

```sql
m.current as current
```

## Verification performed

- Read back the patched handler and confirmed it now selects `m.current as current`.
- Ran a readonly SQLite probe showing the old query fails with `no such table: metric_values` while the fixed query returns both unresolved alerts.
- Imported the patched TypeScript handler successfully with Bun: `IMPORT_OK create`.

## Follow-up checks

After the runtime reloads or the next handler tick runs, verify:

```sql
SELECT event_type, timestamp, data
FROM events
WHERE event_type IN ('handler.started','handler.completed','handler.failed')
  AND data LIKE '%metric-alert-reactor%'
ORDER BY timestamp DESC
LIMIT 20;
```

and:

```sql
SELECT sessionId, agent, status, source, startedAt, task
FROM sessions
WHERE source LIKE '%metric-alert-reactor%'
   OR task LIKE '%[metric-alert]%'
ORDER BY startedAt DESC
LIMIT 20;
```

Expected: a `handler.started`/`handler.completed` pair for `metric-alert-reactor`, followed by remediation sessions for `may` keyed to `project.active-count` and/or `project.blocked-over-6h` unless dedup suppresses them.
