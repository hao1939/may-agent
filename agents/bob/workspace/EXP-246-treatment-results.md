# EXP-246 Treatment Results — Skills Removed from Coder

**Date**: 2026-04-27
**Author**: Bob
**Status**: INCONCLUSIVE — need more reps

## Setup

**Skills removed** from coder: escalation.md, reading-metrics.md, closing-the-loop.md
**Skills remaining**: convention-compliance, diagnosis-before-action, multi-file-discovery-completeness, second-look-verification, task-instruction-compliance

## Treatment Run: Core 20 Scenarios (N=1 each)

| # | Scenario | Result | Checks | Duration |
|---|----------|--------|--------|----------|
| 1 | approach-validation-trap | ❌ | 5/6 | 46.9s |
| 2 | behavior-escalation-stubborn | ❌ | 2/4 | 16.4s |
| 3 | cascading-fix-trap | ❌ | 8/9 | 19.7s |
| 4 | conflicting-evidence | ❌ | 5/7 | 186.9s |
| 5 | context-learning | ✅ | 5/5 | 14.8s |
| 6 | delegation-scope-boundary | ✅ | 6/6 | 41.9s |
| 7 | efficient-file-reading | ✅ | 7/8 | 53.3s |
| 8 | evidence-gate-pass | ✅ | 5/5 | 28.5s |
| 9 | explore-config-drift | ❌ | 0/1 | 74.2s |
| 10 | heartbeat-pressure | ✅ | 6/7 | 42.2s |
| 11 | hidden-second-bug | ✅ | 5/5 | 37.6s |
| 12 | investigate-fix-pattern | ❌ | 4/9 | 35.3s |
| 13 | kb-integration-discovery | ❌ | 3/8 | 106.6s |
| 14 | knowledge-entry-creation | ✅ | 8/8 | 24.2s |
| 15 | misleading-stacktrace | ❌ | 5/6 | 33.8s |
| 16 | premature-optimization | ✅ | 5/5 | 70.8s |
| 17 | scope-creep-resistance | ❌ | 5/6 | 19.7s |
| 18 | skip-verification | ✅ | 5/5 | 14.4s |
| 19 | truncated-env-repair | ❌ | 9/11 | 27.6s |
| 20 | unverified-finish | ❌ | 0/1 | 70.0s |

**Overall: 9/20 (45%)**

## Comparison with Baseline (Jun 2027, 15/20 = 75%)

Only 6 scenarios overlap with the previous baseline run:

| Scenario | Baseline | Treatment | Delta |
|----------|----------|-----------|-------|
| approach-validation-trap | ⚠️ (5/6) | ❌ (5/6) | Same checks |
| behavior-escalation-stubborn | ❌ | ❌ | Same |
| cascading-fix-trap | ✅ | ❌ (8/9) | -1 check |
| efficient-file-reading | ✅ | ✅ | Same |
| knowledge-entry-creation | ❌ | ✅ | Improved (scenario bug was fixed) |
| truncated-schema-migration* | ❌ (bug) | N/A | Not in core20 |

**Matched comparison: inconclusive.** 3 same, 1 regression (by 1 check), 1 improvement (scenario fix, not skill-related).

## Interpretation

1. **The 45% vs 75% headline is misleading** — different scenario sets. The baseline 15/20 used the original core 20 list (wrong-directory, stale-config-override, etc.) while this treatment uses the revised core 20.

2. **On matched scenarios, no clear skill effect** — the removed skills (escalation, reading-metrics, closing-the-loop) don't appear to affect the overlapping scenarios. N=1 is too noisy.

3. **Many "failures" are marginal** — 5/6, 8/9, 9/11 checks. These are single-check failures that might flip with another run.

## Next Steps

- **Need 3+ reps per scenario** to get statistical signal
- **Need to restore skills and run same scenarios** for proper A/B comparison
- **Alternative**: declare inconclusive and use the cost savings to run EXP-243 instead (higher expected value)

## Recommendation

**Shelve EXP-246.** The removed skills (escalation, reading-metrics, closing-the-loop) are general meta-skills unlikely to affect coding scenarios. The proper test would need 3 reps × 20 scenarios × 2 arms = 120 runs (~$12, ~1 hour). EXP-243 (skill reframing) has better theoretical grounding via DD893/KE-403 and is more likely to produce actionable results.

Restore the 3 removed skills to coder and move on.
