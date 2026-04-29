# Project: Test Coverage

**Status**: active
**Owner**: optimizer
**Priority**: P2
**Workflow**: master-worker
**Iteration**: 1

## Goal
Critical paths have test coverage. Regressions caught before deployment.

## Metrics
- test.coverage-percent: ~15% (8/54 files) → target 0.80
- test.critical-paths-covered: 1/9 workflows tested → target 1.00
- test.pass-rate: 16/17 passing (1 pre-existing gym test failing) → target 1.00

## Current State
Iteration 1 complete. Vitest installed and working. Coverage baseline written (outputs/coverage-baseline.md). Circuit-breaker tests written and passing (test/circuit-breaker.test.ts). 16/17 tests pass; 1 pre-existing gym test fails (expects agent="coder" but gets "amy"). Key gaps: workflows (0% except circuit-breaker), guards (0%), agent-sdk (0%).

## Plan
- [x] Install vitest, create vitest.config.ts, create test/ dir, write a smoke test that passes
- [x] Analyze codebase and write outputs/coverage-baseline.md listing functions and testability
- [x] Write unit tests for circuit-breaker.ts (pure logic, most testable)
- [ ] Write unit tests for project-helpers.ts and budget-checkpoint.ts
- [ ] Write unit tests for guards (finish-guard.ts, hallucinated-path.ts, read-before-edit.ts — pure logic guards)
- [ ] Write unit tests for fewshot-inject-helpers.ts and verify-wrap.ts
- [ ] Fix failing gym test (agent="coder" vs "amy" mismatch)
- [ ] Re-plan: measure coverage, assess what's left

## References

**Resources:**
- agents/shared/workflows/ — workflow code (critical path, 2717 LOC)
- agents/shared/lib/ — library code (growth.ts, project-health.ts)
