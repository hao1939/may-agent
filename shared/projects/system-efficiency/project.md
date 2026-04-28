# Project: System Efficiency

**Status**: active
**Owner**: optimizer
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 9

## Goal
Maximize meaningful output of the agent system. Not about reducing cost — about doing more real work per hour.

## Metrics
- project.iterations-24h: 0 → target 10 (are projects making progress?)
- project.active-count: 1 → target 3 (are we working on enough things?)
- handler.success-rate: 0.95 → target 0.95 ✅

## Current State
**Iteration 14 (2026-04-28).** workflow-reliability at 2 iterations (baseline + guardrails-design), agent-memory-learning at 2 (memory-audit + structured-lesson-format). Need 1 more iteration on each for the 3+ milestone. Active project count: 3 ✅. Worker producing files consistently.

## Plan
- [x] Redefine metrics: replace may-session-ratio with output-focused metrics
- [x] Measure current output: how many deliverables produced per day? how many iterations?
- [x] Identify biggest blockers to output (stuck projects, slow handlers, idle agents)
- [x] Fix top blocker (zombie cleanup: 51 projects archived, health state cleaned to 5 entries)
- [x] Re-plan: review output metrics, assess improvement, write next steps
- [x] Archive agent-owned zombie projects (already done: coach 3, optimizer 1)
- [x] Add output verification to master-worker workflow (already existed in master-worker.ts lines 310, 337)
- [ ] Open 2 new projects and get them to 3+ iterations each
- [ ] Achieve 10 project iterations in a 24h window

## References

**Resources:**
- agents/shared/workflows/circuit-breaker.ts — provider error handling (done)
- agents/shared/workflows/budget-checkpoint.ts — budget-aware save (done)

**Artifacts:**
- outputs/project-closure-summary.md — previous work summary
- outputs/system-output-audit.md — system output audit
- outputs/output-improvement-plan.md — improvement plan with next actions
