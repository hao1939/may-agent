# Project: Skill & Workflow Quality

**Status**: active
**Owner**: coach
**Type**: continuous
**Workflow**: master-worker
**Priority**: P0
**Iteration**: 4

## Goal
Every skill and workflow verified working, measured for impact, protected against regression.
**This project is NEVER done while metrics are below target.**

## Metrics
- skill.verified-rate: 0.20 → target 0.80 (only 1/5 top skills measured)
- skill.delivery-rate: 0.81 → target 0.60 ✅ (39/48 shared skills deployed to agents)
- workflow.pass-rate: 1.00 → target 0.95 ✅

## Current State
Top 5 skills deployed to coder, bob, amy, tech-lead. skill.delivery-rate now 0.81 ✅.
39/48 shared skills are referenced in per-agent skills/ dirs (157 total skill files).
Remaining metric: skill.verified-rate at 0.20 (target 0.80) — needs gym runs with live LLM.
Gym scenario exists but requires LLM API to actually run.

## Plan
- [x] Inventory all skills and workflows
- [x] Run-test all workflows (10/10 load)
- [x] Deploy top 5 skills to agents that need them (copy to per-agent skills/)
- [ ] Measure before/after behavior change for each deployed skill
- [ ] Get skill.verified-rate above 0.50
- [x] Get skill.delivery-rate above 0.40
- [ ] Set up gym scenario testing skill effectiveness
- [ ] Re-plan: review metrics, assess what worked, write next steps

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
