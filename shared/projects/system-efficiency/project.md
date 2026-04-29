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
**Iteration 44.** PIVOT from milestone-chasing. Previous 43 iterations gamed iteration counts (cycling through satellites to hit "10/day" target). Hao feedback: chase the goal, not milestones. Metrics redesigned to measure actual output quality. 

Active satellite projects needing real progress:
- agent-memory-learning: iter 2, metrics far from target (20/50 lessons, unknown repeat-mistake-rate)
- test-coverage: iter 1, no tests exist yet, metrics unknown
- documentation-gen: iter 4, metrics at target — effectively done
- workflow-reliability: closed by coach

Real work to do: get test-coverage and agent-memory-learning to their metric targets.

## Plan
- [ ] Measure current deliverables-per-iteration (audit last 10 iterations for real file output)
- [x] Drive test-coverage: install vitest, write first test for workflows/project.ts critical path (20 tests, 255 lines, all passing)
- [ ] Drive agent-memory-learning: build lesson capture pipeline, get to 50 lessons
- [ ] Measure worker-first-attempt-success rate from journal entries
- [ ] Re-plan based on metrics

## References

**Resources:**
- agents/shared/workflows/circuit-breaker.ts — provider error handling (done)
- agents/shared/workflows/budget-checkpoint.ts — budget-aware save (done)

**Artifacts:**
- outputs/project-closure-summary.md — previous work summary
- outputs/system-output-audit.md — system output audit
- outputs/daily-metrics-snapshot.md — daily iteration/deliverable tracking for sustainability milestone
