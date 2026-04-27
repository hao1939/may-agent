# Project: Agent System Literacy

**Status**: active
**Owner**: bob
**Type**: continuous
**Workflow**: master-worker
**Priority**: P1
**Iteration**: 3

## Goal
Agents effectively use the infrastructure: create projects from problems, read and react to metrics, escalate with context, cooperate across agents, and close the loop by extending the system when patterns repeat.

## Metrics
- system.project-creation-rate: unknown → target 2/week (agents create projects from heartbeat discoveries)
- system.escalation-quality: unknown → target 0.80 (% of escalations with reason + what was tried)
- gym.literacy-pass-rate: unknown → target 0.80 (gym scenarios testing system usage)

## Current State
Iteration 3. Reading-metrics skill verified done. outputs/ dir is EMPTY — baseline.md was never written despite worker claims. Phase 1 must be redone first.

## Plan

### Phase 1: Measure Baseline
- [ ] Query DB for project-creation-rate and escalation-quality over last 7 days, write results to outputs/baseline.md
- [ ] Check if agents read skills during sessions (grep transcripts for skills/ reads), document in outputs/baseline.md

### Phase 2: Fix & Deploy Skills
- [x] Update reading-metrics skill: add "close the loop" step (see pattern → write guard/skill/handler)
- [ ] Deploy top 3 literacy skills to agents that need them (copy to per-agent skills/)
- [ ] Run 3 gym scenarios testing system literacy, record pass rates in outputs/gym-results.md

### Phase 3: Verify & Protect
- [ ] Re-measure metrics after skill deployment, compare to baseline
- [ ] If metrics improved, document what worked. If not, investigate why.
- [ ] Set up regression detection: metric breach → project reactivates

## References

**Resources:**
- agents/shared/skills/ — skill library (53 items, 77% orphaned per audit)
- agents/shared/skills/closing-the-loop/ — exists from previous iterations
- agents/shared/skills/reading-metrics/ — exists from previous iterations
- agents/gym/scenarios/ — gym test infrastructure

**Artifacts:**
- (none yet — previous iterations produced no usable deliverables)
