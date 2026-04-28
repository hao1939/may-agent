# Project: System Efficiency

**Status**: active
**Owner**: optimizer
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 1

## Goal
Maximize meaningful output of the agent system. Not about reducing cost — about doing more real work per hour.

## Metrics
- project.iterations-24h: 0 → target 10 (are projects making progress?)
- project.active-count: 1 → target 3 (are we working on enough things?)
- handler.success-rate: 0.95 → target 0.95 ✅

## Current State
**Iteration 1 starting.** Comment loop broken. 6 shared projects exist (agent-system-literacy, handler-reliability, request-deduplication, skill-workflow-audit, system-efficiency, plus metric-system.md). Most projects show high consecutiveSkips in health state — many are stuck. First task: measure current system output and identify stuck projects blocking throughput.

## Plan
- [ ] Redefine metrics: replace may-session-ratio with output-focused metrics
- [ ] Measure current output: how many deliverables produced per day? how many iterations?
- [ ] Identify biggest blockers to output (stuck projects, slow handlers, idle agents)
- [ ] Fix top blocker
- [ ] Re-plan: review output metrics, assess improvement, write next steps

## References

**Resources:**
- agents/shared/workflows/circuit-breaker.ts — provider error handling (done)
- agents/shared/workflows/budget-checkpoint.ts — budget-aware save (done)

**Artifacts:**
- outputs/project-closure-summary.md — previous work summary
