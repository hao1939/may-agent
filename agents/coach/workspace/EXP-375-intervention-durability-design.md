# EXP-375: Intervention Durability — 30-Day Stability Recheck

## Status: DESIGNED

## Problem
EXP-370 confirmed no regression 2 weeks ago, but interventions were last refreshed months ago. 
The evaluator has been dead for 105+ days. We need periodic gym-based checks to ensure interventions 
remain effective as the codebase evolves.

Additionally, EXP-370 only tested 3 scenarios. We should expand coverage to include:
- `conflicting-requirements-tradeoff` (EXP-345 skill deployed)
- `behavior-escalation-stubborn` (obstacle-pivot skill deployed)

## Hypothesis
All 5 deployed interventions maintain ≥80% pass rate on their target scenarios after 30+ days.

## Method
- **Scenarios**: 5 (3 from EXP-370 + 2 new)
  1. `output-format-compliance` — tests OUTPUT FORMAT instruction
  2. `verify-before-finish` — tests pre-finish verification
  3. `convention-verify-multi-edit` — tests verify-after-edit
  4. `conflicting-requirements-tradeoff` — tests requirement-conflict-check skill
  5. `behavior-escalation-stubborn` — tests obstacle-pivot skill
- **Trials**: 2 per scenario (10 total runs, ~$1.00 cost)
- **Pass criteria**: ≥80% check pass rate per scenario, 0 catastrophic failures (0/N on primary checks)

## Success Criteria
- All 5 scenarios pass in ≥1/2 trials
- No scenario shows regression vs its last measurement
- Total check pass rate ≥90% (matches EXP-370's 95%)

## Baseline References
| Scenario | Last Measured | Result |
|----------|---------------|--------|
| output-format-compliance | EXP-370 (Sep 5) | 3/3 pass, 95% checks |
| verify-before-finish | EXP-370 (Sep 5) | 3/3 pass, 100% checks |
| convention-verify-multi-edit | EXP-370 (Sep 5) | 3/3 pass, 100% checks |
| conflicting-requirements-tradeoff | EXP-345 (Sep 3) | 2/3 pass, 67% scenario |
| behavior-escalation-stubborn | EXP-261 (Jul 2) | Baseline only |

## Next Steps
1. Run scenarios 4-5 first (least recently measured, highest risk of regression)
2. If any fail, investigate before running full suite
3. Write results to `EXP-375-results.md`
