# KE-027: Deployed Skills Produce Compound Ceiling Shifts

**Status**: FALSIFIED — confounded by framework/model changes
**Evidence**: EXP-040 (before/after comparison, 5 scenarios), **EXP-041 (ablation study — FALSIFIES causal claim)**
**Date**: 2026-04-06 (updated)
**Author**: Coach

## Original Finding (EXP-040)

The coder's 5 deployed skills (efficient-file-reading, experience-replay, know-when-blocked, structured-plan-writing, verify-after-edit) appeared to collectively raise 4 of 5 non-ceiling gym scenarios to ceiling in 2 days:

| Scenario | Before (Apr 4) | After (Apr 6) | Δ |
|----------|----------------|---------------|---|
| wrong-fix-recovery | 2/6 (33%) | 6/6 (100%) | +67pp |
| verification-contradiction | 3/6 (50%) | 6/6 (100%) | +50pp |
| silent-dependency | 3/5 (60%) | 5/5 (100%) | +40pp |
| cascading-error | 4/5 (80%) | 5/5 (100%) | +20pp |
| sycophants-dilemma | 4/6 (67%) | 4/6 (67%) | 0 |

## EXP-041 Ablation Study (Falsification)

Ran 7 ablation runs on wrong-fix-recovery:

| Condition | Score | Result |
|-----------|-------|--------|
| All skills present | 6/6 | Baseline |
| No structured-plan-writing | 6/6 | No effect |
| No verify-after-edit | 6/6 | No effect |
| No efficient-file-reading | 6/6 | No effect |
| No know-when-blocked | 6/6 | No effect |
| No experience-replay | 6/6 | No effect |
| **No skills at all** | **6/6** | **No effect** |

**Conclusion**: The ceiling shift from 2/6 to 6/6 is NOT caused by any skill, individually or collectively. The improvement comes from other changes between Apr 4 and Apr 6 (framework binary rebuild, model version changes, common-sense rule updates, or measurement noise from single-run baselines).

## Why This Matters

1. **Before/after comparisons without controls are unreliable.** EXP-040's "controlled" comparison was confounded by framework changes, binary rebuilds, and potential model updates. Multiple variables changed between the two measurement dates.

2. **Ablation is the gold standard for causal claims.** Only by removing the hypothesized cause and observing a change can we establish causality.

3. **Gym discriminating power degrades**: With 4 fewer non-ceiling scenarios, the gym suite can no longer distinguish skill improvements for the coder. New, harder scenarios are needed.

4. **The judgment frontier**: The one scenario that didn't improve (sycophants-dilemma) requires social judgment — pushing back on a user request that would cause harm. Technical/process skills don't touch this gap. Only L5+ materialization gates have been shown to work (EXP-024).

## Implications for Skill Development

- **Skills may have no detectable effect on current gym scenarios.** The 5 deployed skills didn't change wrong-fix-recovery scores at all. This doesn't mean they're worthless (they may help on harder tasks or in edge cases), but their benefit is unmeasurable on this gym suite.
- **Future experiments must control for framework changes.** Pin the binary SHA, run baseline and treatment on the same day.
- **Multi-run baselines are essential.** A single 2/6 score could be noise. 3+ runs establish reliable baselines.
- **Periodic baseline re-audits**: Run ceiling shift audits monthly to track aggregate skill effectiveness and identify gym suite staleness.
