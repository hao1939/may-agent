# Finding: D-o-R Phase 1 Cap Measurement — 12h Check (Update 3)

**Date**: 2026-04-11 04:24 UTC (~3.5h post P1 cap, ~0.5h post anti-nesting fix)
**Fix 1**: Phase 1 budget cap (commit 40b22057, deployed ~00:58 UTC)
**Fix 2**: Anti-nesting instruction (commit 60a844e3, deployed ~03:54 UTC)
**Status**: INSUFFICIENT DATA — only n=1 post-fix D-o-R run

## 12h Measurement Results

### Post-Fix D-o-R Workflow Run (n=1)

Only **one** D-o-R workflow run occurred since the P1 budget cap was deployed:

| Run | Phase 1 | Phase 2 | Total | Time |
|-----|---------|---------|-------|------|
| wr_1775870693928_3zbe | **2 ops** | **58 ops** | **60 ops** | 01:24 UTC |

**P1 result**: 2 ops — well within the 15-op cap ✅
**P2 concern**: 58 ops — this is at the **95th percentile** for Phase 2 sessions

### Why Only n=1?

The system ran only one D-o-R workflow in the 3.5 hours since the fix because:
- Bob had limited dispatchable work (EXP-130 KB integration was the only queued D-o-R task)
- The second workflow run (wr_1775874282767_lqzs, 68 ops total) used a **different workflow format** ("Research Thread" phases, not Phase 1/2/3) — this is likely the `research-synthesis` workflow, not `deliver-or-report`

### Statistical Confidence

**Cannot confirm P1 avg ≤15 ops with n=1.** Need n≥5 for minimal confidence.

## Phase 2 Compensatory Bloat — Early Signal

The single post-fix P2 session used **58 ops** vs pre-fix P2 avg of **17.0 ops** (median 13).

### P2 Distribution Context (last 50 P2 sessions)

| Metric | Value |
|--------|-------|
| Mean | 17.0 |
| Median | 13 |
| P25 | 9 |
| P75 | 20 |
| P95 | ~58 |
| Max | 83 |

The 58-op P2 is a real outlier — only 2 out of 50 P2 sessions hit ≥58. Two scenarios:

1. **Compensatory bloat**: P2 is doing work that P1 would normally do because P1 was constrained to 2 ops. The total run (60 ops) is worse than the pre-fix average (45.0 ops).
2. **Coincidence**: This was a complex KB integration task (EXP-130 results). Some P2 sessions are naturally expensive. The 83-op P2 maximum occurred pre-fix.

**Verdict**: Cannot distinguish with n=1. Need more runs to see if P2 inflation is systematic.

### Total Run Cost Comparison

| Scenario | Avg Total Ops |
|----------|:-------------:|
| Pre-fix (n=39) | 45.0 |
| Post-fix (n=1) | **60** |
| Pre-fix lean P1s only (n=12, P1≤15) | 20.0 |

The post-fix run is **33% more expensive** than the pre-fix average, primarily due to P2 bloat. However, pre-fix lean P1 runs averaged only 20.0 total ops — suggesting that when P1 is lean AND P2 behaves normally, the fix works. The question is whether P2 will normalize.

## Anti-Nesting Fix Status

**No post-fix data.** Zero D-o-R workflow runs have occurred since the anti-nesting fix was deployed at 03:54 UTC. The fix adds "DO NOT call callAgent() or spawn sub-agents" to Phase 1.

## Pre-Fix vs Post-Fix Summary

| Metric | Pre-Fix (n=49) | Post-Fix (n=1) | Target |
|--------|:-:|:-:|:-:|
| P1 mean | 28.7 | **2** | ≤15 ✅ |
| P1 median | 20 | 2 | ≤15 |
| P1 bloated (>40 ops) | 31% | 0% | ≤10% |
| P2 mean | 17.0 | **58** | ≤20 ⚠️ |
| Total run mean | 45.0 | **60** | ≤30 ❌ |

## All Workflow Runs in Last 24h (for context)

25 workflow runs since Apr 10 04:00 UTC. Op distributions:

| Period | Runs | Avg Total | Median Total | Range |
|--------|------|-----------|--------------|-------|
| Pre-fix (24 runs) | 24 | 43.1 | 31.5 | 5-127 |
| Post-fix D-o-R (1 run) | 1 | 60 | 60 | 60 |
| Post-fix research-synthesis (1 run) | 1 | 68 | 68 | 68 |

## Risks & Recommendations

### R1: P2 Compensatory Bloat (HIGH)
**Risk**: Constrained P1 may push work into P2, negating savings.
**Evidence**: P2=58 ops (P95 for Phase 2) in the single post-fix run.
**Mitigation**: Monitor next 5 D-o-R runs. If P2 avg > 25 ops (vs pre-fix 17), add P2 budget guidance (not a hard cap — P2 is where actual work happens).

### R2: Insufficient Sample Size (HIGH)
**Risk**: Cannot draw conclusions from n=1.
**Action**: Remeasure when n≥5 post-fix D-o-R runs exist. At current run rate (~13/day), this should happen within 12h.

### R3: Alternative Workflow Bypass
**Risk**: The `research-synthesis` workflow (wr_1775874282767_lqzs) doesn't use Phase 1/2/3 format. If D-o-R tasks get routed through this workflow, the P1 cap is irrelevant.
**Action**: Confirm that the research-synthesis workflow has its own efficiency controls.

## Next Measurement

- **When**: At ~16:00 UTC Apr 11 (or when n≥5 post-fix D-o-R runs exist)
- **What to measure**:
  1. P1 ops distribution (expect all ≤15)
  2. P2 ops distribution (watch for inflation above 20 avg)
  3. Total run cost (target: ≤30 avg)
  4. Any nested workflow spawning (expect zero)

## Data Source

- **DB**: `.state/may.db` — 18,812 sessions
- **Query used**: `startedAt >= 1775866680000` (Apr 11 00:58 UTC) with `workflowRunId IS NOT NULL`
- **Note**: `startedAt` field is epoch milliseconds, not ISO string. Parameterized queries fail due to type mismatch; use inline values.
