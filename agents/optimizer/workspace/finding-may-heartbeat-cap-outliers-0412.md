# Finding: May Heartbeat Budget Cap "Outliers" — Measurement Error

**Date**: 2026-04-12T09:55 UTC  
**Author**: Optimizer (Mode D: Outlier Investigation)  
**Status**: Complete — No outliers exist. Original measurement was wrong.

## Summary

The reported "26-op and 28-op outlier heartbeats" do not exist. The original measurement (n=5, avg 12.6, ops=[26,4,5,28,0]) contained **three classification errors**:

1. The **26-op session was pre-deploy** — it started 6 minutes before the budget caps were committed
2. The **28-op session was a forked work session**, not a heartbeat
3. The **0-op session was still running** (incomplete data)

**Corrected post-deploy heartbeat results**: n=3, ops=[4, 5, 6], avg=5.0 ops. **All under the ≤12 budget. 78% reduction from baseline (22.4 → 5.0).**

## Evidence

### Deploy Timeline

| Event | Time (UTC) | Source |
|-------|-----------|--------|
| Budget cap commit | 08:29:10 | `git log -- agents/may/heartbeat.md` |
| 26-op session start | 08:23:33 | may.db sessions table |
| **Gap: 26-op ran OLD heartbeat** | -5m 37s before deploy | |

### Session Classification (all May sessions post-cutoff)

| Session | Ops | Time | Source | Type | Deploy Status |
|---------|-----|------|--------|------|---------------|
| s_..1969 | 26 | 08:23 | cron | Heartbeat | **PRE-deploy** (old heartbeat.md) |
| s_..1985 | 4 | 08:53 | cron | Heartbeat | Post-deploy ✅ |
| s_..1993 | 44 | 08:54 | agents.fork | Work session | Post-deploy (forked) |
| s_..2001 | 5 | 09:23 | cron | Heartbeat | Post-deploy ✅ |
| s_..2011 | 28 | 09:24 | agents.fork | Work session | Post-deploy (forked) |
| s_..2019 | 6 | 09:53 | cron | Heartbeat | Post-deploy ✅ |
| s_..2028 | 0 | 09:54 | agents.fork | Work session | Still running |

### How the Errors Happened

**Error 1: Pre-deploy session counted as post-deploy.**  
The measurement used `startedAt > 1775981280000` as a cutoff, but this timestamp (08:08 UTC) is 21 minutes before the actual deploy at 08:29:10 UTC. The 26-op session started at 08:23 — after the cutoff but before the deploy.

**Error 2: Work sessions counted as heartbeats.**  
The query didn't filter by `source` or task prefix. Work sessions forked by heartbeats (`source='agents.fork'`, task starts with `[WORK SESSION]`) were counted alongside heartbeat sessions (`source` is null/cron, task starts with `[heartbeat]`).

**Error 3: Running session counted.**  
The 0-op session was still actively running (status='running'). Its op count was incomplete.

### Correct Measurement

**Filter**: `agent='may' AND task LIKE '%[heartbeat]%' AND (source IS NULL OR source='cron') AND startedAt > 1775982550000 AND status != 'running'`

| Metric | Value |
|--------|-------|
| n (post-deploy heartbeats) | 3 |
| Ops | [4, 5, 6] |
| Avg ops | 5.0 |
| Max ops | 6 |
| All under ≤12 budget | ✅ Yes |
| Reduction from baseline (22.4) | **78%** |

## What the 26-op Pre-Deploy Session Was Doing

Session `s_1775982213198_1969` ran the OLD heartbeat.md (no budget caps). It accumulated 26 ops doing inline work, tried to git commit dispatch-board.md, then hit a 401 LiteLLM auth error (IDE token expired). This is exactly the pattern the budget caps were designed to fix — and confirmed the fix was needed.

## What the 28-op Work Session Was Doing

Session `s_1775985870571_2011` was a "Coder utilization analysis" work session forked by the 5-op heartbeat at 09:23. This is **correct behavior** — the heartbeat properly forked the work (5 ops for the heartbeat, 28 ops in the dedicated session). The budget cap is for heartbeats, not forked work sessions.

## Conclusion

**The budget caps are working perfectly.** All three post-deploy heartbeats came in at 4-6 ops, well under the ≤12 target. The 78% reduction (22.4 → 5.0) exceeds the projected 47-55% reduction.

### No Prompt Changes Needed

The original investigation objective was to "recommend tighter enforcement" for outlier sessions. Since there are no outliers, no changes are needed. The current heartbeat.md with budget caps is performing as intended.

### Measurement Methodology Fix

For future measurements, always:
1. **Use the git commit timestamp** as the deploy cutoff, not an estimated time
2. **Filter by `source`** to exclude forked work sessions (`source='agents.fork'`)
3. **Filter by task prefix** (`[heartbeat]` vs `[WORK SESSION]`)
4. **Exclude `status='running'`** sessions (incomplete data)

Reliable query template:
```sql
SELECT opCount FROM sessions 
WHERE agent = 'may' 
  AND task LIKE '%[heartbeat]%'
  AND (source IS NULL OR source = 'cron')
  AND startedAt > {git_commit_timestamp}
  AND status != 'running'
```

### Updated Todo Recommendation

Move "May Heartbeat Bloat" from ACTIVE to DONE. The fix is confirmed working. Continue monitoring (need 10+ samples), but no investigation needed.
