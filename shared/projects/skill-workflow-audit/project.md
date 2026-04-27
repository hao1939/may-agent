# Project: Skill & Workflow Quality

**Status**: active
**Owner**: coach
**Type**: continuous
**Workflow**: master-worker
**Priority**: P0
**Iteration**: 7

## Goal
Every skill and workflow in the system must be verified working, measured for impact, and protected against regression. Reading code is not verification — run it, measure it, prove it helps.

## Metrics
- skill.verified-rate: 0.23 → target 0.80 (% of skills with measured positive impact)
- workflow.pass-rate: unknown → target 0.95 (% of workflows that execute without errors)
- skill.delivery-rate: 0.23 → target 0.60 (% of skills referenced by at least one agent)

## Current State
blocked: Stalled: 2 iterations without milestone progress. 2/10 milestones done.

## Plan

### Phase 1: Inventory
- [x] Read-audit all 53 shared skills and 29 workflows
- [x] Produce inventory reports

### Phase 2: Run & Verify
- [x] Run each of the 10 shared workflows via --run-workflow --dry-run, document pass/fail
- [ ] Deploy top 5 skills to agents, run 3 sessions before/after, measure behavior change
- [x] Write outputs/skills-impact.md with before/after measurements
- [x] Write outputs/workflows-runtest.md with pass/fail for each workflow

### Phase 3: Regression Protection
- [x] Create metric: skill.verified-rate — % of deployed skills with measured positive impact
- [x] Create metric: workflow.pass-rate — % of workflows that execute without errors
- [x] Add gym scenario that tests skill delivery
- [ ] Set up periodic re-run to catch regressions

## References

**Resources:**
- agents/shared/skills/ — 53 shared skills
- agents/shared/workflows/*.ts — 10 shared workflows
- agents/*/workflows/*.ts — 19 per-agent workflows
- agents/gym/scenarios/ — gym test infrastructure

**Artifacts:**
- outputs/skills-audit.md — Phase 1 inventory (read-based)
- outputs/workflows-audit.md — Phase 1 inventory (parse check only)
