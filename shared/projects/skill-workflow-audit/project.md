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
Phase 1 (inventory) complete. 53 shared skills audited by reading — 77% orphaned, 22 worth keeping. 29 workflows parse. But **nothing was actually tested**. We don't know if any skill improves agent behavior or if any workflow runs without errors on a real project. No metrics exist to detect regression.

Next: actually run skills/workflows and measure impact.

## Milestones

### Phase 1: Inventory (DONE)
- [x] Read-audit all 53 shared skills and 29 workflows
- [x] Produce inventory reports (outputs/skills-audit.md, outputs/workflows-audit.md)

### Phase 2: Run & Verify
- [ ] Run each of the 10 shared workflows on a test project via --run-workflow --dry-run, document which execute vs crash
- [ ] For top 5 skills (verification, patterns, evidence-over-narrative, coder-edit-discipline, error-handling): deploy to one agent, run 3 sessions before/after, measure if behavior changes
- [ ] Write outputs/skills-impact.md with before/after measurements
- [ ] Write outputs/workflows-runtest.md with pass/fail for each workflow

### Phase 3: Regression Protection
- [ ] Create metric: skill.verified-rate — % of deployed skills with measured positive impact
- [ ] Create metric: workflow.pass-rate — % of workflows that execute without errors
- [ ] Add a gym scenario that tests skill delivery (agent receives skill, does it change behavior?)
- [ ] Set up periodic re-run (monthly) to catch regressions

## References

**Resources:**
- agents/shared/skills/ — 53 shared skills
- agents/shared/workflows/*.ts — 10 shared workflows
- agents/*/workflows/*.ts — 19 per-agent workflows
- agents/may/cron.json — handler config
- agents/gym/scenarios/ — gym test infrastructure

**Artifacts:**
- outputs/skills-audit.md — Phase 1 inventory (read-based, not verification)
- outputs/workflows-audit.md — Phase 1 inventory (parse check only)
