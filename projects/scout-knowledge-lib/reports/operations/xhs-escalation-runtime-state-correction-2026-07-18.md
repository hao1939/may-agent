# XHS Escalation Runtime State Correction — 2026-07-18

## Trigger

evaluation.app health report 20260718T151356021Z flagged 5 stale-open XHS
runtime escalation events conflicting with xhs-cookie-refresh-blocked task
contract.

## Finding: Valid

The task tree context for xhs-cookie-refresh-blocked claimed all 5 events were
`status=handled, owner=agent:may, handled_by=cron:escalation`. This was
**incorrect**. Direct runtime DB query (2026-07-18T15:14Z) shows:

| Event ID | event_type | delivery_status | status | handled_by |
|----------|-----------|----------------|--------|-----------|
| 3269726 | escalation.created | accepted | **pending** | null |
| 3286687 | escalation.created | accepted | **pending** | null |
| 3289572 | escalation.created | accepted | **pending** | null |
| 3306639 | escalation.created | accepted | **pending** | null |
| 3322297 | escalation.created | accepted | **pending** | null |

All 5 are `status=pending`, not `status=handled`. The prior claim (recorded
2026-07-16T15:50Z in task context) was based on a different query or
misinterpretation.

## Root Cause

Scout cannot write to runtime event objects. The escalation events remain
`status=pending` because no runtime/app-ops handler has closed them. The task
tree is the authoritative contract for XHS cookie refresh (owner=human,
fallback=2026-07-25), but runtime escalation events are a separate surface
that requires runtime/app-ops action to reconcile.

## Corrective Action

1. **False claim corrected**: This report replaces the incorrect
   "status=handled" assertion in xhs-cookie-refresh-blocked context. The
   events are `delivery_status=accepted, status=pending`.
2. **Scope boundary**: Scout owns the task-tree contract. Runtime event
   closure requires the runtime/app-ops owner to mark these 5 events as
   handled/superseded, referencing xhs-cookie-refresh-blocked as the
   authoritative resolution path.
3. **No task-tree change needed for xhs-cookie-refresh-blocked**: The task
   remains correctly blocked with owner=human, fallback=2026-07-25. Only
   the escalation_ref context field contained the false status claim.

## Verification

```sql
SELECT id, status, delivery_status, handled_by
FROM events
WHERE id IN (3269726, 3286687, 3289572, 3306639, 3322297);
-- Result: all 5 are status=pending, delivery_status=accepted, handled_by=null
```

## Repeat Finding — 2026-07-18T15:17Z

evaluation.app health report 20260718T151701027Z re-flagged the same 5 events.
Fresh DB query confirms no change: all 5 remain `status=pending,
delivery_status=accepted, handled_by=null`. Scout scope boundary unchanged:
Scout cannot write to runtime event objects. The task-tree contract
(xhs-cookie-refresh-blocked, owner=human, fallback=2026-07-25) remains
authoritative. scout-explore correctly gates XHS ("waiting for existing
cookie-refresh task; no source agent was started").

**No-op reason for library-side action:** The false "status=handled" claim
lives in xhs-cookie-refresh-blocked task context field `escalation_ref`. The
correct state is documented in this report. A task-update action to correct the
context field is proposed but the task lacks a revision number in tree.json,
so this report serves as the authoritative correction record until reconciled.

## Recommended Runtime Action

The runtime/app-ops owner should close these 5 escalation events as
superseded by xhs-cookie-refresh-blocked task (project: scout-knowledge-lib.app,
owner: human, fallback: 2026-07-25). This is the same
recovered-stale closure pattern recommended by evaluation.app.
