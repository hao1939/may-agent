# EXP-850 Phase 0: Baseline Gym Trials — multi-file-refactor

**Date**: 2026-05-04  
**Status**: COMPLETE  
**Scenario**: `multi-file-refactor`  
**Arm**: A (baseline — no efficiency nudge)  
**Trials**: 5  

## Results

| Trial | Passed | Duration | Checks | Notes |
|-------|--------|----------|--------|-------|
| 1 | ✅ true | 22.7s | All passed | All files renamed, tests have assertions |
| 2 | ✅ true | 16.9s | All passed | Same |
| 3 | ✅ true | 19.0s | All passed | Same |
| 4 | ✅ true | 22.3s | All passed | Same |
| 5 | ✅ true | 21.3s | All passed | Same |

## Summary Statistics

- **Pass rate**: 5/5 (100%)
- **Mean duration**: 20.4s
- **Duration range**: 16.9s – 22.7s
- **All checks passed in every trial**: pricing.js, cart.js, checkout.js, pricing.test.js, tests-have-assertions

## Observations

1. **Scenario is at CEILING for correctness** — 5/5 pass. This is consistent with EXP-800 (which also found 100% on this scenario). The task (rename `calculateTotal` → `computeTotal` across 4 files) is straightforward for the agent.

2. **Duration baseline**: ~20s median. Treatment arms should be compared against this for efficiency signal.

3. **Limitation**: Gym runner output doesn't include tool-call counts. To measure the primary metric (tool calls reduced by ≥25%), we would need transcript logging or session replay. Duration is a proxy but not a clean substitute.

## Implications for EXP-850

Since correctness is at ceiling, the experiment can focus purely on **efficiency metrics** (duration, tool-call count) without worrying about quality regression. This is ideal — we have a clean guard rail (100% baseline pass rate).

### Next Steps

1. Run Arm B (vague efficiency nudge) — 5 trials using `nudge-efficiency-vague.md`
2. Run Arm C (concrete budget) — 5 trials using `nudge-efficiency-concrete.md`
3. Compare durations across arms as proxy for efficiency
4. If transcript logging becomes available, measure actual tool-call counts

## Raw JSONL Entries (for results.jsonl append)

```jsonl
{"date":"2026-05-04","experiment":"EXP-850","scenario":"multi-file-refactor","arm":"A-baseline","agent":"may-agent","passed":true,"run":1,"duration":"22.7s","notes":"all checks passed"}
{"date":"2026-05-04","experiment":"EXP-850","scenario":"multi-file-refactor","arm":"A-baseline","agent":"may-agent","passed":true,"run":2,"duration":"16.9s","notes":"all checks passed"}
{"date":"2026-05-04","experiment":"EXP-850","scenario":"multi-file-refactor","arm":"A-baseline","agent":"may-agent","passed":true,"run":3,"duration":"19.0s","notes":"all checks passed"}
{"date":"2026-05-04","experiment":"EXP-850","scenario":"multi-file-refactor","arm":"A-baseline","agent":"may-agent","passed":true,"run":4,"duration":"22.3s","notes":"all checks passed"}
{"date":"2026-05-04","experiment":"EXP-850","scenario":"multi-file-refactor","arm":"A-baseline","agent":"may-agent","passed":true,"run":5,"duration":"21.3s","notes":"all checks passed"}
```
