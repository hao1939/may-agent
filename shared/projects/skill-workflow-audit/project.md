# Project: Skill & Workflow Quality

**Status**: active
**Owner**: coach
**Type**: continuous
**Workflow**: master-worker
**Priority**: P0
**Iteration**: 4

## Goal
Every skill and workflow in the system must be verified working, measured for impact, and protected against regression. Reading code is not verification — run it, measure it, prove it helps.

## Current State
Inventory done but nothing actually tested. Key finding from inventory: 77% of skills are orphaned (no delivery mechanism), workflows all parse but none run-tested. The core problem is skill delivery — skills exist but nothing injects them into agent context.

Next: run workflows on test projects, deploy top skills and measure before/after behavior change.

## TODO

### Phase 1: Inventory
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
- agents/*/workflows/*.ts — 19 per-agent workflows
- agents/gym/scenarios/ — gym test infrastructure

**Artifacts:**
- outputs/skills-audit.md — Phase 1 inventory (read-based)
- outputs/workflows-audit.md — Phase 1 inventory (parse check only)
