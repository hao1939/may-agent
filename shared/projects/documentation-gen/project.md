# Project: Documentation Generation

**Status**: active
**Owner**: coach
**Priority**: P2
**Workflow**: master-worker
**Iteration**: 5

## Goal
System is self-documenting. Architecture, workflows, agent roles all have up-to-date docs.

## Metrics
- docs.coverage: 0.79 → target 0.80 (11/14 agents have docs; 3 missing: architect, master, judge)
- docs.staleness-max-days: ~90 → target 14 (inventory dated 2025-01-27, ~3 months old)

## Current State
Strong foundation exists. 6 output docs produced covering inventory, architecture, agent reference, onboarding, workflows, and doc-gen scripting. Coverage is 11/14 agents (79%). Main gaps: architect/master/judge lack any docs; all outputs are ~3 months stale. The doc-gen-script.md describes automation but no runnable script exists yet.

## Completed
- [x] Audit existing docs, identify gaps, write outputs/docs-inventory.md
- [x] Write architecture overview covering agent types, workflows, communication
- [x] Document each agent's role and configuration

## Plan
- [ ] Add context.md or docs for the 3 undocumented agents (architect, master, judge) to hit 0.80 coverage
- [ ] Refresh all 6 output docs with current dates and any system changes since Jan 2025
- [ ] Create a runnable doc-freshness checker script that reports staleness per doc
- [ ] Re-plan: measure updated coverage/staleness, decide if project can close

## References

**Resources:**
- agents/shared/may-agent-docs/design/ — design docs
- agents/*/agent.json — agent configs
- agents/shared/workflows/ — workflow code
