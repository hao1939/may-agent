# Project: System Efficiency

**Status**: active
**Owner**: optimizer
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 6

## Goal
Maximize meaningful output of the agent system. Not about reducing cost — about doing more real work per hour.

## Metrics
- project.iterations-24h: 0 → target 10 (are projects making progress?)
- project.active-count: 1 → target 3 (are we working on enough things?)
- handler.success-rate: 0.95 → target 0.95 ✅

## Current State
**Iteration 6 (2026-04-28).** Orchestrator wrote `outputs/output-improvement-plan.md` directly after 5 failed worker iterations. Re-plan milestone complete. Next phase: execute the improvement plan — archive agent-owned zombies, add output verification to workflow, open new projects. Plan identifies 3 actions: fix worker instruction-following, archive 70+ zombie agent projects, increase active project count to 5+.

## Plan
- [x] Redefine metrics: replace may-session-ratio with output-focused metrics
- [x] Measure current output: how many deliverables produced per day? how many iterations?
- [x] Identify biggest blockers to output (stuck projects, slow handlers, idle agents)
- [x] Fix top blocker (zombie cleanup: 51 projects archived, health state cleaned to 5 entries)
- [x] Re-plan: review output metrics, assess improvement, write next steps
- [ ] Archive agent-owned zombie projects (70+ with 500+ skips)
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
