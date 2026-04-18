# Finding: Request Flow Complexity (Lens B)

**Date**: 2026-04-16  
**Scope**: DB insert → agent pickup for `requests` table  
**Method**: Code trace + comparison with prior audit (2026-04-13)

## Summary

The request flow has **5 layers** from creation to agent pickup — unchanged from prior audit 3 days ago. The architecture is linear and reasonable, but 3 medium-severity gaps persist (F-2 fuzzy-match, F-4 no IN_PROGRESS transition, F-5 silent catches).

## Flow (confirmed still accurate)

```
1. agents.message() → manager-agents-tool.ts (validate + dedup + track)
2. trackRequest() → INSERT into requests table, status=CREATED
3. triggerHeartbeat() → fast-forward cron timer for recipient agent
4. cron.ts fireHeartbeat() → raw SQL query for pending requests → inject into task text
5. agent finish() → session-subscribers.ts fuzzy-match → mark COMPLETED
```

**Layers: 5** — tool handler → DB write → cron trigger → heartbeat injection → completion subscriber.

## Key Observation: No Changes Since Prior Audit

The comprehensive audit at `agents/tech-lead/workspace/audit-request-tracking-flow.md` (2026-04-13) documents 8 findings (F-1 through F-8). All code paths verified unchanged:
- `manager-agents-tool.ts` still has 5 silent catch blocks
- `session-subscribers.ts` still uses 0.3 fuzzy-match threshold
- `cron.ts:660-677` still uses raw SQL instead of `getRequestsByAgentAndStatus()`
- No CREATED→IN_PROGRESS transition on injection

## Assessment

**Is there unnecessary indirection?** No — the 5 layers serve distinct purposes (validation, persistence, scheduling, injection, completion). The complexity is inherent to async message passing.

**What's worth fixing?** The 3 MEDIUM findings from the prior audit remain the priority:
1. F-2: Fuzzy-match completion (risk of closing wrong request)
2. F-4: Missing state transition (can't distinguish unseen vs in-progress)
3. F-5: Silent catches (total blindness during DB issues)

## Action

No new findings. Prior audit `audit-request-tracking-flow.md` is current and comprehensive. Fix priorities remain F-2 > F-5 > F-4.
