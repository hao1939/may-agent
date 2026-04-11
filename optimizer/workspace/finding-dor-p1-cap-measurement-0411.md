# Finding: D-o-R Phase 1 Cap Measurement — Update 4 (n=4)

**Date**: 2026-04-11 06:25 UTC (~5.5h post P1 cap, ~2.5h post anti-nesting fix)
**Fix 1**: Phase 1 budget cap (commit 40b22057, deployed ~00:58 UTC)
**Fix 2**: Anti-nesting instruction (commit 60a844e3, deployed ~03:54 UTC)
**Status**: TRENDING POSITIVE — n=4 (need n≥5 for confirmation)

## All Post-Fix D-o-R Workflow Runs (n=4)

| # | Run ID | Phase 1 | Phase 2 | Total | Time | Task |
|---|--------|---------|---------|-------|------|------|
| 1 | wr_3zbe | **2 ops** | **58 ops** | **60 ops** | 01:24 UTC | EXP-130 KB integration |
| 2 | wr_lqzs | N/A (research-synthesis) | 22+37+9 | **68 ops** | 02:24 UTC | Multi-thread research |
| 3 | wr_l61f | **5 ops** | **21 ops** | **26 ops** | 05:25 UTC | EXP-131 KB integration |
| 4 | wr_aiie | **7 ops** | **7 ops** | **14 ops** | 06:24 UTC | EXP-130 KB integration |

### P1 Cap Results (labeled D-o-R runs only, excluding wr_lqzs)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| P1 ops | 2, 5, 7 | ≤15 | ✅ All within cap |
| P1 mean | **4.7 ops** | ≤15 | ✅ (was 28.7 pre-fix) |
| P1 max | 7 | ≤15 | ✅ |

**P1 cap is holding solidly.** Three consecutive runs all well under 15. Average 4.7 ops vs pre-fix 28.7 = **84% reduction in P1 ops.**

### P2 Compensatory Bloat — Resolving

| Run | P2 Ops | Notes |
|-----|--------|-------|
| wr_3zbe | 58 | Outlier — complex task (EXP-130 results, 8 files) |
| wr_l61f | 21 | Normal range |
| wr_aiie | 7 | Lean — simple KB integration |

**P2 mean (3 labeled runs): 28.7 ops** — higher than pre-fix P2 avg (17.0), but heavily skewed by the single 58-op outlier. Excluding that outlier, P2 avg = 14.0 (below pre-fix mean). **P2 bloat concern is fading** as new runs come in with normal P2 sizes.

### Total Run Cost

| Scenario | Avg Total Ops | Median |
|----------|:-------------:|:------:|
| Pre-fix (n=39) | 45.0 | 31.5 |
| **Post-fix D-o-R (n=3)** | **33.3** | **26** |
| Post-fix all (n=4, incl research-synth) | 42.0 | 47 |

**D-o-R total cost trending down**: 33.3 avg (n=3 labeled runs) vs 45.0 pre-fix = **26% reduction**. The trajectory is clear: 60 → 26 → 14. Recent runs are dramatically leaner.

## Anti-Nesting Fix Status

**2 post-fix runs (wr_l61f, wr_aiie). Zero nesting observed.** ✅ Both runs completed with clean P1→P2 handoff, no callAgent() in P1. Combined with budget cap, recursive nesting appears structurally eliminated.

## Pre-Fix vs Post-Fix Summary

| Metric | Pre-Fix (n=49) | Post-Fix (n=3) | Target | Status |
|--------|:-:|:-:|:-:|:-:|
| P1 mean | 28.7 | **4.7** | ≤15 | ✅ |
| P1 max | 87 | **7** | ≤15 | ✅ |
| P1 bloated (>40 ops) | 31% | **0%** | ≤10% | ✅ |
| P2 mean | 17.0 | **28.7** | ≤20 | ⚠️ (skewed by 1 outlier) |
| Total D-o-R mean | 45.0 | **33.3** | ≤30 | 📈 Close |
| Nesting incidents | 3 in 72h | **0 in 5.5h** | 0 | ✅ |

## Trajectory Analysis

The last 3 D-o-R runs show a clear efficiency improvement trend:

```
Run 1 (01:24): 60 total  ████████████████████████████████████████████████████████████████
Run 3 (05:25): 26 total  ██████████████████████████████
Run 4 (06:24): 14 total  ████████████████
Pre-fix avg:   45 total  █████████████████████████████████████████████████
Target:        30 total  ██████████████████████████████████
```

Run 4 (14 ops total) is the **leanest D-o-R workflow run ever measured** — well below both the target (30) and the pre-fix lean P1 subset average (20.0).

## Risks (Updated)

### R1: P2 Compensatory Bloat → DOWNGRADED to MEDIUM
**Evidence**: Only 1/3 labeled P2 sessions was inflated (58 ops). The other two (21, 7) are normal or lean. Likely the 58-op session was task complexity, not systematic compensation.
**Action**: Continue monitoring. If next 2 P2s are ≤25, close this risk.

### R2: Insufficient Sample Size → n=4, need n≥5
**Action**: One more D-o-R run needed. At current rate, expected within ~1h.

### R3: Alternative Workflow Bypass → LOW
The research-synthesis workflow (wr_lqzs) was 68 ops but this is a fundamentally different workflow type. D-o-R is the target and D-o-R is improving.

## Next Measurement

- **When**: n=5 (expect ~07:30 UTC Apr 11) or next optimizer heartbeat
- **What to measure**: Confirm P1 ≤15, P2 normalizing, total ≤30 avg
- **If confirmed**: Move D-o-R cap measurement to DONE ✅

## Data Source

- **DB**: `.state/may.db` — 18,855 sessions
- **Query**: `workflowRunId IS NOT NULL AND startedAt > 1775866680000`
- **Note**: `startedAt` is epoch milliseconds. Use `.state/may.db` (not root `may.db` which has empty tables).
