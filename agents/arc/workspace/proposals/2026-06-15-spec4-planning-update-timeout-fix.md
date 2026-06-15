# Spec 4: Fix aks-explorer planning_update Timeout Sisyphus Loop

**Priority:** P1  
**Owner:** dev (requires src/ change → Hao approval per ORDER-010)  
**Source:** KE-2004 (Face 2), KE-2000 (Repair Spec 4), KE-1994  
**Date:** 2026-06-15

## Problem

Every `planning_update` session for aks-explorer hits the 240s step timeout
and is interrupted. The planner is dispatched on every `project.owner.requested`
event (~every 5-7 minutes), runs for exactly ~252s (240s timeout + 12s 
startup overhead), gets killed, and is immediately re-dispatched.

**Measured impact (last 24h as of 14:22Z 2026-06-15):**
- 263 planning_update sessions total, 163 interrupted (62%)
- All interrupted sessions duration: 240–260s (timeout band)
- 10.8 hours of wasted compute (157 timeout kills × ~252s each)
- Only 11/48 (23%) complete in the most recent 6h window

The planning_update step needs to read the task tree, query session state,
review events, and generate planning decisions. This consistently exceeds
240s for aks-explorer's project size.

## Root Cause

In `projects/aks-rp-e2e.app/workflows/project-planner.ts` line 657-660:

```ts
timeoutMs: timeoutFromEnv(
  "AKS_RP_E2E_PLANNER_UPDATE_TIMEOUT_MS",
  240_000,   // 4 minutes — insufficient for this project's planning scope
),
```

No env var override is set, so it uses the 240s default. The workflow-level
timeout is 3,600s (generous), but the per-step timeout kills the session
before it can complete.

## Proposed Fix (two-part)

### Part 1: Increase planning_update step timeout (1-line change)

Change default from 240_000 to 600_000 (10 minutes):

```ts
// projects/aks-rp-e2e.app/workflows/project-planner.ts line 660
timeoutMs: timeoutFromEnv(
  "AKS_RP_E2E_PLANNER_UPDATE_TIMEOUT_MS",
  600_000,   // 10 minutes — matches observed completion time for successful sessions
),
```

**Rationale:** The 11 successful planning_update sessions in the last 6h 
had durations from 60s to 314s. 600s gives 2× headroom over the longest 
observed successful session.

### Part 2: Add planner dedup cooldown (defense in depth)

If a planning_update was interrupted in the last 10 minutes, skip the
next planner dispatch:

```ts
// Before launching planning_update step, check recent planner sessions:
const recentPlannerFail = await checkRecentPlannerInterrupt(ctx, 600_000);
if (recentPlannerFail) {
  return ctx.done("Planner cooldown: recent planning_update was interrupted, skipping.");
}
```

This prevents the Sisyphus loop even if the timeout is still occasionally
exceeded. It's a circuit breaker at the dispatch level.

## Expected Impact

- Interrupt rate for planning_update: 62% → <10%
- Wasted compute: 10.8h/day → <1h/day
- Net planning quality: more plans actually complete → better task assignment
- Guard triggers: slight reduction (fewer finish() uncommitted warnings from 
  interrupted sessions)

## Risk

**Low.** The workflow-level timeout (3,600s = 60min) is unchanged. Each 
individual planning step can run up to 10 minutes, but the total workflow 
is still bounded. If the planning step genuinely hangs, the workflow timeout 
catches it.

## Falsifier

- F1: If planning_update interrupt rate stays above 30% with the 600s timeout,
  the problem is not timeout but something else (prompt too large, tool loops).
  Monitor for 24h after deployment.
- F2: If planning_update sessions with the 600s timeout start consuming >15min
  average, the step timeout is too generous and should be reduced to 480s.

## Validation

After deployment:
```sql
SELECT status, COUNT(*) as c, ROUND(AVG((endedAt-startedAt)/1000.0),1) as avg_s
FROM sessions
WHERE agent='aks-explorer' 
  AND sessionId LIKE '%planning_update%'
  AND startedAt > strftime('%s','now')*1000 - 86400000
GROUP BY status;
```

Target: `interrupted` count < 10% of total, average duration < 300s.
