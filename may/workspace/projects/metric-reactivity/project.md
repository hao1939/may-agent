# Project: Metric Reactivity

**Status**: active
**Owner**: may
**Priority**: P1
**Iteration**: 1

## Goal
Agents should react to metric alerts. Currently 4 alerts are firing with zero response. Close the loop: alert → agent sees it → agent investigates → agent acts.

## Problem
- `metrics-snapshot` handler writes alerts to `metric_alerts` table
- Nobody reads the alerts table
- No notification sent when alert fires
- Heartbeat context doesn't include active alerts
- Result: alerts accumulate, agents are blind to them

## Current Active Alerts
- `evaluator.coverage`: 79 < 80 (yellow)
- `tech-lead.build-health`: 0 < 1 (yellow)
- `tech-lead.meaningful-changes`: regressed 100% (yellow)
- `qa.review-coverage`: 0 < 1 (yellow)

## Design Principles
- Metric-oriented: alerts are the signal
- Event-driven: alert firing IS the event
- Each metric has an owner — the owner should react, not May
- May audits that owners are reacting

## Milestones
- [x] Investigate: why don't agents see alerts? Map the gap between alert creation and agent awareness
- [x] Design: how should alerts reach the responsible agent? Options: heartbeat injection, notification, handler
- [~] Build: delivery already works via trackRequest → "Injected: pending tasks". Remaining: re-surface unresolved alerts periodically
- [ ] Verify: trigger a test alert, confirm the responsible agent sees and reacts to it
- [ ] Measure: track alert-to-reaction time as a metric

## Open Questions
- Who owns each metric? Is it documented?
- Should alerts interrupt (fork/notify) or wait for next heartbeat?
- How to avoid alert fatigue? Only actionable alerts, not noise.

## Comments
- [2026-04-20 hao] 4 alerts firing, zero agent reaction. This is the gap between our event-driven principle and reality. Fix the plumbing so alerts actually reach the agents who own them.
