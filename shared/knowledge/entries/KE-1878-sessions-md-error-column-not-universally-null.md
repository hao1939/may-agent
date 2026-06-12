<ai_context>
sessions.md claimed the error column was "universally NULL" (KE-1558). In reality, the session-recovery handler bypasses the db-writer race by writing error text directly via db.prepare().run(). As of 2026-06-12, 1 of 649 error sessions in the 14-day retention window has a non-null error column value. The doc has been updated from "always NULL" to "nearly always NULL" with the exception path documented.
Triggers: sessions.md, error column, KE-1558, session-recovery, coherence audit
Related: KE-1558
</ai_context>

# KE-1878: sessions.md Error Column — Not Universally NULL

**Status**: resolved
**Discovered**: 2026-06-12
**Agent**: arc (heartbeat coherence audit)
**Scope**: design doc accuracy
**Related**: KE-1558 (original error column race bug)

## Claim

The `sessions.md` design doc stated the `sessions.error` column is "universally
NULL — including for all error sessions." This was correct when KE-1558 was
written, but became stale after the session-recovery handler was introduced.

## Evidence

### Data census (2026-06-12)

```sql
SELECT COUNT(*) as total_error_sessions,
       SUM(CASE WHEN error IS NOT NULL AND error != '' THEN 1 ELSE 0 END) as has_error_text
FROM sessions WHERE status = 'error';
-- Result: total_error_sessions=649, has_error_text=1
```

The single non-null error value:
- Session: `s_task_pm-k8s-mtc-staging-retry-20260612`
- Error text: "Auto-closed idle immediate session (no activity for >45min, likely handler timeout)"
- Written by: `agents/may/handlers/session-recovery.ts` line 213-216

### Root cause of the exception

The session-recovery handler writes directly to SQLite via `db.prepare().run()`
(lines 215-218 of `session-recovery.ts`), bypassing the `db-writer.ts` event
bus path. Because the session is already in `error` status after the direct
UPDATE, no subsequent `session.end` → `db-writer` event chain overwrites the
error text with NULL.

The normal session lifecycle path (`manager.ts` → `session.end` event →
`db-writer.ts` → `updateSessionDb()`) still has the race condition: the
manager writes the correct error text first, then db-writer overwrites it
with NULL from the event data. This race affects ~99.8% of error sessions.

## Action

Updated `sessions.md` "Known Issues" section:
- Changed heading from "always NULL" to "nearly always NULL"
- Added quantified exception rate (~99.8% NULL)
- Documented the session-recovery bypass path
- Clarified the workaround applies to "normal manager.ts path" sessions

## Pattern

Design doc claims that use absolute quantifiers ("always", "never", "all",
"universally") are fragile — a single new code path can falsify them
silently. Prefer "nearly always" or quantified rates ("99.8% of X") which
remain correct as edge cases are added.
