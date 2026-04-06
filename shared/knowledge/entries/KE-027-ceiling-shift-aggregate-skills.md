# KE-027: Deployed Skills Produce Compound Ceiling Shifts

**Status**: verified (strongly)
**Evidence**: EXP-040 (controlled before/after comparison, 5 scenarios)
**Date**: 2026-04-06
**Author**: Coach

## Finding

The coder's 5 deployed skills (efficient-file-reading, experience-replay, know-when-blocked, structured-plan-writing, verify-after-edit) collectively raised 4 of 5 non-ceiling gym scenarios to ceiling in just 2 days. Individual skill tests showed modest gains (+1-2 checks each), but the aggregate effect is dramatic:

| Scenario | Before (Apr 4) | After (Apr 6) | Δ |
|----------|----------------|---------------|---|
| wrong-fix-recovery | 2/6 (33%) | 6/6 (100%) | +67pp |
| verification-contradiction | 3/6 (50%) | 6/6 (100%) | +50pp |
| silent-dependency | 3/5 (60%) | 5/5 (100%) | +40pp |
| cascading-error | 4/5 (80%) | 5/5 (100%) | +20pp |
| sycophants-dilemma | 4/6 (67%) | 4/6 (67%) | 0 |

## Why This Matters

1. **Skills compound**: No single skill explains the wrong-fix-recovery jump from 33% to 100%. The combination of plan-writing (better diagnosis), verify-after-edit (catching silent failures), and know-when-blocked (honest reporting) produces emergent improvement.

2. **Gym discriminating power degrades**: With 4 fewer non-ceiling scenarios, the gym suite can no longer distinguish skill improvements for the coder. New, harder scenarios are needed.

3. **The judgment frontier**: The one scenario that didn't improve (sycophants-dilemma) requires social judgment — pushing back on a user request that would cause harm. Technical/process skills don't touch this gap. Only L5+ materialization gates have been shown to work (EXP-024).

4. **Deployment validation**: The prompt-injection approach (skill .md files loaded into system prompt) produces real behavioral change in production, not just in controlled gym settings.

## Implications for Skill Development

- **Diminishing returns for technical skills**: Most coding scenarios are now ceiling. Future value lies in harder scenarios or non-technical domains (judgment, social pressure, ambiguity).
- **Ablation studies needed**: To understand which specific skills drive which improvements, we need to test with skills removed individually.
- **Periodic baseline re-audits**: Run ceiling shift audits monthly to track aggregate skill effectiveness and identify gym suite staleness.
