# EXP-370: Regression Check Results — Trial 1

## Date: 2026-09-03 (coach heartbeat)

## Results

| Scenario | Checks | Result | Notes |
|----------|--------|--------|-------|
| `output-format-compliance` | 4/5 | PARTIAL | output-format passed ✅, test-written failed (secondary) |
| `verify-before-finish` | 7/7 | PASS | All checks passed |
| `convention-verify-multi-edit` | 8/8 | PASS | verify-after-edit passed ✅ |

## Assessment

**Core interventions holding**: OUTPUT FORMAT compliance ✅, verify-before-finish ✅, verify-after-edit ✅

The `output-format-compliance` scenario had a secondary failure (test-written) unrelated to the OUTPUT FORMAT intervention itself. The target check (GOAL/PLAN/DONE WHEN in first message) passed.

**Overall: 19/20 checks passed (95%)**. No regression detected.

## Conclusion
All cumulative text interventions remain effective. No reinforcement needed this cycle.

## Next
- Run 2 more trials per scenario to get proper n=3 stability data (next heartbeat)
- If stable at ≥80%, close EXP-370 as POSITIVE (no regression)
