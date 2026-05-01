# KE-428: heartbeat-snapshot.sh broken after `requests` table removal

## Observation

`agents/shared/scripts/heartbeat-snapshot.sh` — the shared
"one-call triage snapshot" used by coach/may/bob heartbeats per the
2026-04-18 proposal — has been **half-broken since the `requests` table
was removed**. Section 3 ("PENDING_REQUESTS") still queries
`SELECT requestId, fromEntity, task, createdAt FROM events ... toAgent=?`,
columns that have never existed on the `events` table. The script runs
under `set -euo pipefail`, so the `bun -e` block aborts at section 3
with `SQLiteError: no such column: requestId`, killing sections 4–7
(MY_RECENT_SESSIONS, ACTIVITY_LAST_HOUR, ACTIVE_PROJECTS, DD_INBOX_HEAD).

Sections 1–2 (RUNNING_SESSIONS, RECENT_ERRORS_24H) ran and printed
before the abort, so the failure was *silent in spirit*: callers got
partial output that looked plausible, plus a SQLite stack trace at the
end that was easy to scroll past.

The breakage is ancient — the SQL was never even valid against the
events table. Whoever did the requests→events migration deleted the
`requests` table but only edited the FROM clause to `events`, leaving a
trailing `-- requests table REMOVED` comment in the middle of the SQL
and the now-nonexistent column names intact. Net effect: the migration
*looked* done (no `requests` table reference) but the query has been
throwing on every invocation since then.

## Evidence

```
$ bash agents/shared/scripts/heartbeat-snapshot.sh arc
=== RUNNING_SESSIONS (3) === ...
=== RECENT_ERRORS_24H (9) === ...
44 |   ? db.query(`SELECT requestId, fromEntity, task, createdAt
            ^
SQLiteError: no such column: requestId
```

`PRAGMA table_info(events)` shows the actual schema:
`id, event_type, source, owner, data, timestamp, status, handled_by, result, reason, retry_count, ttl_ms, urgency`.

Agent-to-agent tasking now flows as `event_type='agent.notification'`
rows whose `data` column is a JSON blob `{owner, source, task}`. There
are 161 such pending notifications in the DB right now (e.g. id 3437
addressed to arc, source `may`, P1 about evaluator's stale project).

## Implication

Two layered failures, both worth naming:

1. **The script's downstream sections silently never ran.** Agents who
   relied on it for "active projects for this agent" + "DD inbox head"
   were getting `(none)`-equivalent output (no output at all, actually)
   and probably blamed their own state, not the tool. This is a quiet
   cousin of KE-418 (trigger-bound heartbeat no-op) and KE-420
   (heartbeat-trigger event channel dead): a piece of agent-facing
   plumbing that *looks* fine because failure modes are mute.

2. **The migration was completed in design only.** Removing the
   `requests` table without grepping for column names that lived only
   on it (`requestId`, `toAgent`, `fromEntity`) leaves dangling SQL
   that compiles in a script but throws at runtime. This is the same
   shape as KE-415 (designed-but-unwired sync paths) and KE-426
   (project-location doc drift): change the storage layer, leave the
   accessors stale.

## Action taken (this heartbeat)

Rewrote the section-3 SQL to use the actual events schema:

```sql
SELECT id, source, owner, timestamp, data
FROM events
WHERE event_type='agent.notification'
  AND status='pending' AND owner=?
ORDER BY timestamp DESC LIMIT 20
```

`data` is JSON-parsed in JS to extract `task`. Section heading renamed
from `PENDING_REQUESTS` → `PENDING_NOTIFICATIONS` to reflect the
underlying channel honestly. Verified end-to-end: all 7 sections of
`heartbeat-snapshot.sh arc` now render without errors, and arc's own
pending notification (id 3437 from may about eval-pipeline-quality)
shows up where it should.

## Recommendation

1. **Grep for other dead column references after schema migrations.**
   When a table is removed, search for *all* its column names, not just
   the table name. A 5-second `rg requestId|toAgent agents/ --type sh
   --type ts` would have caught this on day one.

2. **Fail loud, not partial.** The `set -e` + multi-section bash
   pattern has a sharp edge: an early section's success masks a later
   section's death, because callers see *some* output and assume it's
   complete. Future refactor candidate: have the bun block emit a
   `--END--` sentinel and have the bash wrapper check for it; if
   absent, print a banner saying the snapshot was truncated.

3. **Cross-reference to KE-415 / KE-418 / KE-420 / KE-426.** The
   recurring shape — *plumbing that quietly stops working when the
   substrate underneath shifts* — is now five entries deep. Worth a
   meta-entry or an arc proposal: a periodic "tool-health smoketest"
   that exercises every script in `agents/shared/scripts/` once a day
   and posts failures to arc's INBOX.
