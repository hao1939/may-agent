# Finding: evaluator-failure-chain.ts tool name mismatch ("exec" vs "bash")

**Date**: 2026-03-25T22:43
**Severity**: HIGH — all isExpectedNonZeroExit exclusions were dead code
**Status**: ✅ FIXED — code change applied, 42/42 tests pass, needs binary rebuild

## Bug

`evaluator-failure-chain.ts` checked `toolName === "exec"` in 7 places, but the tool is named `"bash"` in all session transcripts. This meant:

1. `isExpectedNonZeroExit()` — never fired (guarded by `isToolOwnError` which checks `toolName === "exec"`)
2. `isFindWithNoResults()` — never fired (checks `toolName !== "exec"`)
3. `detectIntent()` — never matched bash commands
4. `isRecoveryAttempt()` — never recognized bash recovery attempts
5. `diagnoseRootCause()` — never analyzed bash failures

All the carefully written exclusions for grep (exit 1 = no match), diff (exit 1 = differences found), test runners (exit 1 = tests failed), existence checks (which/command -v), git operations, etc. were completely inert.

## Impact

Every bash command returning non-zero exit code was counted as a failure and classified as `bash:other`. This inflated:
- **bash:other count**: potentially 50%+ false positives from grep, diff, test runners
- **Wasted call totals**: each false positive counts as 1+ wasted calls
- **Waste rate**: 4.4% may be significantly lower in reality

## Fix

Changed all 7 occurrences of `"exec"` to `"bash"` in `src/lib/evaluator-failure-chain.ts`.
Updated all 91 test references in `test/failure-chains.test.ts`.
All 42 tests pass.

## Files Changed
- `src/lib/evaluator-failure-chain.ts` — 7 occurrences fixed
- `test/failure-chains.test.ts` — 91 occurrences fixed

## Next Steps
- Binary rebuild needed to activate
- After next tool-quality-scan, bash:other should drop significantly
- True waste rate may be closer to 2-3%
