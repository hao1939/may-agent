# Finding: bash:test-failure Regression (+29%, 17→22)

**Date**: 2026-04-16 ~06:30 UTC  
**Mode**: Investigation (assigned task)  
**Severity**: Low — not a real regression

## Summary

The +29% increase in `bash:test-failure` (17→22) is **not a systemic regression**. It's a volume artifact driven by increased gym experiment activity.

## Root Cause: More Gym Runs = More Test Failures

**Gym run volume increased ~20%**: 421 runs (Apr 14-15) → 507 runs (Apr 15-16).

The 22 test-failure instances cluster around:
- **bob (13)**: Primarily EXP-165 and EXP-166 gym trial runs — these involve running scenarios where tests are *expected* to fail initially (that's the scenario design — agent must fix them)
- **coder (8)**: Gym scenario execution ("Fix the failing tests in this student grade processing pipeline", "Fix the Product Search Service") — these are gym child sessions where test failure is part of the workflow
- **coach (1)**: Skill regression check running test validations

## Why This Isn't a Problem

1. **Gym scenarios are designed to have failing tests** — the agent runs tests, sees failures, then fixes them. The failure chain captures the initial `test.js` exit code as a "bash:test-failure" even though it's the intended workflow.
2. **The 5 new failures** (17→22) correspond almost exactly to the ~20% increase in gym run volume, not to any degradation in agent test-running ability.
3. **No non-gym test failures appeared** — there's no increase in vitest/tsc failures in normal development sessions.

## Recommendation

**No action needed.** The tool-quality-report should consider excluding gym child sessions (where test failure is expected behavior) from the `bash:test-failure` count, or at minimum annotating them as "expected in gym context." This would reduce noise in future trend reports.

A useful improvement would be to tag gym-scenario coder sessions in the failure chain categorizer so `bash:test-failure` can be split into `bash:test-failure:gym` (expected) vs `bash:test-failure:dev` (real problem).
