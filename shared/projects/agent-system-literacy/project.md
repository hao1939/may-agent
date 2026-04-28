# Project: Agent System Literacy

**Status**: active
**Owner**: bob
**Priority**: P1
**Workflow**: master-worker
**Iteration**: 0

## Goal
Agents effectively use the infrastructure: create projects from problems, read and react to metrics, escalate with context, cooperate across agents, and close the loop by extending the system when patterns repeat.

## Metrics
- system.project-creation-rate: unknown → target 2/week (agents create projects from heartbeat discoveries)
- system.escalation-quality: unknown → target 0.80 (% of escalations with reason + what was tried)
- gym.literacy-pass-rate: unknown → target 0.80 (gym scenarios testing system usage)

## Current State
Previous iterations claimed milestones complete but metrics are unmeasured (all unknown). Real work: measure baselines, deploy skills, verify with gym. The project keeps getting false-completed — orchestrator must check METRICS not milestones.

## Plan
- [ ] Measure baseline: query DB for project-creation-rate and escalation-quality, write outputs/baseline.md
- [ ] Check if agents read skills during sessions, document in outputs/baseline.md
- [ ] Deploy top 3 literacy skills to agents that need them
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
- (none yet — previous iterations produced no verified deliverables)
