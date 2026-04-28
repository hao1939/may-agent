# Project: System Efficiency

**Status**: active
**Owner**: optimizer
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 2

## Goal
Maximize meaningful output of the agent system. Not about reducing cost — about doing more real work per hour.

## Metrics
- project.iterations-24h: 0 → target 10 (are projects making progress?)
- project.active-count: 1 → target 3 (are we working on enough things?)
- handler.success-rate: 0.95 → target 0.95 ✅

## Current State
**Iteration 7 (2026-04-28).** Agent-owned zombie projects already archived (coach: 3, optimizer: 1). No remaining zombies — the "70+" estimate was stale. Marking that milestone done. Focus shifts to: output verification in master-worker workflow, and opening new projects to hit active-count target.

## Plan
- [x] Redefine metrics: replace may-session-ratio with output-focused metrics
- [x] Measure current output: how many deliverables produced per day? how many iterations?
- [x] Identify biggest blockers to output (stuck projects, slow handlers, idle agents)
- [x] Fix top blocker (zombie cleanup: 51 projects archived, health state cleaned to 5 entries)
- [x] Re-plan: review output metrics, assess improvement, write next steps
- [x] Archive agent-owned zombie projects (already done: coach 3, optimizer 1)
- [ ] Add output verification to master-worker workflow
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
