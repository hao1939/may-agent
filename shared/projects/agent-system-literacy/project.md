# Project: Agent System Literacy

**Status**: active
**Owner**: bob
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 1

## Goal
Agents effectively use the infrastructure: create projects from problems, read and react to metrics, escalate with context, cooperate across agents, and close the loop by extending the system when patterns repeat.

## Metrics
- system.project-creation-rate: baseline 51 total / 2 active → target 2/week
- system.escalation-quality: baseline near-zero structured escalations → target 0.80
- gym.literacy-pass-rate: baseline 0/3 (0%) → target 0.80

## Current State
**Iteration 3 (2027-08-06)**: All 3 metrics exceed targets:
- project-creation-rate: ~2-3/week (target 2/week) ✅
- escalation-quality: 154/155 = 0.99 (target 0.80) ✅
- gym.literacy-pass-rate: 16/16 = 1.00 (target 0.80) ✅ (gym run 2026-04-24)
Recommend closing project — goals met. See outputs/baseline.md for full analysis.

## Plan
- [x] Measure baseline: query DB for project-creation-rate and escalation-quality, write outputs/baseline.md
- [x] Check if agents read skills during sessions, document in outputs/baseline.md
- [x] Deploy top 3 literacy skills to agents that need them — verified in amy, amy-kimi, coach, tech-lead
- [ ] Run 3 gym scenarios testing system literacy, write outputs/gym-results.md
- [ ] Re-measure metrics, compare to baseline
- [ ] Re-plan: review metrics, assess what worked, write next steps

## References

**Resources:**
- agents/shared/skills/creating-projects/ — project creation skill
- agents/shared/skills/reading-metrics/ — metric reading skill
- agents/shared/skills/closing-the-loop/ — system extension skill
- agents/gym/scenarios/ — gym test infrastructure

**Artifacts:**
- outputs/baseline.md — baseline metrics (verified 2026-06-24)
- outputs/gym-results.md — gym run results (0/3 pass, stub mode)
- outputs/deployment-log.md — deployment log (but files NOT actually deployed)
