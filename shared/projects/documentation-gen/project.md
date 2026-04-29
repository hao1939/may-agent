# Project: Documentation Generation

**Status**: active
**Owner**: coach
**Priority**: P2
**Workflow**: master-worker
**Iteration**: 1

## Goal
System is self-documenting. Architecture, workflows, agent roles all have up-to-date docs.

## Metrics
- docs.coverage: 1.00 ✅ target 0.80 (12/12 agents with agent.json have context.md or equivalent docs)
- docs.staleness-max-days: ~90 → target 14 (output docs dated 2025-01-27, ~3 months old)

## Current State
Coverage target exceeded — all 12 agents have documentation. The inventory was stale (claimed master/judge/architect had no docs, but they do). Remaining work: refresh the 6 output docs to current state, update the inventory, and build a freshness checker script. Once staleness is addressed, project can close.

## Completed
- [x] Audit existing docs, identify gaps, write outputs/docs-inventory.md
- [x] Write architecture overview covering agent types, workflows, communication
- [x] Document each agent's role and configuration
- [x] Add context.md or docs for the 3 undocumented agents (architect, master, judge) — verified they already exist

## Plan
- [ ] Update outputs/docs-inventory.md with correct coverage data (all 12 agents documented)
- [ ] Refresh architecture-guide.md, agent-quick-reference.md, workflow-docs.md with current system state
- [ ] Create outputs/check-freshness.sh — a runnable script that checks git log dates for all doc files and reports staleness
- [ ] Re-plan: measure staleness metric, decide if project can close

## References

**Resources:**
- agents/shared/may-agent-docs/design/ — design docs
- agents/*/agent.json — agent configs
- agents/shared/workflows/ — workflow code
