# Project: Test Coverage

**Status**: active
**Owner**: optimizer
**Priority**: P2
**Workflow**: master-worker
**Iteration**: 3

## Goal
Critical paths have test coverage. Regressions caught before deployment.

## Metrics
- test.coverage-percent: ~25% (7 test files covering key modules) → target 0.80
- test.critical-paths-covered: 7/9 critical modules tested → target 1.00
- test.pass-rate: 76/76 passing → target 1.00 ✅

## Current State
Iteration 3 complete. 76 tests passing across 7 test files, 0 failures. All pure-logic modules have tests. Remaining untested critical paths: workflow orchestration files (master.ts, worker.ts, poller.ts) which require heavier mocking. Re-plan now.

## Plan
- [x] Install vitest, create vitest.config.ts, create test/ dir, write a smoke test that passes
- [x] Analyze codebase and write outputs/coverage-baseline.md listing functions and testability
- [x] Write unit tests for circuit-breaker.ts (pure logic, most testable)
- [x] Write unit tests for project-helpers.ts and budget-checkpoint.ts
- [x] Write unit tests for guards (finish-guard.ts, hallucinated-path.ts, read-before-edit.ts — pure logic guards)
- [x] Write unit tests for fewshot-inject-helpers.ts and verify-wrap.ts
- [x] Fix failing gym test (agent="coder" vs "amy" mismatch)
- [x] Re-plan: measure coverage, assess what's left
- [ ] Write tests for shared/lib/ modules (growth.ts, project-health.ts)
- [ ] Write integration-style tests for poller.ts (mock API calls, test message routing logic)
- [ ] Add coverage threshold to vitest.config.ts (fail build if coverage drops below 60%)
- [ ] Re-plan: review coverage metric, decide if orchestration files need tests

## References

**Resources:**
- agents/shared/workflows/ — workflow code (critical path, 2717 LOC)
- agents/shared/lib/ — library code (growth.ts, project-health.ts)
