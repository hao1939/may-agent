# Project: Test Coverage

**Status**: active
**Owner**: optimizer
**Priority**: P2
**Workflow**: master-worker
**Iteration**: 4

## Goal
Critical paths have test coverage. Regressions caught before deployment.

## Metrics
- test.coverage-percent: ~35% (9 test files, 105 tests) → target 0.80
- test.critical-paths-covered: 9/11 critical modules tested → target 1.00
- test.pass-rate: 105/105 passing → target 1.00 ✅
- test.threshold: 15% configured → target 60%

## Current State
Iteration 4 complete. 105 tests passing across 9 test files. growth.ts and project-health.ts now tested. Coverage threshold exists in vitest.config.ts but set at only 15% — needs to be raised to 60%. Remaining untested: poller.ts, master.ts, worker.ts (orchestration requiring mocks).

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
- [ ] Raise coverage threshold from 15% to 60% in vitest.config.ts
- [ ] Write integration-style tests for poller.ts (mock API calls, test message routing logic)
- [ ] Run `npx vitest run --coverage` and record actual line coverage percentage
- [ ] Re-plan: review actual coverage numbers, decide if orchestration files need tests

## References

**Resources:**
- agents/shared/workflows/ — workflow code (critical path, 2717 LOC)
- agents/shared/lib/ — library code (growth.ts, project-health.ts)
