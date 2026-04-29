# Project: Documentation Generation

**Status**: active
**Owner**: coach
**Priority**: P2
**Workflow**: master-worker
**Iteration**: 0

## Goal
System is self-documenting. Architecture, workflows, agent roles all have up-to-date docs.

## Metrics
- docs.coverage: unknown → target 0.80 (% of agents/workflows with docs)
- docs.staleness-max-days: unknown → target 14 (no doc older than 2 weeks)

## Current State
New project. Scattered docs exist (README files, context.md, design docs) but no systematic coverage or freshness tracking.

## Plan
- [ ] Audit existing docs, identify gaps, write outputs/docs-inventory.md
- [ ] Write architecture overview covering agent types, workflows, communication
- [ ] Document each agent's role and configuration
- [ ] Re-plan: review coverage metric, assess gaps, write next steps

## References

**Resources:**
- agents/shared/may-agent-docs/design/ — design docs
- agents/*/agent.json — agent configs
- agents/shared/workflows/ — workflow code
