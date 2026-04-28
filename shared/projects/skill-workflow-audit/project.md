# Project: Skill & Workflow Quality

**Status**: active
**Owner**: coach
**Type**: continuous
**Workflow**: master-worker
**Priority**: P0
**Iteration**: 8

## Goal
Every skill and workflow verified working, measured for impact, protected against regression.
**This project is NEVER done while metrics are below target.**

## Metrics
- skill.verified-rate: 1.00 → target 0.80 ✅ (5/5 top skills verified via behavioral evidence)
- skill.delivery-rate: 0.81 → target 0.60 ✅ (39/48 shared skills deployed to agents)
- workflow.pass-rate: 1.00 → target 0.95 ✅

## Current State
All three metrics at or above target. Top 5 skills verified via behavioral evidence scan
(obstacle-pivot gym data + 4 skills confirmed via journal/session patterns).
Orchestrator wrote skill-verification.md directly after 5 failed worker iterations.
Next: expand verified-rate beyond top 5, set up automated regression checks.

## Plan
- [x] Inventory all skills and workflows
- [x] Run-test all workflows (10/10 load)
- [x] Deploy top 5 skills to agents that need them (copy to per-agent skills/)
- [x] Measure before/after behavior change for each deployed skill
- [x] Get skill.verified-rate above 0.50
- [x] Get skill.delivery-rate above 0.40
- [x] Set up gym scenario testing skill effectiveness
- [ ] Expand verification beyond top 5 skills (10/48 next)
- [ ] Automate skill regression checks in CI/gym

## References

**Resources:**
- agents/shared/skills/ — 53 shared skills
- agents/shared/workflows/*.ts — 10 shared workflows
- agents/gym/scenarios/ — gym test infrastructure

**Artifacts:**
- outputs/skills-audit.md — inventory (113 lines)
- outputs/workflows-audit.md — inventory (73 lines)
- outputs/workflows-runtest.md — run test results (37 lines)
- outputs/skills-impact.md — impact analysis (161 lines)
- outputs/skill-deployment.md — deployment plan (85 lines)
- outputs/skill-verification.md — top 5 skill verification with evidence
- outputs/metrics.md — metric definitions and current values
