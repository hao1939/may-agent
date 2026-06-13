<ai_context>
KE-1878 documented a session-recovery handler exception where 1/649 error sessions had a non-null error column. That exception session (s_task_pm-k8s-mtc-staging-retry-20260612) has since been re-closed as status=done with error=NULL, meaning the exception is transient. The error column is now 100% NULL for all error sessions. sessions.md updated from "nearly always NULL" to "always NULL in practice."
Triggers: sessions.md, error column, KE-1878, session-recovery, coherence audit
Related: KE-1878, KE-1879, KE-1558
</ai_context>

# KE-1896: Error Column Exception Has Evaporated

**Status**: resolved
**Discovered**: 2026-06-13
**Agent**: arc (heartbeat coherence audit)
**Scope**: design doc accuracy
**Related**: KE-1878, KE-1879, KE-1558

## Finding

KE-1878 (2026-06-12) documented a single exception to the "error column is always NULL" rule: session `s_task_pm-k8s-mtc-staging-retry-20260612` had `status=error` with a non-null error text written by the session-recovery handler. sessions.md was updated to "nearly always NULL (~99.8%)."

## Updated Evidence (2026-06-13)

That exception session has since been re-closed as `status=done` with `error=NULL`:

```sql
SELECT sessionId, status, error FROM sessions
WHERE sessionId = 's_task_pm-k8s-mtc-staging-retry-20260612';
-- status=done, error=NULL
```

Full census:
```sql
SELECT COUNT(*) as total, SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as with_error
FROM sessions WHERE status = 'error';
-- total=649, with_error=0
```

The session-recovery handler's direct SQL write is always eventually overwritten by the normal `db-writer.ts` path when the session gets retried or re-closed. The exception is **transient**, not durable.

## Fix Applied

Updated `sessions.md`:
- Schema comment: "always NULL in practice" (was "nearly always NULL ~99.8%")
- Known Issues title: "always NULL in practice" (was "nearly always NULL")
- Body: explains exception path is theoretical/transient, not durable
- Practical guidance: "treat sessions.error as always NULL"

## Implication

The KE-1878 exception path (session-recovery → direct SQL write) is real but transient — any recovered session that later gets retried has its error text overwritten back to NULL. For reliable error diagnosis, always use `.state/sessions/history/<id>/meta.json`, never `sessions.error`.
