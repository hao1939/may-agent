# Project: System Efficiency

**Status**: active
**Owner**: optimizer
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 5

## Goal
Maximize meaningful output of the agent system. Not about reducing cost — about doing more real work per hour.

## Metrics
- project.iterations-24h: 0 → target 10 (are projects making progress?)
- project.active-count: 1 → target 3 (are we working on enough things?)
- handler.success-rate: 0.95 → target 0.95 ✅

## Current State
**Iteration 5 (2026-04-28).** BLOCKED: 5 consecutive worker iterations produced zero files. Worker says "let me write the report" each time but never executes. Zombie cleanup was done externally (51 archived). Audit exists at outputs/system-output-audit.md. The "Re-plan" milestone requires the worker to actually produce `outputs/output-improvement-plan.md` — a single markdown file. This has been requested 3 times with no result. The worker instruction-following failure identified as top blocker in the audit is literally happening to this project.

## Plan
- [x] Redefine metrics: replace may-session-ratio with output-focused metrics
- [x] Measure current output: how many deliverables produced per day? how many iterations?
- [x] Identify biggest blockers to output (stuck projects, slow handlers, idle agents)
- [x] Fix top blocker (zombie cleanup: 51 projects archived, health state cleaned to 5 entries)
- [ ] Re-plan: review output metrics, assess improvement, write next steps

## References

**Resources:**
- agents/shared/workflows/circuit-breaker.ts — provider error handling (done)
- agents/shared/workflows/budget-checkpoint.ts — budget-aware save (done)

**Artifacts:**
- outputs/project-closure-summary.md — previous work summary
