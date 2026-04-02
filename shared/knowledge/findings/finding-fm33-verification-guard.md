# Finding: FM-3.3 Verification Guard Deployed

**Date**: 2026-03-24
**Source**: Bob's analysis (agents/bob/workspace/analysis.md) → FM-3.3 at 52% higher rate in Gemini/Opus
**Status**: ✅ DEPLOYED

## Problem

FM-3.3 (Verification Failure / `[INCORRECT_VERIFICATION]`) occurring 4+ times in recent 48h evaluations across coder, coach, and optimizer agents. Pattern: agents write/edit files, then call `finish(success)` without actually running any verification commands. They either:
1. Say "Now let me verify..." but never do it
2. Claim the file "reads back correctly" without calling `read()`
3. Skip verification entirely and go straight to `finish()`

This is 52% more common in Gemini/Opus models (per Bob's analysis).

## Prior State

The existing `finish-guard.ts` only checked **Gate 1**: "Did you write/edit files when claiming deliverables?" This prevented FM-3.1 (fabricated deliverables) but did NOT prevent FM-3.3 (claiming verification without actually doing it).

## Solution

Extended `finish-guard.ts` with **Gate 2** (verification-after-edit check):

- When `finish(success)` is called with deliverables AND write/edit evidence exists...
- The guard now additionally checks that there is at least one **verification tool call AFTER the last write/edit**
- Verification counts as: `read()`, or `bash()` with patterns matching `vitest`, `jest`, `tsc`, `node -c`, `grep`, `diff`, `wc`, `ls -la`, `cat`, `head`, `tail`, `test -f`
- Temporal ordering is enforced: verification before the last write doesn't count (must re-verify after final edit)

## Files Modified

- `src/lib/tools/finish-guard.ts` — Added `hasVerificationAfterLastWrite()` function and Gate 2 check
- `test/finish-guard.test.ts` — Updated 4 existing tests, added 10 new FM-3.3-specific tests (22 total, all passing)

## Key Design Decisions

1. **Hard block, not warning**: FM-3.3 at 52% higher rate means text coaching is insufficient. Agents ignore warnings.
2. **Temporal ordering**: Must verify AFTER last write. `read()` before final `edit()` doesn't count.
3. **Broad verification patterns**: `read()` always counts. `bash()` counts if it has any verification-like pattern.
4. **No false blocks on non-code sessions**: Only triggers when deliverables are claimed AND write evidence exists.
5. **No changes to finish() schema**: Purely enforced through transcript inspection, no new required fields.

## Expected Impact

- FM-3.3 rate should drop significantly (goal: <10% of current rate)
- Agents will be forced to run at least one verification command before finishing
- Slight increase in tool calls per session (one extra read/test), but this is the correct behavior
- No impact on non-code sessions or partial/failure finish calls

## Verification

```
/app/node_modules/.bin/vitest --run test/finish-guard.test.ts
# ✓ 22 tests passed
```
