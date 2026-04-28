# Project: Skill & Workflow Quality

**Status**: active


**Key finding**: The skill-usage audit was incorrect. Skills ARE injected into agent context via 📘 directives in context.md (amy=8, bob=13, scout=15, coach=8, optimizer=10). The injection mechanism exists and works. The real question is behavioral: do agents apply skills in practice?

All 3 original metrics at target:
- **skill.verified-rate: 0.90** (target 0.80) ✅
- **skill.delivery-rate: 0.81** (target 0.60) ✅ (39/48 shared skills deployed to agents)
**Owner**: coach
**Type**: continuous
**Workflow**: master-worker
**Priority**: P0
**Iteration**: 5

## Goal
Every skill and workflow verified working, measured for impact, protected against regression.
**This project is NEVER done while metrics are below target.**

## Metrics
- skill.verified-rate: 0.90 → target 0.80 ✅ (9/10 active skills verified — 5 unverified skills already removed/archived)
- skill.delivery-rate: 0.81 → target 0.60 ✅ (39/48 shared skills deployed to agents)
- workflow.pass-rate: 1.00 → target 0.95 ✅
- skill.usage-rate: 0.89 → target 0.50 ✅ (8/9 scoreable sessions show ≥2/3 skill behaviors; SCBA=100%, Evidence=100%, Verify=67%)

## Current State (Updated Iteration 20)
All 14 original plan items complete. All 4 metrics at or above target. ✅

**Hao's new feedback (Apr 28)**: "deployed doesn't mean used, used doesn't mean useful — there's a long way to go." Correct. Next phase: re-measure VBF compliance post-deployment, design usefulness metric, check for regressions.

**Phase 2 focus**: Ongoing measurement, usefulness validation, regression detection.

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
- [x] Measure actual agent skill usage rate (result: corrected — injection exists via context.md)
- [x] Sample 10 recent sessions across 5 agents, check behavioral evidence of skill application
- [x] Compute skill.usage-rate from behavioral evidence (result: 0.89, target 0.50 ✅)
- [x] Strengthen Verify-Before-Finish skill (deployed to all 10 agents with 📘 directives)
- [x] Re-plan: assess metrics, identify next improvement opportunities (see outputs/replan-assessment.md)
- [ ] Re-measure VBF compliance post-deployment (target: rise from 67% baseline)
- [ ] Design skill.usefulness-rate metric (usage ≠ usefulness)
- [ ] Re-verify all 3 behavioral dimensions with fresh session data (regression check)
- [ ] Raise skill.delivery-rate target if current rate holds

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
- outputs/skill-behavioral-audit.md — behavioral usage audit across 10 sessions (97 lines)
- outputs/verify-before-finish-strengthening.md — VBF skill deployment to all 11 agents (27 lines)
- outputs/replan-assessment.md — metric snapshot and next opportunities (27 lines)
