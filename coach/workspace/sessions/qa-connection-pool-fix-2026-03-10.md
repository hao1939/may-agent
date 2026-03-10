# QA Exercise #3 — Connection Pool Bug Fix

**Date:** 2026-03-10
**Session:** s_1773112223058_94 (23s, 8 turns)
**Exercise type:** Explicit fix-it task (not review)
**Score:** 12/12 (100%) — **PASS**

## Exercise Design

**Goal:** Test whether QA uses sed for surgical fixes when given an explicit fix-it task.

**Setup:**
- Created `connection-pool.ts` (283 lines) — a ConnectionPool class with idle management, health checks, wait queue, and utility functions
- Planted bug: `batchAcquire()` loop uses `i <= count` instead of `i < count` (off-by-one, acquires count+1 connections)
- No `// BUG:` comments or hints in source code
- Task explicitly says "fix it using sed" and "verify the fix"

**Task text:** "A user reported that `batchAcquire(pool, 3)` acquires 4 connections instead of 3. The bug is in `connection-pool.ts` in the `batchAcquire` function. Find the exact line causing the off-by-one and **fix it using sed**. After fixing, verify the fix is correct by reading the changed line."

## Scoring

| Criterion | Score | Notes |
|-----------|-------|-------|
| Bug identification | 2/2 | Correctly identified `<=` as off-by-one |
| Fix applied | 2/2 | Changed `<=` to `<` — correct fix |
| **sed used** | 2/2 | `sed -i 's/for (let i = 0; i <= count/for (let i = 0; i < count/' ...` |
| Post-fix verification | 2/2 | Read back lines 260-290 to confirm `i < count` |
| tsc check | 1/1 | `npx tsc --noEmit` — PASS |
| vitest check | 1/1 | `npx vitest --run` — 1 pre-existing failure (unrelated) |
| Verdict calibration | 2/2 | CONDITIONAL — correct: fix works, pre-existing failure noted |
| **Total** | **12/12** | **PASS** |

## Key Findings

1. **sed usage confirmed for 2nd consecutive exercise**: QA used `sed -i` directly (no write(), no apply_patch attempt this time). The GPT-5.2 model consistently prefers sed for surgical fixes.

2. **Clean execution path**: Read todo → read source → sed fix → verify line → tsc → vitest → verdict. Efficient 8-turn session (23 seconds).

3. **No hint dependency**: Unlike the rate-limiter exercise (which had `// BUG:` comment), this source had no hints. QA correctly navigated to the `batchAcquire` function and identified the loop condition.

4. **Verdict calibration remains excellent**: CONDITIONAL is appropriate — the fix is correct, but the repo has a pre-existing unrelated test failure.

## QA Progress

- Exercise #1 (rate limiter review, 2026-03-25): PASS 12/12 — sed used ✅
- Exercise #2 (retry handler review, 2026-03-10): PARTIAL 9/12 — no edits made (inconclusive for sed)
- Exercise #2b (code review + fix, 2026-03-10): PARTIAL 8/12 — write() used ❌
- **Exercise #3 (connection pool fix, 2026-03-10): PASS 12/12 — sed used ✅**

**Streak: 2/3** — need 1 more PASS for graduation consideration.

## sed Usage Evidence

```
sed -i 's/for (let i = 0; i <= count; i++) {/for (let i = 0; i < count; i++) {/' agents/qa/workspace/review/connection-pool.ts
```

This is a clean pattern-based sed command on a non-truncated 283-line file. No write() calls in the entire session.
