# Documentation Generation

Status: active
Owner: coach
Started: 2025-01-27

## Goal
Generate and maintain up-to-date documentation for the agent system — architecture, workflows, agent roles, configuration. Reduce onboarding friction and make the system self-documenting.

## Metrics
- docs.pages-generated: 0 → 10+
- docs.staleness-days: track max age of any doc
- docs.coverage: percent of agents/workflows with docs

## Plan

### Milestone 1: Documentation Inventory
- [ ] Audit existing docs (README files, inline comments, context.md files)
- [ ] Identify gaps — which agents, workflows, and configs lack documentation
- [ ] Produce `outputs/docs-inventory.md` with findings

### Milestone 2: Core Architecture Docs
- [ ] Write architecture overview (agent types, communication, workflow execution)
- [ ] Document each agent's role, capabilities, and configuration
- [ ] Produce `outputs/architecture-guide.md`

### Milestone 3: Auto-Generation Pipeline
- [ ] Create script to extract docs from code comments and config files
- [ ] Set up periodic doc refresh (daily or per-deploy)
- [ ] Produce `outputs/doc-gen-script.md` with implementation
