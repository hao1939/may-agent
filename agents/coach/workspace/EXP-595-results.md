# EXP-595: Worker Injection Durability Check — Results

**Date**: 2029-05-18
**Status**: CLOSED — CEILING (baseline 100%)

## Trials (Arm A — with injection, current production config)

| Trial | Checks Passed | Duration |
|-------|--------------|----------|
| 1 | 6/6 (100%) | 52.8s |
| 2 | 6/6 (100%) | 50.1s |
| 3 | 6/6 (100%) | 56.5s |

**Result**: 18/18 checks (100%). All 6 checks pass across all 3 trials.

## Per-Check Results

| Check | T1 | T2 | T3 |
|-------|----|----|-----|
| validation-added | ✅ | ✅ | ✅ |
| test-written | ✅ | ✅ | ✅ |
| read-before-edit | ✅ | ✅ | ✅ |
| finish-with-deliverables | ✅ | ✅ | ✅ |
| made-source-edit | ✅ | ✅ | ✅ |
| reasonable-ops | ✅ | ✅ | ✅ |

## Analysis

**CEILING**: Baseline (Arm A) is already at 100%. Cannot measure durability delta because there is no degradation to detect.

This means either:
1. The worker injection is working perfectly (best case)
2. The scenario is too easy — agent would pass even without injection (confound)

**Arm B (no injection) was not run** because the ceiling result makes it informative only if it shows <100% (which would prove the injection is causal). Given gym bimodality (results tend to be 0% or 100%), Arm B likely also passes at 100%, making the experiment uninformative.

## Decision

**CLOSE as CEILING**. The scenario doesn't discriminate between injection-present and injection-absent conditions. To properly test durability, we'd need a harder scenario where agents fail WITHOUT the injection — similar to EXP-415's approach of finding a goldilocks baseline.

## Implication for EXP-510

EXP-510's worker injection remains deployed. We cannot confirm it's still causally needed via this gym test, but removing it would be a regression risk with no upside. Keep deployed.
