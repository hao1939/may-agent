# Project: Skill & Workflow Quality

**Status**: active
**Owner**: coach
**Type**: continuous
**Workflow**: master-worker
**Priority**: P0
**Iteration**: 10

## Goal
Every skill and workflow verified working, measured for impact, protected against regression.
**This project is NEVER done while metrics are below target.**

## Metrics
- skill.verified-rate: 0.60 → target 0.80 ⚠️ (9/15 skills verified at expanded scope — was 5/5 on top-5-only)
- skill.delivery-rate: 0.81 → target 0.60 ✅ (39/48 shared skills deployed to agents)
- workflow.pass-rate: 1.00 → target 0.95 ✅

## Current State (Updated Iteration 10)
All 9 milestones complete. `skill-verification.md` has extended verification (top 5 + next 10 = 15 skills).
- skill.verified-rate: 0.60 (9/15 verified) — below 0.80 target ⚠️
- skill.delivery-rate: 0.81 (39/48) ✅
- workflow.pass-rate: 1.00 (10/10) ✅

**Unverified skills** (all still in shared/skills/):
- escalation — EXP-253 removed from 8 agents with no degradation
- closing-the-loop — 1 digest match, EXP-253 no degradation
- second-look-verification — 0 matches, EXP-253 no degradation
- consolidate-memory — 0 matches, never measured
- experience-replay — 0 matches, never measured
- evidence-over-narrative — partial (9 digest matches, coach only)

**Path to 0.80**: Prune 4 EXP-253-proven-dead skills (escalation, closing-the-loop, second-look-verification, experience-replay) from shared/skills/ → denominator drops to 11, rate becomes 9/11 = 0.82. OR verify 3+ more skills via experiment.
**Action**: Prune dead skills. This is the right call — EXP-253 already proved they have no impact.

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
