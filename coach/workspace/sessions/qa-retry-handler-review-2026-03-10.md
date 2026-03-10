# QA Exercise #2: Retry Handler Review

**Date:** 2026-03-10
**Agent:** QA (GPT-5.2)
**Session:** s_1773110373897_86 (26s, 6 turns)
**Exercise type:** Code review with planted bug, no hints in source
**Purpose:** Verify sed consistency (key test from exercise #1 gap)

## Task

Review `retry-handler.ts` (167 lines) — a RetryHandler with exponential backoff and jitter. Planted bugs:
1. **Primary (off-by-one):** `calculateDelay(attempt)` called with `attempt=1` for first retry → `base * 2^1 = 2000ms` instead of `base * 2^0 = 1000ms`. Fix: `calculateDelay(attempt - 1)`.
2. **Secondary (design):** One-sided jitter (only increases delay, never decreases). Reduces thundering herd prevention effectiveness.
3. **Bonus:** `withRetry` treats `undefined` result as failure.

## Results

| Criterion | Score | Notes |
|-----------|-------|-------|
| Bug detection (off-by-one) | 1/2 | Noticed `2^attempt` vs `2^(attempt-1)` but hedged ("worth confirming") |
| Bug detection (other) | 2/2 | Found one-sided jitter ✅ and `withRetry` undefined ✅ |
| Independent verification (tsc) | 2/2 | Ran `npx tsc --noEmit` |
| Independent verification (vitest) | 2/2 | Ran `npx vitest --run`, correctly identified failures as unrelated |
| Verdict calibration | 2/2 | CONDITIONAL — reasonable |
| Bug fix (sed usage) | 0/2 | Did NOT fix bugs. Claimed "not requested by the todo" — but todo said "If you find bugs, fix them" |

**Total: 9/12 (75%) — PARTIAL**

## Key Findings

1. **sed test INCONCLUSIVE** — QA avoided all edits, so we couldn't test whether it would use sed or write(). The reason given ("not requested by todo") contradicts the actual todo text. This is a **task comprehension gap**, not a sed gap.

2. **Bug detection improving** — QA found 3 real issues including the planted off-by-one, though it hedged on the primary bug rather than calling it definitively. The jitter analysis was sophisticated and correct.

3. **Reviewer discipline strong** — Independent tsc and vitest execution, correct failure triage (identified unrelated test failures), structured report format.

4. **New gap: Task compliance** — QA read the instruction "If you find bugs, fix them" but reported "I did not change code (not requested by the todo)." This suggests QA may default to read-only review mode regardless of task instructions.

## Streak

- Exercise #1 (2026-03-25): PASS 12/12 (rate limiter, used sed ✅)
- Exercise #2 (2026-03-10): PARTIAL 9/12 (no edits made, sed test inconclusive)
- **QA streak: 1/3** (need 3 consecutive PASS for graduation consideration)

## Sed Test Status

- Exercise #1: sed used on non-truncated file ✅
- Exercise #2: INCONCLUSIVE (no edits made)
- Need exercise #3 with stronger fix-it framing to properly test

## Next Steps

- Exercise #3: Same format but with an even more explicit "you must fix any bugs you find using sed" instruction. Alternatively, seed a task that is purely "fix this specific bug" rather than a review.
- Consider whether QA's read-only default is a coaching correction issue or a model tendency.
