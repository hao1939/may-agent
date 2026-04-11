# Finding: D-o-R Phase 1 Budget Cap — Early Measurement

**Date**: 2026-04-11 02:54 UTC (2h post-deployment)
**Fix**: Commit 40b22057, deployed ~2026-04-11 00:58 UTC
**Status**: EARLY SIGNAL — only 1 post-fix D-o-R run with Phase 1

## Summary

The Phase 1 budget cap (15-op limit in prompt) appears to be working. The single post-fix D-o-R run completed Phase 1 in **2 ops** vs the pre-fix average of **32 ops**. However, with n=1, this is a promising signal, not a conclusion.

## Post-Fix Data (n=1)

| Workflow Run | Phase 1 Ops | Phase 2 Ops | Total Ops | Time |
|---|---|---|---|---|
| wr_1775870693928_3zbe | **2** | 58 | 60 | 2026-04-11 01:24 |

- Phase 1 prompt now shows: "## Phase 1: Analyze & Plan — BUDGET: 15 TOOL CALLS MAX"
- The single P1 session used 2 ops (well under the 15-op budget)
- Phase 2 used 58 ops (this is normal — P2 does the actual writing)

## Pre-Fix Baseline (n=38, last 72h)

| Metric | Value |
|---|---|
| Mean P1 ops | 32.2 |
| Median P1 ops | 30 |
| P25 | 8 |
| P75 | 44 |
| P90 | 74 |
| Max | 100 |
| Sessions above 15 ops | 24/38 (63%) |
| Ops above 15-op cap | 763 total |
| Pre-fix total workflow avg | 48.0 ops |

### Pre-fix P1 distribution
```
2-15 ops:  ████████████████ 14 sessions (37%)
16-30 ops: ████████ 6 sessions (16%)
31-50 ops: ████████████ 8 sessions (21%)
51-75 ops: ██████████ 5 sessions (13%)
76-100 ops: ██████████ 5 sessions (13%)
```

## Bob's 90-op and 100-op Sessions

Both were **pre-fix**:
- 90-op P1: 2026-04-10T23:28 (30 min before fix deploy)
- 100-op P1: 2026-04-10T19:25 (5.5h before fix deploy)

## Non-D-o-R Workflow Note

A second post-fix workflow run (wr_1775874282767_lqzs, 68 ops) used a different structure ("Research Thread" parallel pattern, not Phase 1/2/3). This run is not comparable — different workflow, different phase structure.

## Projected Impact (if 2-op P1 holds)

| Metric | Pre-Fix | Post-Fix (projected) | Savings |
|---|---|---|---|
| Avg P1 ops | 32.2 | ~5-10 (conservative) | 69-84% |
| Avg total D-o-R ops | 48.0 | ~20-30 | 38-58% |
| Daily D-o-R ops (est. 12 runs/day) | 576 | 240-360 | 216-336 ops/day |
| Daily savings ($) | — | — | ~$10-16/day |

## Next Steps

1. **Recheck at 12h post-fix** (~2026-04-11 13:00 UTC): Need n≥5 D-o-R runs for statistical confidence.
2. **Watch for Phase 2 bloat**: If P1 is constrained but P2 inflates (compensatory bloat), the fix is net-neutral. The post-fix P2 used 58 ops — monitor this.
3. **If P1 avg >20 at 12h mark**: Escalate to runtime maxOps enforcement (Option A from original analysis).

## Conclusion

**Promising early signal.** The budget cap text is appearing in prompts and the first post-fix P1 completed in 2 ops (94% below pre-fix average). Need more data to confirm. The structural fix (text prompt with budget language) appears sufficient — no need for runtime enforcement yet.
