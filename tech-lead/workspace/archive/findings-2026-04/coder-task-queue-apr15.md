# Coder Task Queue — 2026-04-15

Designed per req:741222cf from May. Tasks are concrete, bounded, and have clear verification.

## Task 1: Add logging to silent catch blocks in session-subscribers.ts

**Files**: `src/lib/session-subscribers.ts` (ONLY)
**Problem**: 10 `catch { }` blocks silently swallow errors. This was flagged in Lens D audit (audit-subscriber-error-propagation.md). When subscribers fail, we have zero observability — errors vanish.
**What to do**:
1. Read `src/lib/session-subscribers.ts` 
2. For each `catch { }` or `catch { /* best-effort */ }` block, add a `log("warn", ...)` call with the error message and subscriber context
3. Keep the catch — do NOT re-throw. The point is observability, not changing behavior.
4. Use the existing `log` import (already imported from `../lib/logger.js`)
**Verification**: `npx vitest run test/session-subscribers.test.ts && npx tsc --noEmit`
**Expected**: ~10 catch blocks updated, all existing tests still pass

## Task 2: Delete leaked gym test artifact

**Files**: `test/product-search.test.js` (ONLY)
**Problem**: A gym scenario left a `test/product-search.test.js` file in the test directory. It references `../src/product-search.js` which doesn't exist. Vitest picks it up and reports 1 failing test file (out of 134). This makes the test suite always show "1 failed" which masks real failures.
**What to do**:
1. Delete `test/product-search.test.js`
2. Verify test suite is now 100% green
**Verification**: `npx vitest run 2>&1 | tail -5` — should show 0 failed test files
**Expected**: Test suite goes from "1 failed | 133 passed" to "134 passed (134)"

## Task 3: Add ctx.log warning to silent EventBus catch block

**Files**: `src/app/event-bus.ts` (ONLY)  
**Problem**: EventBus.emit() has a silent `catch { }` block (line ~135) around subscriber execution. When a bus subscriber throws, the error is completely swallowed with zero logging. This was flagged in Lens D audit (audit-subscriber-error-propagation.md).
**What to do**:
1. Read `src/app/event-bus.ts`
2. Find the catch block in the emit() method
3. Add logging: capture the error and log it with the event type and subscriber info
4. Keep the catch — do NOT re-throw. Subscriber isolation is correct behavior.
**Verification**: `npx vitest run test/event-bus.test.ts && npx tsc --noEmit`
**Expected**: 1 catch block updated, all tests pass

## Task 4: Merge review branches to main

**Files**: Multiple review branches
**Problem**: 7 local review branches have accumulated. Several overlap (same commits on multiple branches). Need to merge the unique changes and clean up.
**What to do**:
1. `review/dead-code-cleanup-models-cli` — contains 4 commits: dead model defs removal, regression detection fix, dead maxTurns cleanup, evaluateStandaloneSession. Check TSC + tests, merge to main.
2. `review/s_1776284639016_82` — 1 commit (coach gym regression run, agents-only). Check if agents-only, if so just delete the branch.
3. Delete branches that are subsets of `review/dead-code-cleanup-models-cli`: `review/eval-coverage-30pct`, `review/metrics-regression-fix`, `review/remove-dead-maxturns`, `review/standalone-eval-coverage`
4. `review/metric-tension-pairs` — check if agents-only or has src changes
**Verification**: `git branch | grep review/` should show 0 local review branches. `npx tsc --noEmit` clean. `npx vitest run` all pass.
**Expected**: All unique changes merged to main, all review branches deleted
