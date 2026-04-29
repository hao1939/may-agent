# Project: System Efficiency

**Status**: active
**Owner**: optimizer
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 45

## Goal
Maximize meaningful output of the agent system. Not about reducing cost — about doing more real work per hour. "Meaningful output" = code changes, documentation, bug fixes, features that move satellite projects toward their goals.

## Metrics
- deliverables-per-iteration: unknown → target 0.8 (% of iterations that produce a real file change, not just metrics/snapshots)
- satellite-goal-progress: unknown → target 2 satellites at metric targets within 2 weeks
- worker-first-attempt-success: unknown → target 0.7 (worker produces correct deliverable without retry)

## Current State
**Iteration 45.** PIVOT from milestone-chasing working. Iteration 44 produced real output: 20 passing vitest tests for workflows/project.ts (tests/project.test.ts, 255 lines). Tests cover updateField, extractSection, updateSection, updateChecklist, parseMetrics pure functions. deliverables-per-iteration: 1/1 = 1.0 for post-pivot iterations.

Next priority: expand test coverage to other critical workflows (master-worker.ts, heartbeat.ts), then drive agent-memory-learning toward its 50-lesson target.

## Plan
- [ ] Measure current deliverables-per-iteration (audit last 10 iterations for real file output)
- [x] Drive test-coverage: install vitest, write first test for workflows/project.ts critical path (20 tests, 255 lines, all passing)
- [ ] Drive agent-memory-learning: build lesson capture pipeline, get to 50 lessons
- [ ] Measure worker-first-attempt-success rate from journal entries
- [ ] Drive test-coverage: write tests for master-worker.ts workflow (the orchestration core)
- [ ] Re-plan based on metrics

## References

**Resources:**
- agents/shared/workflows/circuit-breaker.ts — provider error handling (done)
- agents/shared/workflows/budget-checkpoint.ts — budget-aware save (done)

**Artifacts:**
- outputs/project-closure-summary.md — previous work summary
- outputs/system-output-audit.md — system output audit
- outputs/daily-metrics-snapshot.md — daily iteration/deliverable tracking for sustainability milestone
