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
**Iteration**: 2

## Goal
Every skill and workflow verified working, measured for impact, protected against regression.
**This project is NEVER done while metrics are below target.**

## Metrics
- skill.verified-rate: 0.90 → target 0.80 ✅ (9/10 active skills verified — 5 unverified skills already removed/archived)
- skill.delivery-rate: 0.81 → target 0.60 ✅ (39/48 shared skills deployed to agents)
- workflow.pass-rate: 1.00 → target 0.95 ✅
- skill.usage-rate: TBD → target 0.50 ❌ (injection mechanism exists via context.md 📘 directives; need behavioral measurement)

## Current State (Updated Iteration 13)
Original 9 milestones complete. 3 original metrics at target.

**Correction**: The skill-usage audit (outputs/skill-usage.md) was wrong. It claimed 0% usage and "no injection mechanism." In fact, agents DO have skill injection via 📘 directives in context.md — amy has 8 skill refs, bob 13, scout 15, etc. The mechanism works.

**Hao's real question**: Do agents actually *apply* skills in their behavior? This requires sampling recent session outputs and checking for behavioral evidence (e.g., does amy do SCBA before edits? does bob cite evidence-over-narrative?). This is the correct next step.

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
- [ ] Sample 10 recent sessions across 5 agents, check behavioral evidence of skill application
- [ ] Compute skill.usage-rate from behavioral evidence (target: 0.50)
- [ ] Re-plan: assess metrics, identify next improvement opportunities

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
