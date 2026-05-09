---
id: documentation-gen
owner: coach
status: closed
type: milestone
priority: P2
workflow: master-worker
iteration: 50
stop_reason: "Safety cap: 50 iterations reached."
---

# Project: Documentation Generation


## Goal
System is self-documenting. Architecture, workflows, agent roles all have up-to-date docs.

## Metrics
- docs.coverage: 1.00 ✅ target 0.80 (12/12 agents with agent.json have context.md or equivalent docs)
- docs.staleness-max-days: 6 ✅ target 14 (oldest doc is 6 days old, 0 stale files out of 39 checked)

## Current State
Both metrics exceed targets. All 12 agents documented, all docs fresh (<14 days). Inventory updated with accurate data. Freshness checker script created and verified working. Project complete.

## Completed
- [x] Audit existing docs, identify gaps, write outputs/docs-inventory.md
- [x] Write architecture overview covering agent types, workflows, communication
- [x] Document each agent's role and configuration
- [x] Add context.md or docs for the 3 undocumented agents (architect, master, judge) — verified they already exist
- [x] Update outputs/docs-inventory.md with correct coverage data (all 12 agents documented)
- [x] Create outputs/check-freshness.sh — a runnable script that checks doc file ages and reports staleness
- [x] Re-plan: both metrics at target, project complete

## Plan
Project complete. For ongoing maintenance:
- Run `outputs/check-freshness.sh` periodically to detect staleness
- Update `outputs/docs-inventory.md` when agents are added/removed

## References

**Resources:**
- agents/shared/may-agent-docs/design/ — design docs
- agents/*/agent.json — agent configs
- agents/shared/workflows/ — workflow code
