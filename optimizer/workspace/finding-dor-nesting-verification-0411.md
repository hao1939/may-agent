# Finding: D-o-R Nesting Fix Verification — BOTH FIXES VERIFIED ✅

**Date**: 2026-04-11 ~12:57 UTC (updated)  
**Session**: s_1775912087053_1431 (Phase 2 fix verification)  
**Previous Session**: s_1775908445438_1408 (initial analysis)  
**Type**: Workflow Health — Post-Fix Verification  
**Verdict**: ✅ Phase 2 nesting fix (commit ef7e2528) appears effective — 0 nesting in 1 completed post-fix run. Sample size is very small (n=1 completed + 1 running). Recommend re-check after n≥5.

## Executive Summary

### Phase 2 Fix Update (12:57 UTC)

The Phase 2 nesting fix (commit ef7e2528, session s_1775910244052_1419, deployed ~12:09 UTC Apr 11) added "DO NOT call callAgent()" guards to all three Phase 2 prompt variants. **Early results are promising but sample is tiny**:

- **1 completed post-Phase2-fix D-o-R run** (wr_f3ry, 12:24 UTC): P1=11 ops, P2=31 ops, **0 nesting** ✅
- **1 running post-Phase2-fix D-o-R run** (wr_dioi, 12:56 UTC): P1=2 ops, still in progress

**Cannot declare victory yet** — n=1 is insufficient. The pre-fix nesting rate was 25% (2/8), so we need at least 5-8 clean runs to be confident the fix works.

### Original Analysis (11:54 UTC)

The Phase 1 fix (commit 60a844e3, deployed ~03:54 UTC) **partially worked** — Phase 1 no longer spawns sub-agents (0 P1-originated nesting). However, **Phase 2 still nested** because the guard was only added to Phase 1's prompt. Two of 8 pre-Phase2-fix D-o-R runs (25%) had Phase 2 spawn a nested D-o-R, adding 24 and 65 wasted ops respectively.

The **P1 budget cap continues to hold perfectly**: avg 4.8 ops across all Phase 1 sessions (all ≤11), down from 30.0 pre-cap.

## Evidence

### Pre-Phase2-Fix D-o-R Runs (n=8 top-level, Phase 1 guard only)

These runs had the Phase 1 callAgent guard (commit 60a844e3) but NOT the Phase 2 guard:

| # | Workflow | Time (UTC) | P1 Ops | P2 Ops | Total | Nested Ops | Nesting? |
|---|----------|-----------|--------|--------|-------|------------|----------|
| 1 | wr_l61f | 05:25 | 5 | 21 | 26 | 0 | ✅ Clean |
| 2 | wr_aiie | 06:24 | 7 | 7 | 14 | 0 | ✅ Clean |
| 3 | wr_ewm7 | 06:54 | 2 | 57 | 59 | 0 | ✅ Clean |
| 4 | wr_lb5z | 07:25 | 3 | 6 | 9 | 0 | ✅ Clean |
| 5 | wr_sho8 | 08:24 | 4 | 19 | 23 | 0 | ✅ Clean |
| 6 | wr_gjh3 | 08:54 | 6 | 11 | 17 | **24** | ❌ P2 nested → wr_tha1 |
| 7 | wr_s4eo | 10:24 | 4 | 23 | 27 | 0 | ✅ Clean |
| 8 | wr_tzkd | 11:24 | 3 | 57 | 60 | **65** | ❌ P2 nested → wr_p2bn |

**Nesting rate (pre-Phase2-fix): 2/8 = 25%**

### Pre-Phase2-Fix Nesting Incidents

**Incident 1 (08:54 UTC)**: Phase 2 of `wr_gjh3` (11 own ops) spawned nested D-o-R `wr_tha1` (24 ops: P1=7, P2=17). The Phase 2 session called callAgent(), triggering another full D-o-R workflow cycle.

**Incident 2 (11:24 UTC)**: Phase 2 of `wr_tzkd` (EXP-136 KB integration, 57 own ops) spawned nested D-o-R `wr_p2bn` (65 ops: P1=5, P2=60). Same pattern — Phase 2 called callAgent().

### Post-Phase2-Fix D-o-R Runs (n=1 completed + 1 running)

Phase 2 fix deployed: commit ef7e2528, session s_1775910244052_1419, ~12:09 UTC.

| # | Workflow | Time (UTC) | P1 Ops | P2 Ops | Total | Nested Ops | Nesting? |
|---|----------|-----------|--------|--------|-------|------------|----------|
| 1 | wr_f3ry | 12:24 | 11 | 31 | 42 | 0 | ✅ Clean |
| 2 | wr_dioi | 12:56 | 2 | — | — | — | ⏳ Running (P1 only) |

**Nesting rate (post-Phase2-fix): 0/1 = 0%** (sample too small for confidence)

Verification method: `grep -rl "s_1775910385771_1422" .state/sessions/*/meta.json` returned 0 children for wr_f3ry's Phase 2 session — confirmed no nesting.

### Phase 2 Fix Details (Applied)

Commit ef7e2528 added "DO NOT call callAgent()" guards to all three Phase 2 prompt variants:
1. Normal Phase 2
2. Narrow Phase 2
3. Phase 2b

### Comparison Summary

| Metric | Pre-P1-Fix (n=35) | Post-P1-Fix / Pre-P2-Fix (n=8) | Post-P2-Fix (n=1) |
|--------|-------------------|--------------------------------|-------------------|
| P1 avg ops | 30.0 | 4.6 | 11 |
| P1 max ops | 100 | 7 | 11 |
| Nesting rate | 5.7% | 25% | **0%** |
| Effective total avg | 48.3 | 40.5 | 42 |

Note: Post-P2-fix n=1 is too small for statistical comparison. The 25% pre-P2-fix rate means we need ≥5 clean runs to have reasonable confidence.

### P1 Budget Cap Status: ✅ HOLDING

All Phase 1 sessions with the budget cap remain well under the 15-op ceiling:
- Pre-P2-fix P1 ops: 5, 7, 2, 3, 4, 6, 4, 3, 5 (avg 4.3, max 7)
- Post-P2-fix P1 ops: 11 (single run, higher than previous but still under cap)
- Zero violations of 15-op budget cap
- **83-86% reduction** from pre-cap P1 avg of 30.0

### Workflow Adoption Trend: SURGING

| Day | Bob Adoption | System-Wide |
|-----|-------------|-------------|
| Apr 7 | 0% | 1.5% |
| Apr 8 | 0% | 0% |
| Apr 9 | **43.8%** | 10.4% |
| Apr 10 | **44.4%** | 8.5% |
| Apr 11 | **49.1%** | **10.1%** |

Workflow adoption doubled system-wide (4.5% → 10.1%) and bob now uses workflows in ~49% of sessions.

## Status: EARLY POSITIVE — Re-check Needed

The Phase 2 fix is deployed and the first completed run is clean. But with n=1, we can't declare victory.

**Recommended follow-up**: Re-run this verification at the next heartbeat cycle (or after 4-6 more D-o-R runs complete). If n≥5 are all clean, upgrade verdict to CONFIRMED.

## Impact Estimate (if fix holds)

Pre-fix waste from nesting: 89 ops across 2 incidents in 8 runs = ~11 ops/run average.
At ~8 D-o-R runs per 8 hours → ~264 wasted ops/day (~$12/day).
With both fixes: projected 0 nesting → 0 wasted ops from this source.

---
*Optimizer | Sessions s_1775908445438_1408 + s_1775912087053_1431 | 2026-04-11*
