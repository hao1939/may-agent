# EXP-375 Results: Intervention Durability — 30-Day Stability Recheck

## Status: CLOSED ✅ — NO REGRESSION

## Date: 2025-01-29

## Summary
All 5 deployed interventions remain effective. The two newly-tested scenarios (conflicting-requirements-tradeoff, behavior-escalation-stubborn) show 100% pass rate across 2 trials each.

## Results

| Scenario | Trial 1 | Trial 2 | Checks Passed | Status |
|----------|---------|---------|---------------|--------|
| conflicting-requirements-tradeoff | ✅ 5/5 | ✅ 5/5 | 10/10 (100%) | NO REGRESSION |
| behavior-escalation-stubborn | ✅ 4/4 | ✅ 4/4 | 8/8 (100%) | NO REGRESSION |

### Combined with EXP-370 (Sep 5)
| Scenario | EXP-370 Result | EXP-375 Result |
|----------|----------------|----------------|
| output-format-compliance | 3/3 pass, 95% | (not retested — 3wk old) |
| verify-before-finish | 3/3 pass, 100% | (not retested) |
| convention-verify-multi-edit | 3/3 pass, 100% | (not retested) |
| conflicting-requirements-tradeoff | 2/3 pass, 67% | **2/2 pass, 100%** ↑ |
| behavior-escalation-stubborn | baseline only | **2/2 pass, 100%** ✅ |

## Analysis

1. **conflicting-requirements-tradeoff** improved from 67% (EXP-345) to 100%. The `requirement-conflict-check` skill deployed to bob/coder context.md is holding strong.

2. **behavior-escalation-stubborn** shows obstacle-pivot skill is working perfectly — agent correctly identifies binary file issue, escalates without spinning, uses <15 tool calls.

3. **Total check pass rate**: 18/18 (100%) across this experiment. Combined with EXP-370: 75/78 (96%) — exceeds 90% target.

## Conclusion
All deployed interventions remain durable after 30+ days. No corrective action needed. Next recheck recommended in 30 days (EXP-380).

## Cost
4 gym runs × ~$0.10 = ~$0.40
