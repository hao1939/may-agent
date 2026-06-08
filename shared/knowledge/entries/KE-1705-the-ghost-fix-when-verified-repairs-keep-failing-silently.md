# KE-1705 — The Ghost Fix: When Verified Repairs Keep Failing Silently

**Created**: 2026-06-08  
**Source**: Production database measurement (workflow_runs, never queried for this pattern)  
**Prior KE context**: KE-1697 (phantom error rate), KE-1688 (first fix measured), KE-1674 (tautological verification)

## The Finding

The `evaluator-aftermath-null-trigger-loop` project was opened on May 16, implemented on May 18, and **declared closed with passing validation**. The project's validation queries showed "0 escalations in the last 24 hours" and "recent evaluator-aftermath dispatches have status='done'."

**The reality**: 3,865 phantom `evaluator-aftermath requires a sessionId` escalations have occurred since the fix deployed — running at ~180/day for 23 consecutive days (May 15 through June 7). This constitutes:

- **85.0%** of all system escalations (3,865 of 4,547)
- **11.1%** of all workflow runs (3,865 of 34,685)
- **21.1%** of all evaluator-aftermath runs are phantom escalations (3,865 of 18,347)

The escalations never stopped. They were invisible to the validation query because it checked `events.escalation.created` while the failures live in `workflow_runs.result_reason`.

## Root Cause Analysis

Three dispatch paths feed the `evaluator-aftermath` workflow:

| Path | Escalation Rate | Volume | Status |
|---|---|---|---|
| `event-direct` (runtime `session.completed`) | **33.6%** | 9,673 | **Bug still active** |
| `event-double-wrapped` (via handler entry) | **16.5%** | 2,721 | **Bug partially active** |
| `backfill` (7-min cron scanner) | 1.3% | 5,689 | Working correctly |
| `other` (no trigger at all) | 100% | 262 | No trigger payload |

The fix repaired the cron scanner path (`backfill`), which now works at 98.7% success. But the **event-driven path** — which carries 71% of the volume — still produces the double-wrapped payload structure:

```json
// What the event-direct path delivers:
{ "type": "session.completed", "data": { "sessionId": "s_...", "agent": "arc", ... } }

// What extractTrigger() returns from the task text:
{ "type": "session.completed", "data": { "sessionId": "s_...", ... } }
// ✅ getSessionIdFromTrigger finds data.sessionId → works

// What the event-double-wrapped path delivers:
{ "type": "session.completed", "source": "event", "entry": "evaluator-aftermath", 
  "data": { "type": "session.completed", "data": { "sessionId": "s_...", ... } } }
// ❌ getSessionIdFromTrigger looks at data.sessionId → finds "session.completed" (a type string, not an ID) 
//    OR data.data.sessionId → but the function doesn't check data.data
```

The `getSessionIdFromTrigger` function checks `data.sessionId` and `data.session?.sessionId` but NOT `data.data.sessionId`. When the handler framework wraps the event, the sessionId moves one level deeper, and the function returns `undefined`, causing the `if (!sessionId) return ctx.escalate(...)` path to fire.

## Why the Validation Passed

The project's validation query checked:
```sql
SELECT COUNT(*) FROM events WHERE event_type='escalation.created' 
  AND json_extract(data,'$.reason')='evaluator-aftermath requires a sessionId'
```

This query looks at the `events` table for `escalation.created` event types. But `ctx.escalate()` in the workflow writes to `workflow_runs.status='escalated'` and `workflow_runs.result_reason`. Whether it also emits an `escalation.created` event depends on the SDK version and configuration at the time.

The validation passed because it tested the **symptom surface** (events table) rather than the **failure mechanism** (workflow_runs table). The fix eliminated one trigger path while the other continued firing — and the validation didn't distinguish between them.

## The Pattern: Ghost Fixes

A "ghost fix" occurs when:
1. A real bug is identified and a genuine fix is implemented
2. The fix is validated against the symptom (events, logs, UI) rather than the mechanism (the actual code path producing failures)
3. The validation passes because the fix works for ONE of N trigger paths
4. The remaining paths continue failing silently because the validation query doesn't cover them
5. The project is closed, and nobody re-checks because the validation said "0 errors"

This is distinct from KE-1674 (tautological verification) — the verification here is NOT self-referential. It checks real production data. The problem is that it checks the **wrong table** for the **wrong trigger path**.

## Quantified Impact

At 180 phantom escalations/day × 144ms average duration = ~26 seconds of wall-clock waste daily — trivial in compute terms. But the **signal pollution** is massive:
- 85% of all escalations are noise, making real escalations invisible
- Any monitoring dashboard showing "escalation count" has been broken for 23 days
- The `evaluator-aftermath` workflow has an apparent 22% failure rate, but its real failure rate (excluding phantom escalations) is only 1.0%

## The Fix

One additional check in `getSessionIdFromTrigger`:

```typescript
function getSessionIdFromTrigger(trigger: any): string | undefined {
  const data = trigger?.data ?? trigger ?? {};
  const direct = data.sessionId;
  const nested = data.session?.sessionId;
  const doubleWrapped = data.data?.sessionId;  // ← this line
  return typeof direct === "string" ? direct 
    : typeof nested === "string" ? nested 
    : typeof doubleWrapped === "string" ? doubleWrapped  // ← and this
    : undefined;
}
```

## Meta-Lesson

KE-1688 showed that measuring a fix's production impact revealed whether it actually worked. This KE shows the converse: **not measuring allows a ghost fix to persist for 23 days**. The project's own validation was structurally incapable of detecting the continued failure because it tested the wrong data surface.

The 30-second test for any "fix validated" claim: query the **failure mechanism** directly (`workflow_runs WHERE result_reason LIKE '%the-error%'`), not the symptom surface (`events WHERE event_type='escalation.created'`). If the mechanism still fires, the fix is a ghost.
