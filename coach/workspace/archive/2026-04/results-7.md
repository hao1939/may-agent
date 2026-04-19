# EXP-056: C2.3 Timeout Sensitivity — RESULTS

**Status**: COMPLETE
**Sprint**: 20
**Completed**: 2026-04-07
**Parent**: EXP-055b

## Question
Does the baseline agent consistently pass C2.3 (verify-after-edit) at 7-minute timeout?

## Hypothesis (H-087)
C2.3 failure is purely budget-driven. With 7-minute timeout, the baseline agent will pass C2.3 at ≥80% rate.

## Results

### EXP-056 Runs (N=8)
| Run | Scenario | Product (3 bugs) | C1 (read-before-edit) | C2.3 (verify-after-edit) | Total | Duration |
|-----|----------|-------------------|----------------------|--------------------------|-------|----------|
| 1 | read-before-edit --timeout 7 | 3/3 ✅ | 4/4 ✅ | ❌ FAIL | 10/11 | 53s |
| 2 | read-before-edit --timeout 7 | 3/3 ✅ | 4/4 ✅ | ❌ FAIL | 10/11 | 83s |
| 3 | read-before-edit --timeout 7 | 3/3 ✅ | 4/4 ✅ | ❌ FAIL | 10/11 | ~18s |
| 4 | read-before-edit --timeout 7 | 3/3 ✅ | 4/4 ✅ | ❌ FAIL | 10/11 | 25s |
| 5 | read-before-edit --timeout 7 | 3/3 ✅ | 4/4 ✅ | ❌ FAIL | 10/11 | ~12s |
| 6 | read-before-edit --timeout 7 | 3/3 ✅ | 4/4 ✅ | ❌ FAIL | 10/11 | 71s |
| 7 | read-before-edit --timeout 7 | 3/3 ✅ | 4/4 ✅ | ❌ FAIL | 10/11 | 11s |
| 8 | read-before-edit-7min | 3/3 ✅ | 4/4 ✅ | ❌ FAIL | 10/11 | 73s |

**C2.3 pass rate: 0/8 (0%)**

### Combined with EXP-055b (N=9)
Including the 1 baseline run from EXP-055b that passed C2.3:

**Combined C2.3 pass rate: 1/9 (11%)**

### Cross-Experiment Comparison
| Experiment | Timeout | N | C2.3 Rate | Product Rate | Total |
|-----------|---------|---|-----------|--------------|-------|
| EXP-055 baseline | 5 min | 3 | 0/3 (0%) | 3/3 (100%) | 10/11 |
| EXP-055b baseline | 7 min | 1 | 1/1 (100%) | 1/1 (100%) | 11/11 |
| **EXP-056 baseline** | **7 min** | **8** | **0/8 (0%)** | **8/8 (100%)** | **10/11** |
| **Combined 7min** | **7 min** | **9** | **1/9 (11%)** | **9/9 (100%)** | — |

## Analysis

### HYPOTHESIS REJECTED
C2.3 failure is **NOT** purely budget-driven. With 7-minute timeout and N=8, the baseline achieves 0% C2.3 pass rate — identical to the 5-minute baseline (0/3).

### The EXP-055b Result Was a Fluke
The single baseline run in EXP-055b that passed C2.3 (11/11) was an outlier. With 8 additional runs, the true C2.3 pass rate at 7 minutes is ~11% (1/9), not materially different from 0% (0/3) at 5 minutes. Fisher's exact test: p = 0.25 (not significant).

### Key Observations

1. **Duration is irrelevant**: Runs ranged from 11s to 83s — all well under the 7-minute limit. The agent finishes quickly regardless. Extra time doesn't help because the agent doesn't use it.

2. **C2.3 is a behavioral gap, not a budget gap**: The agent completes all product fixes and C1 checks in under 90 seconds. It has 5+ minutes of unused budget. The issue is that the agent doesn't _choose_ to verify after editing — it's not that it _can't_.

3. **Product quality is rock-solid**: 11/11 product checks across all 8 runs (plus all prior experiments). The coder never fails the actual bug fixes or preservation checks.

4. **Budget gap hypothesis was premature**: The EXP-055b conclusion was based on N=1. This is a cautionary example of why small sample sizes are dangerous.

## Implications

### What This Means for C2.3
- **Not fixable by timeout increase** — agent has plenty of time, doesn't verify
- **Not fixable by text skills** — EXP-020 showed verify-after-edit skill has 0% effect
- **Not fixable by verification gates** — EXP-055/055b showed gates cause product regression
- **C2.3 is a deep behavioral pattern** that resists all tested interventions

### Remaining Options
1. **Tool-level enforcement**: Auto-read-back after every edit (framework change, not agent change)
2. **Workflow enforcement with budget accommodation**: A lighter-weight gate that adds verification without the rigid multi-step ceremony that hurt parser-bug
3. **Accept C2.3 as non-fixable at agent level**: Document as a known limitation

### EXP-055b Conclusions Revised
The EXP-055b recommendation to "just increase timeout" is **invalidated**. The correct interpretation:
- Gate-driven product regression: CONFIRMED (this finding stands)
- Baseline passes C2.3 with more time: **REJECTED** (the 1/1 was a fluke)
- "DO NOT DEPLOY verification gates": Still valid (they hurt product quality)
- "Simple solution of more time": **Invalid** (more time doesn't fix C2.3)

## Conclusion

C2.3 (verify-after-edit) failure on read-before-edit is a **genuine behavioral gap** that cannot be fixed by:
- Text-based skills (EXP-020: 0%)
- Timeout increases (EXP-056: 0/8 at 7min)
- Verification gates (EXP-055: causes product regression)

This is one of the few truly intractable convention violations at the agent level. It likely requires **framework-level enforcement** (automatic post-edit readback) to fix reliably.

## Raw Data
- Runs 1-7: `read-before-edit` scenario with `--timeout 7` flag
- Run 8: `read-before-edit-7min` scenario (identical files, timeout in scenario.json)
- Agent: stock coder (no lab forks)
- All runs: product 3/3, C1 4/4, C2.3 FAIL → 10/11 total
