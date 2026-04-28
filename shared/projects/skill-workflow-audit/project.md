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
All 9 milestones complete. `skill-verification.md` has full extended verification (top 5 + next 10).
- skill.verified-rate: 0.60 (9/15 verified) — below 0.80 target ⚠️
- skill.delivery-rate: 0.81 (39/48) ✅
- workflow.pass-rate: 1.00 (10/10) ✅
- `metrics.md` is stale (Jan 2025) — needs rewrite to match current data.

**Remaining gap**: 6 unverified skills (5 no-evidence + 1 partial). Path to 0.80 = verify 3 more (12/15).
Options: (1) convert partial (evidence-over-narrative) to verified with experiment, (2) prune unverified skills reducing denominator, (3) verify consolidate-memory/experience-replay with targeted observation.
**Blocker**: evaluator dead 7+ days, gym runner needs GYM_AGENT_BIN.

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
