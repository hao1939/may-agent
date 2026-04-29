# Project: Test Coverage

**Status**: active
**Owner**: optimizer
**Priority**: P2
**Workflow**: master-worker
**Iteration**: 1

## Goal
Critical paths have test coverage. Regressions caught before deployment.

## Metrics
- test.coverage-percent: unknown → target 0.80
- test.critical-paths-covered: unknown → target 1.00

## Current State
No `src/` or `test/` directories exist. The actual codebase is `/app/agents/shared/` — workflows (2717 LOC across 9 files) and lib (2 files). No test framework installed, no existing tests. package.json only has puppeteer-core, @types/node, typescript.

Critical paths by size/complexity:
1. `workflows/project.ts` (1046 lines) — project management logic
2. `workflows/master-worker.ts` (504 lines) — orchestration
3. `workflows/heartbeat-data.ts` (413 lines) — heartbeat data
4. `workflows/implement-and-verify.ts` (203 lines) — implementation workflow
5. `workflows/circuit-breaker.ts` (159 lines) — circuit breaker pattern

## Plan
- [ ] Install vitest, create vitest.config.ts, create test/ dir, write a smoke test that passes — output: test framework working
- [ ] Analyze project.ts and master-worker.ts to identify pure/testable functions, write outputs/coverage-baseline.md listing functions and testability
- [ ] Write unit tests for circuit-breaker.ts (pure logic, most testable)
- [ ] Write unit tests for project-helpers.ts and budget-checkpoint.ts
- [ ] Write unit tests for extractable pure functions in project.ts and master-worker.ts
- [ ] Re-plan: measure coverage, assess what's left

## References

**Resources:**
- agents/shared/workflows/ — workflow code (critical path, 2717 LOC)
- agents/shared/lib/ — library code (growth.ts, project-health.ts)
