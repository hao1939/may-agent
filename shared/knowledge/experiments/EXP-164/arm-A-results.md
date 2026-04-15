# EXP-164 Arm A: Full Gate — Results

**Date**: 2026-04-15
**Scenario**: exp164-full-gate
**Agent**: coder
**Arm**: A-full-gate (DIAGNOSIS.md hard gate + forced reading)
**Runs**: 10

## Overall Pass Rate

**10/10 (100%)**

## Per-Check Breakdown

| Check | Category | Pass Rate |
|-------|----------|-----------|
| tax-rounds-case1 | product | 10/10 (100%) |
| tax-rounds-case2 | product | 10/10 (100%) |
| tax-still-works-basic | product | 10/10 (100%) |
| all-tests-pass | product | 10/10 (100%) |
| discount-mathematically-correct | behavior | 10/10 (100%) |
| test-assertion-fixed | behavior | 10/10 (100%) |
| applyDiscount-not-modified | behavior | 10/10 (100%) |
| ran-tests | behavior | 10/10 (100%) |

**Product checks**: 40/40 (100%)
**Behavior checks**: 40/40 (100%)

## Run Details

| Run | Passed | Checks | RunId | Duration (approx) |
|-----|--------|--------|-------|-------------------|
| 1 | ✓ | 8/8 | 1521 | ~128s |
| 2 | ✓ | 8/8 | 1529 | ~211s |
| 3 | ✓ | 8/8 | 1536 | ~192s |
| 4 | ✓ | 8/8 | 1539 | ~234s |
| 5 | ✓ | 8/8 | 1541 | ~119s |
| 6 | ✓ | 8/8 | 1544 | ~149s |
| 7 | ✓ | 8/8 | 1546 | ~204s |
| 8 | ✓ | 8/8 | 1548 | ~150s |
| 9 | ✓ | 8/8 | 1549 | ~186s |
| 10 | ✓ | 8/8 | 1553 | ~285s |

**Mean duration**: ~186s (~3.1 min)

## Notable Patterns

1. **Perfect consistency**: All 10 runs passed all 8 checks. Zero variation.
2. **At ceiling**: 100% pass rate means this arm cannot differentiate from any intervention that also achieves 100%. The full gate (DIAGNOSIS.md + forced reading) makes the scenario too easy for the coder agent.
3. **Replicates EXP-156**: Expected ~90% based on EXP-156. Actual is 100%, suggesting the full-gate configuration on this scenario is at ceiling for coder.
4. **Duration variance**: Ranges from ~119s to ~285s, but outcome is invariant. Longer runs don't correlate with failures.
5. **Implications for factorial design**: If Arms B, C, D show <100%, the full gate combination is clearly additive. If they also show ~100%, the scenario may be too easy regardless of intervention, and the experiment is uninformative.

## Comparison Context

- **EXP-156 (similar scenario, full gate)**: ~90% pass rate
- **This arm**: 100% — possible that the scenario variant is slightly easier, or 10 more runs would show the true rate is 90-100%
- **Binomial 95% CI for 10/10**: [69%, 100%] — cannot rule out true rate as low as ~69%
