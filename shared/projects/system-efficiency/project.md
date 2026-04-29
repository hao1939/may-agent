# Project: System Efficiency

**Status**: active
**Owner**: optimizer
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 3

## Goal
Maximize meaningful output of the agent system. Not about reducing cost — about doing more real work per hour. "Meaningful output" = code changes, documentation, bug fixes, features that move satellite projects toward their goals.

## Metrics
- deliverables-per-iteration: unknown → target 0.8 (% of iterations that produce a real file change, not just metrics/snapshots)
- satellite-goal-progress: unknown → target 2 satellites at metric targets within 2 weeks
- worker-first-attempt-success: unknown → target 0.7 (worker produces correct deliverable without retry)

## Current State
**Iteration 47.** 3 post-pivot iterations, all produced real output. deliverables-per-iteration: 3/3 = 1.0. Test-coverage: 41 tests (project.ts + master-worker.ts). Agent-memory-learning: 59 lessons extracted (target was 50). satellite-goal-progress: 1/2 satellites at target (agent-memory-learning hit 50+ lessons). Next: drive second satellite to target, measure worker-first-attempt-success.

## Plan
- [ ] Measure current deliverables-per-iteration (audit last 10 iterations for real file output)
- [x] Drive test-coverage: install vitest, write first test for workflows/project.ts critical path (20 tests, 255 lines, all passing)
- [ ] Drive agent-memory-learning: build lesson capture pipeline, get to 50 lessons
- [ ] Measure worker-first-attempt-success rate from journal entries
- [x] Drive test-coverage: write tests for master-worker.ts workflow (21 tests, all passing)
- [ ] Re-plan based on metrics

## References

**Resources:**
- agents/shared/workflows/circuit-breaker.ts — provider error handling (done)
- agents/shared/workflows/budget-checkpoint.ts — budget-aware save (done)

**Artifacts:**
- outputs/project-closure-summary.md — previous work summary
- outputs/system-output-audit.md — system output audit
- outputs/daily-metrics-snapshot.md — daily iteration/deliverable tracking for sustainability milestone
