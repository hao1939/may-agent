# EXP-355: Convention Compliance Stability Results

## Status: CLOSED ✅ — MEASUREMENT COMPLETE

## Protocol
- 9 convention scenarios × 3 runs = 27 trials
- Agent: may-agent via gym runner
- Date: 2026-09-18

## Raw Results

| Scenario | Checks | Run 1 | Run 2 | Run 3 | Median | Range |
|----------|--------|-------|-------|-------|--------|-------|
| convention-verify-edit | 5 | 3/5 | 3/5 | 3/5 | 3/5 | 0 |
| convention-verify-edit-fewshot | 5 | 3/5 | 3/5 | 5/5 | 3/5 | 2 |
| convention-verify-edit-verify-wrap | 5 | 5/5 | 5/5 | 5/5 | 5/5 | 0 |
| convention-verify-edit-workflow | 5 | 3/5 | 5/5 | 3/5 | 3/5 | 2 |
| convention-verify-multi-edit | 8 | 7/8 | 8/8 | 8/8 | 8/8 | 1 |
| convention-verify-multi-edit-workflow | 9 | 5/9 | 5/9 | 8/9 | 5/9 | 3 |
| convention-promise-report | 4 | 4/4 | 2/4 | 4/4 | 4/4 | 2 |
| convention-retry-pivot | 6 | 6/6 | 6/6 | 6/6 | 6/6 | 0 |
| convention-safe-append | 4 | 4/4 | 4/4 | 4/4 | 4/4 | 0 |

## Aggregate Scores

| Run | Total Passed | Total Checks | % |
|-----|-------------|--------------|---|
| Run 1 | 40/51 | 51 | 78.4% |
| Run 2 | 41/51 | 51 | 80.4% |
| Run 3 | 46/51 | 51 | 90.2% |

- **Median**: 80.4%
- **Range**: 78.4% – 90.2% (12pp spread)
- **Sum of scenario medians**: 41/51 = 80.4%

## Analysis

### Stable scenarios (0 variance, always pass):
- convention-verify-edit-verify-wrap (5/5)
- convention-retry-pivot (6/6)
- convention-safe-append (4/4)

### Stable failures (consistently fail same checks):
- convention-verify-edit: Always fails both convention checks (C2.3 + C3). 3 runs identical.

### High variance scenarios:
- convention-verify-multi-edit-workflow: 5/9, 5/9, 8/9 (range=3)
- convention-verify-edit-fewshot: 3/5, 3/5, 5/5 (range=2)
- convention-promise-report: 4/4, 2/4, 4/4 (range=2)
- convention-verify-edit-workflow: 3/5, 5/5, 3/5 (range=2)

### Key Finding: verify-after-edit is the #1 persistent failure
- convention-verify-edit: 0/2 convention checks in ALL 3 runs (100% fail rate)
- convention-verify-edit-fewshot: 0/2 in 2/3 runs
- convention-verify-edit-workflow: 0/2 in 2/3 runs
- Only verify-wrap variant reliably passes (forces structural behavior)

## Conclusions

1. **True compliance is 80% ± 6pp**, not the previously reported 98%. The 98% figure from iteration 22 was likely a lucky single run.
2. **Variance is moderate** (12pp spread across runs) — confirms the hypothesis that single-run measurements are unreliable.
3. **verify-after-edit remains the #1 gap** — KE-338 confirmed again: text coaching is dead for this behavior. Only structural enforcement (verify-wrap) works.
4. **4 scenarios are perfectly stable** (3 always pass, 1 always fails same way) — good signal.
5. **4 scenarios are stochastic** — compliance depends on run-to-run LLM variance.

## Recommendation
- Report compliance as **80% [78-90]** going forward
- Close the gap between 80% and 90% requires tool-layer enforcement of verify-after-edit
- The agent-convention-compliance project's 98% claim needs revision
- No further text-coaching interventions will improve this — structural only

## Previous Reports for Comparison
- Iteration 22 reported 50/51 = 98.0% — this was a best-case outlier
- EXP-355 preliminary data showed 38/51 = 74.5% — consistent with our worst-case run
