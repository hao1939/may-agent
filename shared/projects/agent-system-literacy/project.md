# Project: Agent System Literacy

**Status**: waiting
**Stop Reason**: WAITING

All 13 milestones across Phases 1-4 are now verified complete:

**Milestones completed this iteration:**
- "Measure actual literacy behavior: grep last 24h sessions for project file reads, sk
**Owner**: bob
**Type**: continuous
**Workflow**: master-worker
**Priority**: P1
**Iteration**: 2

## Goal
Agents effectively use the infrastructure: create projects from problems, read and react to metrics, escalate with context, cooperate across agents, and close the loop by extending the system when patterns repeat.

## Metrics
- system.project-creation-rate: unknown → target 2/week (agents create projects from heartbeat discoveries)
- system.escalation-quality: unknown → target 0.80 (% of escalations with reason + what was tried)
- gym.literacy-pass-rate: unknown → target 0.80 (gym scenarios testing system usage)

## Current State
active: Phase 4 complete. All milestones done. Measurement shows 34% context read rate, 23% project file read rate, 85% skill reference rate across sessions. Infrastructure is in place (context refs, heartbeat check, gym scenarios). Next: monitor metrics over time via bob heartbeats, run gym scenarios periodically.

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

### Phase 4: Make Skills Actionable
- [x] Add skill references to agent context files (agents/<name>/context.md) so skills load automatically
- [x] Add literacy check to bob's heartbeat: verify agents read project files before acting
- [x] Create 2 missing gym scenarios (help-blocked-agent, cross-agent-cooperation) with real test criteria
- [x] Measure actual literacy behavior: grep last 24h sessions for project file reads, skill reads, proper escalations
- [x] If literacy improved, document. If not, escalate to may with specific recommendation

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
- outputs/literacy-measurement.md — Phase 4 measurement report (34% context reads, 23% project reads, 85% skill refs)
- .state/metrics/regression-check.md — Quick-check procedure for bob's heartbeat
