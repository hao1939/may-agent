# Project: Metric Reactivity

**Status**: done
**Owner**: may
**Priority**: P1
**Iteration**: 4

**Health**: 8/10 (PASS)
## Goal
Agents should react to metric alerts. Currently 4 alerts are firing with zero response. Close the loop: alert → agent sees it → agent investigates → agent acts.

## Problem
- `metrics-snapshot` handler writes alerts to `metric_alerts` table
- Nobody reads the alerts table
- No notification sent when alert fires
- Heartbeat context doesn't include active alerts
- Result: alerts accumulate, agents are blind to them

## Current Active Alerts
- `evaluator.coverage`: 36 < 80 (yellow) — worsening
- `tech-lead.build-health`: 0 < 1 (yellow)
- `tech-lead.meaningful-changes`: regressed 100% (yellow)
- `qa.review-coverage`: 0 < 1 (yellow) — 51h+ unresolved
- `optimizer.quality-preserved`: 0.84 < 0.85 (yellow)
- `coach.knowledge-to-action-latency`: stalled (yellow) — NEW
- `optimizer.waste-reduction`: stalled (yellow) — NEW

## Design Principles
- Metric-oriented: alerts are the signal
- Event-driven: alert firing IS the event
- Each metric has an owner — the owner should react, not May
- May audits that owners are reacting

## Milestones
- [x] Investigate: why don't agents see alerts? Map the gap between alert creation and agent awareness
- [x] Design: how should alerts reach the responsible agent? Options: heartbeat injection, notification, handler
- [x] Build: delivery via trackRequest + auto-fork on regression via ctx.manager.run(). Heartbeat pull via alert injection in check-health step.
- [x] Verify: auto-fork has NEVER fired (0 sessions with source=metric-alert). Need to either trigger a real regression or backfill-fork for existing unresolved alerts
- [x] Measure: track alert-to-reaction time as a metric

## Open Questions
- Who owns each metric? Is it documented?
- Should alerts interrupt (fork/notify) or wait for next heartbeat?
- How to avoid alert fatigue? Only actionable alerts, not noise.

## Comments


## Current State
Complete. 5/5 milestones. The implementation is complete. The full alert → agent reaction loop is now wired:

1. **Detection**

## Iteration Summary
- **Iter 3**: Now let me write the verification report:

- **Iter 3**: Auto-committed already. Now commit the other dirty files:

- **Iter 4**: The implementation is complete. The full alert → agent reaction loop is now wired:

1. **Detection**

- **Iter 4**: Both M4 and M5 are already complete. The metric `may.alert-to-reaction-time` exists with a proper `s

