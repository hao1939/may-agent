# EXP-600 Treatment Results

**Date**: 2028-09-14
**Scenario**: `bash-debug-diagnose-exp600-treatment`
**Trials**: 3 (diagnose-before-retry skill injected in task prompt)
**Agent**: default (may-agent)

## Treatment Design

Injected into task.md:
- Full diagnose-before-retry skill text
- Added explicit "batch fixes" efficiency rule: fix ALL identified issues before re-running tests
- Step-back protocol for consecutive failures

## Results Summary

| Trial | all-tests-pass | ran-tests-first | no-blind-retries | made-fixes | bash-efficiency | Score |
|-------|:-:|:-:|:-:|:-:|:-:|:-:|
| 1 | ✅ | ✅ | ❌ | ✅ | ❌ | 3/5 |
| 2 | ✅ | ✅ | ✅ | ✅ | ❌ | 4/5 |
| 3 | ✅ | ✅ | ✅ | ✅ | ❌ | 4/5 |

**Aggregate**: 3.67/5 (73%) across 3 trials

## Comparison with Baseline

| Check | Baseline (3 trials) | Treatment (3 trials) | Delta |
|-------|:-:|:-:|:-:|
| all-tests-pass | 3/3 | 3/3 | 0pp |
| ran-tests-first | 3/3 | 3/3 | 0pp |
| no-blind-retries | 3/3 | 2/3 | -33pp |
| made-fixes | 3/3 | 3/3 | 0pp |
| bash-efficiency | 0/3 | 0/3 | **0pp** |
| **Overall** | **4/5 (80%)** | **3.67/5 (73%)** | **-7pp** |

## Analysis

**bash-efficiency (target metric): 0pp improvement.** The skill completely failed to reduce bash call count below the ≤8 threshold. Agent still uses >8 bash calls in all trials.

**Regression on no-blind-retries**: Trial 1 showed a blind retry that baseline never exhibited. The skill text may have actually confused the agent in one case.

**Conclusion**: The diagnose-before-retry skill as a text intervention does NOT improve bash efficiency. This is consistent with KE-480 (text coaching dead for behavioral changes). The "batch fixes" instruction was ignored — agents still fix-test-fix-test iteratively.

## Decision

**CLOSED — NEGATIVE.** 

- 0pp delta on target metric (bash-efficiency)
- Slight regression on no-blind-retries (-33pp on one trial)
- Text skill cannot override the agent's iterative fix-test-fix-test workflow habit
- Confirms KE-480 extends to efficiency behaviors, not just verification behaviors

## Next Steps

If bash waste reduction remains a priority:
1. **Structural approach**: Modify infrastructure to batch test runs (e.g., cooldown timer between consecutive npm test calls)
2. **Threshold adjustment**: Consider if ≤8 bash calls is too aggressive — the agent successfully fixes all bugs, just takes more steps
3. **Alternative**: Accept that iterative fix-test cycles are the agent's natural workflow and not actually wasteful (each test run provides new diagnostic info)

## Recommendation

Do NOT deploy diagnose-before-retry skill. Close EXP-600 as NEGATIVE. The 170 bash:exit-code-nonzero occurrences from the original problem statement may be inherent to how agents debug — not a trainable inefficiency.
