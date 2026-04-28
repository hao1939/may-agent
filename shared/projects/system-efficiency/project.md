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
**Iteration 1 complete.** Audit produced (`outputs/system-output-audit.md`). Key findings:
- Only ~3 projects making real progress, ~70 zombie projects with 500+ skips
- Top blocker: workers iterate without producing deliverables (agent-system-literacy: 9 iters, no output)
- ~5 worker iterations with actual deliverables in last 7 days
- Recommendation: archive zombies, add worker output verification, create new high-value projects

## Plan
- [x] Redefine metrics: replace may-session-ratio with output-focused metrics
- [x] Measure current output: how many deliverables produced per day? how many iterations?
- [x] Identify biggest blockers to output (stuck projects, slow handlers, idle agents)
- [ ] Fix top blocker
- [ ] Re-plan: review output metrics, assess improvement, write next steps

## References

**Resources:**
- agents/shared/workflows/circuit-breaker.ts — provider error handling (done)
- agents/shared/workflows/budget-checkpoint.ts — budget-aware save (done)

**Artifacts:**
- outputs/project-closure-summary.md — previous work summary
