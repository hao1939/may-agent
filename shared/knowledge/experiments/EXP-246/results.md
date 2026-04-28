# EXP-246: Results

**Status**: INCONCLUSIVE — SHELVED

## Summary

Removing 3 meta-skills (escalation, reading-metrics, closing-the-loop) from the coder agent yielded 9/20 (45%) on the revised core-20 scenario set vs 15/20 (75%) baseline on the original core-20 set. However, the scenario sets differ, and on 6 matched scenarios, no clear skill effect was observed. N=1 per scenario is too noisy for conclusions. Shelved in favor of higher-value experiments.

## Data

| Arm | N | Pass rate | Notes |
|-----|---|-----------|-------|
| A (Baseline, original core-20) | 20 | 75% (15/20) | From Jun 2027 baseline |
| B (3 skills removed, revised core-20) | 20 | 45% (9/20) | Different scenario set; 6 matched scenarios show no clear effect |

## Analysis

The 45% vs 75% headline is misleading — different scenario sets. On 6 matched scenarios: 3 same, 1 regression (by 1 check), 1 improvement (scenario bug fix, not skill-related). Many "failures" are marginal (5/6, 8/9, 9/11 checks). A proper test would need 120 runs (~$12) for statistical power.

## Conclusion

**INCONCLUSIVE.** The removed meta-skills don't clearly affect coding scenario outcomes at N=1. Shelved — the cost of a powered replication exceeds expected information value. Recommendation: restore removed skills and pursue EXP-243 (skill reframing) instead.

## Followups

- Restore 3 removed skills to coder (done)
- EXP-243: Skill reframing experiment (higher expected value per DD893/KE-403)
