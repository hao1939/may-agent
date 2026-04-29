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
Iteration 2 complete. Added 34 new tests: budget-checkpoint.test.ts (13 tests) and project-helpers.test.ts (21 tests). All pass. Milestones 4/8 done. Next: guards (finish-guard, hallucinated-path, read-before-edit).

## Plan
- [x] Install vitest, create vitest.config.ts, create test/ dir, write a smoke test that passes
- [x] Analyze codebase and write outputs/coverage-baseline.md listing functions and testability
- [x] Write unit tests for circuit-breaker.ts (pure logic, most testable)
- [x] Write unit tests for project-helpers.ts and budget-checkpoint.ts
- [ ] Write unit tests for guards (finish-guard.ts, hallucinated-path.ts, read-before-edit.ts — pure logic guards)
- [ ] Write unit tests for fewshot-inject-helpers.ts and verify-wrap.ts
- [ ] Fix failing gym test (agent="coder" vs "amy" mismatch)
- [ ] Re-plan: measure coverage, assess what's left

## References

**Resources:**
- agents/shared/workflows/ — workflow code (critical path, 2717 LOC)
- agents/shared/lib/ — library code (growth.ts, project-health.ts)
