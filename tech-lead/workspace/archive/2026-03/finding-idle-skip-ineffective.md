# Finding: Idle Skip Feature is Implemented but Not Actually Skipping

**Date**: 2026-03-18T03:50 UTC
**Status**: NEW — needs fix
**Impact**: HIGH — optimizer identified 81% idle sessions as $2,155+ waste

## Evidence

```
Idle skips (all time): 0
Recent heartbeat requests (6h): 240
```

The `shouldSkipIdleHeartbeat()` code in `src/app/cron.ts` (line 413) exists and compiles, but it never actually skips because `hasPendingWork()` (line 389) almost always returns `true`.

## Root Cause

`hasPendingWork()` checks:
```sql
SELECT 1 FROM requests
WHERE toAgent = ? AND status IN ('CREATED', 'IN_PROGRESS') AND method = 'send'
LIMIT 1
```

The cron system itself creates `send`-method requests when dispatching heartbeats, and these likely linger in `CREATED` status. Additionally, agents send each other requests constantly (Bob briefs, optimizer findings, etc.), so there's almost always a pending `send` for every agent.

## Fix Options

1. **Filter out cron's own requests** — exclude requests where `fromEntity = 'cron'` from the pending work check
2. **Only count recent requests** — add a time window (e.g., last 2 hours) to avoid stale sends counting as "work"
3. **Count meaningful requests only** — filter by specific task patterns that indicate real work (not heartbeat dispatches)

## Recommendation

Option 1 is the safest — cron heartbeat dispatches should not count as "pending work" that prevents the next skip. The intent of `hasPendingWork` is to detect when another agent has sent this agent a task to do, not that cron has previously fired a heartbeat.

```typescript
// Fix: exclude cron-originated requests
const row = db
  .query(
    `SELECT 1 FROM requests
     WHERE toAgent = ? AND status IN ('CREATED', 'IN_PROGRESS')
     AND method = 'send' AND fromEntity != 'cron'
     LIMIT 1`,
  )
  .get(agentName);
```
