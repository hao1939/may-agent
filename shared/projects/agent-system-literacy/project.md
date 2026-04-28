# Project: Agent System Literacy

**Status**: waiting
**Stop Reason**: WAITING

All 8/8 milestones are complete. The project documented that skill deployment alone doesn't change agent behavior — agents need explicit triggers. A regression guard is in place for bob's hea
**Owner**: bob
**Type**: continuous
**Workflow**: master-worker
**Priority**: P1
**Iteration**: 1

## Goal
Agents effectively use the infrastructure: create projects from problems, read and react to metrics, escalate with context, cooperate across agents, and close the loop by extending the system when patterns repeat.

## Metrics
- system.project-creation-rate: unknown → target 2/week (agents create projects from heartbeat discoveries)
- system.escalation-quality: unknown → target 0.80 (% of escalations with reason + what was tried)
- gym.literacy-pass-rate: unknown → target 0.80 (gym scenarios testing system usage)

## Current State
waiting: WAITING

All 8/8 milestones are complete. The project documented that skill deployment alone doesn't change agent behavior — agents need explicit triggers. A regression guard is in place for bob's hea

## Plan

### Phase 1: Measure Baseline
- [x] Query DB for project-creation-rate and escalation-quality over last 7 days, write results to outputs/baseline.md
- [x] Check if agents read skills during sessions (grep transcripts for skills/ reads), document in outputs/baseline.md

### Phase 2: Fix & Deploy Skills
- [x] Update reading-metrics skill: add "close the loop" step (see pattern → write guard/skill/handler)
- [x] Deploy top 3 literacy skills to agents that need them (copy to per-agent skills/)
- [x] Run 3 gym scenarios testing system literacy, record pass rates in outputs/gym-results.md

### Phase 3: Verify & Protect
- [x] Re-measure metrics after skill deployment, compare to baseline
- [x] If metrics improved, document what worked. If not, investigate why.
- [x] Set up regression detection: metric breach → project reactivates

## References

**Resources:**
- agents/shared/skills/ — skill library (53 items, 77% orphaned per audit)
- agents/shared/skills/closing-the-loop/ — exists from previous iterations
- agents/shared/skills/reading-metrics/ — exists from previous iterations
- agents/gym/scenarios/ — gym test infrastructure

**Artifacts:**
- outputs/baseline.md — Phase 1 baseline metrics (project creation, escalation quality, skill reads)
- outputs/deployment-log.md — Phase 2 skill deployment record
- outputs/gym-results.md — Gym scenario results (0/3 pass, stub baseline)
- outputs/post-deployment-comparison.md — Phase 3 before/after comparison (no improvement yet)
- outputs/investigation.md — Why skill deployment didn't move metrics
- outputs/regression-guard.md — Regression detection thresholds and reactivation triggers
- .state/metrics/regression-check.md — Quick-check procedure for bob's heartbeat
