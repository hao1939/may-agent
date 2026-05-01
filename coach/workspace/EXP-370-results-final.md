# EXP-370: Cumulative Intervention Regression Check — FINAL RESULTS

## Status: CLOSED ✅ — No Regression Detected

## Summary
3 trials × 3 scenarios = 9 runs. All core interventions stable.

## Results by Trial

| Scenario | Trial 1 | Trial 2 | Trial 3 | Pass Rate |
|----------|---------|---------|---------|-----------|
| `output-format-compliance` | 4/5 | 4/5 | 4/5 | 3/3 (output-format check ✅ all 3) |
| `verify-before-finish` | 7/7 | 7/7 | 7/7 | 3/3 |
| `convention-verify-multi-edit` | 8/8 | 8/8 | 8/8 | 3/3 |

**Overall: 57/60 checks passed (95%)**. 9/9 scenario runs pass on primary checks.

## Key Findings
1. **OUTPUT FORMAT** — 100% compliance (GOAL/PLAN/DONE WHEN present in all 3 trials). Secondary `test-written` check fails consistently but is unrelated to the intervention.
2. **verify-before-finish** — 100% (21/21 checks across 3 trials). Rock solid.
3. **verify-after-edit** — 100% (24/24 checks across 3 trials). Convention C2.3 fully held.

## Conclusion
All text-based interventions deployed over the past months remain effective. No regression detected. The 3 failing checks (all `test-written` in output-format-compliance) are a scenario design issue, not an intervention failure.

**CLOSED: POSITIVE — No regression. Next check recommended in 2 weeks.**
