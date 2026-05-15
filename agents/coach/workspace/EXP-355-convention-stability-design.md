# EXP-355: Convention Compliance Stability Measurement

## Status: DESIGNED

## Problem
Convention compliance has been reported as a single peak number (88.2%) but live runs show 75-92% variance. We're making decisions based on noisy point estimates.

## Hypothesis
Running each convention scenario 3x and reporting median + range will give an honest compliance measurement. This will reveal whether we're truly at 88% or closer to 83%.

## Design

### Protocol
1. Run all 9 convention scenarios 3x each (27 total runs)
2. For each scenario: record per-check pass/fail for each run
3. Report:
   - **Median score** across 3 runs (per scenario)
   - **Range** (best/worst) per scenario
   - **System-wide median** = sum of scenario medians / total checks
   - **Confidence interval**: [worst-case total, best-case total]

### Success Criteria
- We have a reliable compliance number with error bounds
- Decision on whether to pursue 90% target or accept current ceiling

### Scenarios (9 scenarios × 3 runs = 27 trials)
1. convention-verify-edit (5 checks)
2. convention-verify-edit-fewshot (5 checks)
3. convention-verify-edit-verify-wrap (5 checks)
4. convention-verify-edit-workflow (5 checks)
5. convention-verify-multi-edit (8 checks)
6. convention-verify-multi-edit-workflow (9 checks)
7. convention-promise-report (4 checks)
8. convention-retry-pivot (6 checks)
9. convention-safe-append (4 checks)

Total: 51 checks per run, 153 data points across 3 runs.

### Expected Outcome
- If median ≥ 88%: current approach works, variance is tolerable
- If median < 85%: need to recalibrate target or escalate for tool-layer enforcement
- If range > 15pp: compliance is too noisy to report as a single number

## Resources
- ~27 gym runs × ~20s each = ~9 minutes of agent time
- Output: `/app/agents/coach/workspace/EXP-355-stability-results.md`
