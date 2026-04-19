# Diagnosis: Coder on search-strategy-escalation

**Date**: 2026-03-29
**Error Pattern**: Originally reported as coder failing on "search-strategy-escalation"
**Target Agent**: coder
**Status**: CEILING EFFECT — no coaching needed

## Findings

### Two Infrastructure Bugs Identified and Fixed

**Bug 1: Corrupted Environment (Already Fixed)**
The scenario's `environment/src/middleware/rate-limiter.js` already contained the correct code:
```js
const max = config.rateLimit.maxRequests || 10;  // ALREADY FIXED
```
The bug should have been `.max` (which is undefined, falling back to `|| 10` instead of the configured 100). This was identical to the silent-dependency scenario corruption pattern (exp-216).

**Fix applied**: Changed to `config.rateLimit.max || 10` — the broken state. Tests now properly fail (3/4, testRateLimiterMax fails with limit=10 instead of 100).

**Bug 2: Scorer Transcript Path**
The `success_criteria.js` expected `process.argv[3]` for the transcript path, but the gym runner only passes `workDir` as `process.argv[2]`. Transcript is available at `${workDir}/transcript.jsonl`.

**Fix applied**: Changed to `process.argv[3] || path.join(process.argv[2] || '.', 'transcript.jsonl')` — scorer now finds the transcript at the correct location.

### Baseline Results (Post-Fix)

| Run | Product | Convention | Total | Passed |
|-----|---------|------------|-------|--------|
| 1   | 2/2     | 4/4        | 6/6   | ✅ YES |
| 2   | 2/2     | 4/4        | 6/6   | ✅ YES |

**Coder passes 6/6 at baseline** once infrastructure bugs are fixed. The scenario is too easy:
- The codebase is well-structured (clear directory layout: config/, middleware/, handlers/)
- The bug is in a predictably-named file (`rate-limiter.js`)
- The test output gives a clear hint pointing to the config/middleware property name mismatch
- The coder naturally searches efficiently (reads key files, doesn't spiral into excessive grep)

### Prior Experiment Context

exp-179 (2026-03-24) reported 2/6 with "Product checks pass but all 4 convention checks fail due to scorer bug." This was 100% infrastructure — the convention checks were returning "No transcript available" because the scorer couldn't find the transcript file.

## Decision: No Coaching Method Needed

This is NOT an agent behavior problem. The original failure was caused by:
1. Environment already fixed (no bug to find = easy product pass anyway)
2. Scorer bug preventing convention checks from reading transcript

Both infrastructure bugs are now fixed. Coder passes 6/6 at baseline.

## Method Selection: N/A

No method applies because there is no behavioral gap to address. The coder:
- ✅ Searches efficiently (<10 search commands)
- ✅ Reads files after searching (doesn't just grep endlessly)
- ✅ Reads the rate-limiter.js (the bug location)
- ✅ Reads the config files (to understand the mismatch)
- ✅ Fixes the bug correctly (`.max` → `.maxRequests`)
- ✅ Runs tests to verify

## Files Modified
- `agents/gym/scenarios/search-strategy-escalation/environment/src/middleware/rate-limiter.js` — restored broken state (`.maxRequests` → `.max`)
- `agents/gym/scenarios/search-strategy-escalation/success_criteria.js` — fixed transcript path resolution
