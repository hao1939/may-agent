# Finding: D-o-R Phase 1 Cap Measurement — Update 2

**Date**: 2026-04-11 03:54 UTC (~5h post-deployment of budget cap)
**Fix 1**: Phase 1 budget cap (commit 40b22057, deployed ~00:58 UTC)
**Fix 2**: Anti-nesting instruction (commit 60a844e3, deployed ~03:54 UTC)
**Status**: NO NEW DATA — sessions DB empty in current environment

## Current State

### Fix 1: P1 Budget Cap (15-op limit)
- **Deployed**: 2026-04-11 ~00:58 UTC
- **Last measurement** (2h post-fix, n=1): 2 ops (vs pre-fix avg of 32)
- **Current measurement** (5h post-fix): **No new D-o-R workflow sessions found**
- The sessions database (`may.db`) contains 0 sessions in the current environment, likely due to environment isolation. Cannot query runtime session data from this context.

### Fix 2: Anti-Nesting Instruction (NEW)
- **Deployed**: 2026-04-11 ~03:54 UTC (commit 60a844e3)
- **What**: Added "DO NOT call callAgent() or spawn sub-agents" to Phase 1 strict rules
- **Why**: Found 3 instances of nested workflow spawning in 72h = 161 wasted ops (~54 ops/day)
- **Expected impact**: Eliminates recursive D-o-R invocations entirely
- **Measurement**: Need post-deployment D-o-R runs to confirm

## Pre-Fix Baseline (from previous analysis, n=38)

| Metric | Value |
|---|---|
| Mean P1 ops | 32.2 |
| Median P1 ops | 30 |
| Sessions above 15 ops | 24/38 (63%) |
| Wasted ops from nesting | 161 in 72h |
| Combined daily waste | ~280 ops/day (P1 bloat + nesting) |

## Combined Fix Expected Impact

| Source | Pre-Fix Daily | Post-Fix Expected | Savings |
|---|---|---|---|
| P1 bloat (>15 ops) | ~225 ops/day | ~0 ops/day | ~225 ops/day |
| Nested workflow spawning | ~54 ops/day | ~0 ops/day | ~54 ops/day |
| **Total** | **~280 ops/day** | **~0 ops/day** | **~280 ops/day** |

## Next Steps

1. **Check at next heartbeat with DB access**: Query `sessions` table for D-o-R workflow runs since 00:58 UTC
2. **Need n≥5 for P1 budget cap**: Confirm all post-fix Phase 1 sessions use ≤15 ops
3. **Need n≥3 for anti-nesting**: Confirm no callAgent calls from Phase 1 sessions
4. **Watch for Phase 2 compensatory bloat**: If P2 inflates to compensate for constrained P1, net savings would be less
5. **12h mark** (~13:00 UTC): Should have enough data for statistical confidence

## Data Collection Method

When sessions DB is accessible:
```sql
SELECT s.sessionId, s.agent, s.opCount, s.startedAt, s.workflowRunId
FROM sessions s
WHERE s.startedAt > '2026-04-11T00:58:00Z'
  AND s.workflowRunId IS NOT NULL
  AND s.task LIKE '%Phase 1%'
ORDER BY s.startedAt
```

For nesting detection:
```sql
SELECT s.sessionId, s.opCount, s.parentSessionId, s.workflowRunId
FROM sessions s
WHERE s.startedAt > '2026-04-11T03:54:00Z'
  AND s.workflowRunId IS NOT NULL
  AND s.task LIKE '%callAgent%'
ORDER BY s.startedAt
```
