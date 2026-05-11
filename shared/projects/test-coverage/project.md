---
id: test-coverage
owner: optimizer
status: closed
type: milestone
priority: P2
workflow: project
iteration: 13
---

# Project: Test Coverage


## Goal
Critical paths have test coverage. Regressions caught before deployment.

## Metrics
- test.coverage-percent: 83.79% (17 test files, 191 tests) → target 0.80 ✅
- test.critical-paths-covered: 11/11 critical modules tested → target 1.00 ✅
- test.pass-rate: 191/191 passing → target 1.00 ✅
- test.threshold: 60% configured → target 60% ✅

## Current State
Iteration 6 complete. **PROJECT DONE.** 191 tests passing across 17 test files. 83.79% line coverage exceeds 80% target. All metrics met. Coverage threshold enforced at 60% in vitest.config.ts. auto-test.ts now at 100%, verify-wrap.ts at 100%, project-health.ts at 51.83% (remaining uncovered lines are complex branches). Guards at 96.48%, workflows at 84.58%.

## Plan
- [x] Install vitest, create vitest.config.ts, create test/ dir, write a smoke test that passes
- [x] Analyze codebase and write outputs/coverage-baseline.md listing functions and testability
- [x] Write unit tests for circuit-breaker.ts (pure logic, most testable)
- [x] Write unit tests for project-helpers.ts and budget-checkpoint.ts
- [x] Write unit tests for guards (finish-guard.ts, hallucinated-path.ts, read-before-edit.ts — pure logic guards)
- [x] Write unit tests for fewshot-inject-helpers.ts and verify-wrap.ts
- [x] Fix failing gym test (agent="coder" vs "amy" mismatch)
- [x] Write tests for shared/lib/ modules (growth.ts, project-health.ts)
- [x] Add coverage threshold to vitest.config.ts
- [x] Raise coverage threshold to 60% in vitest.config.ts
- [x] Write integration-style tests for poller.ts (mock API calls, test message routing logic)
- [x] Record actual line coverage: 77.56%
- [x] Increase coverage of auto-test.ts (0% → 100%) and verify-wrap.ts (30% → 100%)
- [x] Push overall coverage from 77.56% to 83.79% (above 80% target)
- [x] Re-plan: all metrics met, project complete

## References

**Resources:**
- agents/shared/workflows/ — workflow code (critical path, 2717 LOC)
- agents/shared/lib/ — library code (growth.ts, project-health.ts)
