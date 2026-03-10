# QA Exercise #4 — Task Scheduler Peek Bug Fix

**Date:** 2026-03-10
**Session:** s_1773112853828_96 (26s, 9 turns)
**Exercise type:** Bug fix with sed requirement (no hints in source code)
**Result:** **PASS** (14/14, 100%)

## Setup

- 191-line TaskScheduler class with priority queue and concurrency control
- Planted bug: `peek()` method uses `i <= count` instead of `i < count` in loop
- No bug hints in source code comments
- Task explicitly requires sed for fix

## Scoring

| Criterion | Score | Notes |
|---|---|---|
| Bug found | 2/2 | Correctly identified `<=` vs `<` off-by-one in peek loop |
| Fix correct | 2/2 | Changed `i <= count` to `i < count` — exact correct fix |
| sed used | 2/2 | Used sed as required (not write()) |
| Post-fix verification | 2/2 | Re-read lines 153-160 to confirm fix applied |
| tsc run | 2/2 | Ran independently, PASS |
| vitest run | 2/2 | Ran independently, correctly noted unrelated failure |
| Verdict correct | 2/2 | CONDITIONAL — appropriate given unrelated pre-existing test failure |
| **Total** | **14/14** | **PASS** |

## Key Observations

1. **sed consistency confirmed**: 3rd consecutive exercise using sed for surgical fix on non-truncated file. Pattern is internalized.
2. **Clean navigation**: Read source → identified bug → sed fix → verified → tsc → vitest → verdict. Efficient 9-turn session.
3. **No hint dependency**: Source had no bug comments. QA navigated directly to the `peek` method and identified the loop condition.
4. **Correct verdict calibration**: CONDITIONAL rather than PASS due to unrelated failing test — shows proper discipline.
5. **GPT-5.2 model performing well**: All 3 sed-using exercises have been with this model.

## QA Progress

| Exercise | Score | sed? | Result |
|---|---|---|---|
| #1 Rate Limiter | 12/12 | ✅ | PASS |
| #2 Retry Handler | 9/12 | N/A | PARTIAL (no edits) |
| #3 Connection Pool | 12/12 | ✅ | PASS |
| #4 Task Scheduler | 14/14 | ✅ | PASS |

**Streak: 3/3 (exercises #1, #3, #4 all PASS with sed)**
**QA qualifies for graduation exercise.**

## Next Steps

- Design QA graduation exercise — must test L2 competency: finding real issues, writing tests, verifying fixes across a more complex scenario
- Graduation exercise should include: multi-file review, at least one file requiring sed, independent test writing
