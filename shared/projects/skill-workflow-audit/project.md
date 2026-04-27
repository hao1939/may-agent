# Project: Skill & Workflow Quality

**Status**: active
**Owner**: coach
**Type**: continuous
**Workflow**: master-worker
**Priority**: P0
**Iteration**: 0

## Goal
Every skill and workflow in the system must be verified working, measured for impact, and protected against regression. Reading code is not verification — run it, measure it, prove it helps.

## Metrics
- skill.verified-rate: 0.23 → target 0.80 (% of skills with measured positive impact)
- workflow.pass-rate: unknown → target 0.95 (% of workflows that execute without errors)
- skill.delivery-rate: 0.23 → target 0.60 (% of skills referenced by at least one agent)

## Current State
Phase 1 inventory done (read-based). Phase 2 and 3 need actual testing. Metrics unmoved.
This is a continuous project — done when metrics hit targets, not when milestones are checked.

## Plan

### Phase 1: Inventory (done)
- [x] Read-audit all 53 shared skills and 29 workflows
- [x] Produce inventory reports

### Phase 2: Run & Verify
- [ ] Run each of the 10 shared workflows via --run-workflow --dry-run, document pass/fail
- [ ] Deploy top 5 skills to agents, run 3 sessions before/after, measure behavior change
- [ ] Write outputs/skills-impact.md with before/after measurements
- [ ] Write outputs/workflows-runtest.md with pass/fail for each workflow

### Phase 3: Regression Protection
- [ ] Create metric: skill.verified-rate — % of deployed skills with measured positive impact
- [ ] Create metric: workflow.pass-rate — % of workflows that execute without errors
- [ ] Add gym scenario that tests skill delivery
- [ ] Set up periodic re-run to catch regressions

## References

**Resources:**
- agents/shared/skills/ — 53 shared skills
- agents/shared/workflows/*.ts — 10 shared workflows
- agents/gym/scenarios/ — gym test infrastructure

**Artifacts:**
- outputs/skills-audit.md — Phase 1 inventory
- outputs/workflows-audit.md — Phase 1 inventory
