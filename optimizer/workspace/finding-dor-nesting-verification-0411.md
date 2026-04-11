# Finding: D-o-R Nesting Fix Verification — INCOMPLETE FIX

**Date**: 2026-04-11 ~11:54 UTC  
**Session**: s_1775908445438_1408  
**Type**: Workflow Health — Post-Fix Verification  
**Verdict**: ❌ Nesting fix is INCOMPLETE — 2 incidents in 8 post-fix runs (25% nesting rate)

## Executive Summary

The nesting fix (commit 60a844e3, deployed ~03:54 UTC Apr 11) **partially works** — Phase 1 no longer spawns sub-agents (0 P1-originated nesting). However, **Phase 2 still nests** because the "DO NOT call callAgent()" guard was only added to Phase 1's prompt. Two of 8 post-fix D-o-R runs (25%) had Phase 2 spawn a nested D-o-R, adding 24 and 65 wasted ops respectively.

Separately, the **P1 budget cap continues to hold perfectly**: avg 4.3 ops (n=11, all ≤7), down from 30.0 pre-cap. The budget cap is the real hero — even when nesting occurs, the nested P1 stays under 7 ops.

## Evidence

### Post-Fix D-o-R Runs (n=8, top-level)

| Time (UTC) | Own Ops | Nested Ops | Effective Ops | P1 Ops | Nesting? |
|------------|---------|------------|---------------|--------|----------|
| 05:25 | 26 | 0 | 26 | 5 | ✅ Clean |
| 06:24 | 14 | 0 | 14 | 7 | ✅ Clean |
| 06:54 | 59 | 0 | 59 | 2 | ✅ Clean |
| 07:25 | 9 | 0 | 9 | 3 | ✅ Clean |
| 08:24 | 23 | 0 | 23 | 4 | ✅ Clean |
| 08:54 | 17 | **24** | **41** | 6 | ❌ Phase 2 nested |
| 10:24 | 27 | 0 | 27 | 4 | ✅ Clean |
| 11:24 | 60 | **65** | **125** | 3 | ❌ Phase 2 nested |

### Nesting Incident Details

**Incident 1 (08:54 UTC)**: Phase 2 of `wr_1775897661750_gjh` (EXP-123 KB integration, 11 own ops) spawned nested D-o-R `wr_1775897936526_tha` (24 ops: P1=7, P2=17). The Phase 2 session called callAgent(), which triggered another full D-o-R workflow cycle.

**Incident 2 (11:24 UTC)**: Phase 2 of `wr_1775906679522_tzk` (EXP-136 KB integration, 57 own ops) spawned nested D-o-R `wr_1775907263318_p2b` (65 ops: P1=5, P2=60). Same pattern — Phase 2 called callAgent().

### Root Cause: Guard Only on Phase 1

File: `agents/bob/workflows/deliver-or-report.ts`

Line 170 (Phase 1 strict rules):
```
- **DO NOT call callAgent() or spawn sub-agents** — Phase 2 handles execution. Calling callAgent triggers recursive workflow nesting that wastes hundreds of ops.
```

Phase 2 prompt (lines 275-287) has **NO equivalent guard**. Phase 2 instructions say "Write each deliverable file" but don't prohibit calling callAgent().

### Pre-Fix Comparison (for historical context)

| Metric | Pre-Fix (n=35) | Post-Fix (n=8) | Change |
|--------|---------------|----------------|--------|
| P1 avg ops | 30.0 | 4.3 | **-86%** ✅ |
| P1 max ops | 100 | 7 | **-93%** ✅ |
| Effective total avg | 48.3 | 40.5 | **-16%** |
| Nesting incidents | 2/35 (5.7%) | 2/8 (25%) | **Worse** ❌ |

The effective total average drop of 16% is almost entirely from P1 budget cap savings. The nesting rate is actually **worse** post-fix (25% vs 5.7%), though sample sizes are small (n=8 vs n=35).

### P1 Budget Cap Status: ✅ HOLDING PERFECTLY

All 11 budget-capped Phase 1 sessions are ≤7 ops (avg 4.4):
- Ops: 2, 5, 7, 2, 3, 4, 6, 7, 4, 3, 5
- Zero violations of 15-op budget cap
- **86% reduction** from pre-cap P1 avg of 30.9

### Workflow Adoption Trend: SURGING

| Day | Bob Adoption | System-Wide |
|-----|-------------|-------------|
| Apr 7 | 0% | 1.5% |
| Apr 8 | 0% | 0% |
| Apr 9 | **43.8%** | 10.4% |
| Apr 10 | **44.4%** | 8.5% |
| Apr 11 | **49.1%** | **10.1%** |

Workflow adoption doubled system-wide (4.5% → 10.1%) and bob now uses workflows in ~49% of sessions. The surge started Apr 9 when D-o-R became the default dispatch path for bob's work sessions.

## Recommended Fix

Add the same callAgent guard to **all Phase 2 prompts** in deliver-or-report.ts:

1. Normal Phase 2 (line ~279): Add `⚠️ DO NOT call callAgent() or spawn sub-agents. Write the deliverables yourself.`
2. Narrow Phase 2 (line ~244): Same guard
3. Phase 2b (line ~347): Same guard

This is a **1-line addition to 3 prompt strings** — structural prevention at the prompt level.

## Impact Estimate

Current waste from nesting: 89 ops across 2 incidents in 8 runs = ~11 ops/run average. At ~8 D-o-R runs per 8 hours, extrapolating to 24 runs/day = ~264 wasted ops/day from nesting (~$12/day).

With the fix: 0 nesting → 0 wasted ops from this source.

---
*Optimizer | Session s_1775908445438_1408 | 2026-04-11*
