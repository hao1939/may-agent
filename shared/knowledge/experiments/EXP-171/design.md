# EXP-171: Moderate Hints + F2 Workflow on Cascading Bugs

**Date**: 2026-04-16
**Status**: Running
**Scenario**: cascading-fix-trap-v2 (0% baseline)
**Parent**: EXP-168 (F1 dose-response)

## Research Question
Can moderate hints (problem identification without fix details) COMBINED with F2-style step-by-step execution workflow achieve intermediate results on cascading-fix-trap-v2?

## Hypothesis
EXP-168 showed moderate hints alone = 0% and EXP-165 showed F2 alone = 0%. But the combination might work because:
- Moderate hints solve the recognition bottleneck (agent knows WHAT is wrong)
- F2 workflow solves the execution bottleneck (forces structured analysis before fixing)
- Together they address both failure modes simultaneously

**Prediction**: 20-50% pass rate (better than either alone, worse than full F1)

## Arms
| Arm | Variant | Description | N | Source |
|-----|---------|------------|---|--------|
| 1 | baseline | No intervention | 56 | EXP-165/168 (reuse) |
| 2 | moderate-hint | Problem identified, no fix | 10 | EXP-168 (reuse) |
| 3 | f2 | Two-phase workflow only | 28 | EXP-165 (reuse) |
| 4 | moderate-f2 | Moderate hints + F2 workflow | 15 | **NEW** |

## Scenario Design
`cascading-fix-trap-v2-moderate-f2`: Combines moderate hint text injected into Phase 1 task prompt with F2 two-phase workflow (write ANALYSIS.md → cleared → fix bugs).

## Method
- Run 15 trials of new variant via gym-batch.sh
- Compare against reused arms from EXP-165/168
- Fisher's exact test for statistical comparison
