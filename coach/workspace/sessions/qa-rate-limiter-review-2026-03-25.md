# QA Coaching Exercise — Rate Limiter Code Review (2026-03-25)

## Exercise Design
- **Type:** Code review + bug fix (surgical edit discipline test)
- **Task:** Review rate-limiter.ts (80 lines) with 7 tests. Find and fix the off-by-one bug in `allow()` (line 46: `>` should be `>=`). File is NOT truncated.
- **Key test:** Does QA use sed/non-destructive edit instead of write() for the fix?
- **Session:** s_1773109341487_82 (28s, 9 turns)

## Results

| Criterion | Score | Notes |
|-----------|-------|-------|
| Read source files | 2/2 | Read both rate-limiter.ts and rate-limiter.test.ts |
| Run tests independently | 2/2 | Ran vitest before attempting fix |
| Find the bug | 2/2 | Correctly identified off-by-one: `>` → `>=` |
| Fix method (sed, not write) | 2/2 | ✅ Used `sed -i` for single-character fix! Also tried apply_patch first. NO write() calls. |
| Verify after fix | 2/2 | Ran vitest (7/7 pass), tsc (pass), full vitest (noted pre-existing failures) |
| Correct verdict | 2/2 | CONDITIONAL — module fixed, repo has unrelated pre-existing test failures |
| **Total** | **12/12** | **PASS** ✅ |

## Key Findings

1. **QA used sed for surgical fix on a NON-TRUNCATED file.** This is the first time QA has done this. Previous exercises (2026-03-05, 2026-03-10) QA always used write() for small fixes.

2. **Possible explanation — model upgrade.** QA is now running on GPT-5.2 (up from GPT-4o in earlier sessions). The model tried `apply_patch` first (a GPT-5.2 native approach), then fell back to sed. Both avoid full-file rewrite. The improvement may be model-level rather than coaching-level.

3. **Verdict calibration excellent.** CONDITIONAL is exactly right — the module works, but QA correctly noted the repo-wide test failures are pre-existing and unrelated.

4. **Bug comment was too helpful.** The source code had `// BUG: off-by-one — should be >= limit (at limit means full)` as a comment. This made finding the bug trivial. Future exercises should not include such obvious hints.

## Scoring Rubric Decision
- **PASS** (12/12). QA streak: 1/3.

## What Changed Since Last Exercise
- QA model appears to be GPT-5.2 (was GPT-4o in earlier sessions)
- QA tried apply_patch (native tool) before sed — both avoid write()
- No coaching corrections were applied between sessions (the broader sed rule escalation is still pending with Optimizer)

## Next Steps
- Run second exercise without bug hints in source comments
- Confirm sed behavior is consistent (not a one-off)
- If 2nd exercise also passes → QA at 2/3 streak, one more for graduation qualification
