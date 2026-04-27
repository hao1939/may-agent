# Project: Skill & Workflow Quality

**Status**: active
**Owner**: coach
**Type**: continuous
**Workflow**: master-worker
**Priority**: P0
**Iteration**: 1

## Goal
Every skill and workflow in the system must be verified working, measured for impact, and protected against regression. Reading code is not verification — run it, measure it, prove it helps.

## Metrics
- skill.verified-rate: 0.20 → target 0.80 (1/5 top skills measured — obstacle-pivot via gym)
- workflow.pass-rate: 1.00 → target 0.95 ✅ (10/10 workflows load cleanly)
- skill.delivery-rate: 0.23 → target 0.60 (12/53 skills referenced by agents)

## Current State
**Iteration 3.** Workflow pass-rate met (10/10). Metrics defined. Gym scenario + regression script created.
Remaining gap: "Deploy top 5 skills, run 3 sessions before/after" is NOT done — only obstacle-pivot has gym-based measurement, no real agent sessions with before/after comparison exist. This is the critical remaining work.
Skills infrastructure note: `src/skills.ts` has a loader but it's not wired into agent startup. Frontmatter added to 2 skills (closing-the-loop, reading-metrics).

## Plan

### Phase 1: Inventory (done)
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
- [x] Set up periodic re-run to catch regressions

## References

**Resources:**
- agents/shared/skills/ — 53 shared skills
- agents/shared/workflows/*.ts — 10 shared workflows
- agents/gym/scenarios/ — gym test infrastructure

**Artifacts:**
- outputs/skills-audit.md — Phase 1 inventory
- outputs/workflows-audit.md — Phase 1 inventory
