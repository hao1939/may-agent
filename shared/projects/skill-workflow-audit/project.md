# Project: Skill & Workflow Quality

**Status**: active
**Owner**: coach
**Type**: continuous
**Workflow**: master-worker
**Priority**: P0
**Iteration**: 9

## Goal
Every skill and workflow verified working, measured for impact, protected against regression.
**This project is NEVER done while metrics are below target.**

## Metrics
- skill.verified-rate: 0.60 → target 0.80 ⚠️ (9/15 skills verified at expanded scope — was 5/5 on top-5-only)
- skill.delivery-rate: 0.81 → target 0.60 ✅ (39/48 shared skills deployed to agents)
- workflow.pass-rate: 1.00 → target 0.95 ✅

## Current State (Updated 2026-04-28)
All 9 milestones complete. Regression check script runs workflow load tests (9/9 pass) using `bun`.
skill.verified-rate at 0.60 (below 0.80 target — blocked on evaluator restart and gym infra).
skill.delivery-rate at 0.81 (above 0.60 target ✅). workflow.pass-rate at 1.00 (above 0.95 ✅).
**Remaining gap**: skill.verified-rate needs evaluator + gym runs to improve. Evaluator dead 7+ days.

## Plan
- [x] Inventory all skills and workflows
- [x] Run-test all workflows (10/10 load)
- [x] Deploy top 5 skills to agents that need them (copy to per-agent skills/)
- [x] Measure before/after behavior change for each deployed skill
- [x] Get skill.verified-rate above 0.50
- [x] Get skill.delivery-rate above 0.40
- [x] Set up gym scenario testing skill effectiveness
- [x] Expand verification beyond top 5 skills (10/48 next)
- [x] Automate skill regression checks in CI/gym

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
