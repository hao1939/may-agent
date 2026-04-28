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

## Current State (Updated 2027-09-20)
Expanded verification from top 5 to top 15 skills. 9/15 verified, 1 partial, 5 unverified.
Key finding: EXP-253 already pruned 4 unverified mass-deployed skills (30 files across 8 agents) with no degradation.
Structural enforcement skills (verify-before-finish 90%, budget-before-act 100%) vastly outperform text-only (verify-after-edit 22%).
**Blockers**: Evaluator dead 7+ days, gym runner needs GYM_AGENT_BIN, convention_checks table empty.
Next: Automate regression checks (milestone 9) — blocked on infra.

## Plan
- [x] Inventory all skills and workflows
- [x] Run-test all workflows (10/10 load)
- [x] Deploy top 5 skills to agents that need them (copy to per-agent skills/)
- [x] Measure before/after behavior change for each deployed skill
- [x] Get skill.verified-rate above 0.50
- [x] Get skill.delivery-rate above 0.40
- [x] Set up gym scenario testing skill effectiveness
- [x] Expand verification beyond top 5 skills (10/48 next)
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
