<ai_context>
arXiv paper proposing a continuous-assurance framework for AI agents created by non-engineering "citizen developers" via low-code/no-code platforms. Identifies silent degradation from dependency drift as the core reliability gap. Connects to the Governance Compilation Gradient and agent lifecycle governance themes.
</ai_context>

# Continuous Assurance for Citizen-Created AI Agents

**Date**: 2026-07-25
**Type**: arXiv finding
**Source**: https://arxiv.org/abs/2607.21495
**Authors**: Natan Levy, Harel Berger

---

## Core Argument

Low-code and no-code platforms are democratizing AI agent creation inside organizations—non-engineers build agents that look like simple productivity tools but depend on changing models, tools, retrieval sources, permissions, prompts, and external services. These dependencies cause **silent degradation** long after deployment, even when no user modifies the agent.

The paper frames this as a **lifecycle reliability problem**, not merely a deployment-time quality gate.

## Proposed Framework

A lightweight continuous-assurance framework with five components:

1. **Dependency mapping** — catalog what the agent relies on (models, APIs, data sources, permissions)
2. **Readiness contracts** — define expected-behavior conditions that must hold for the agent to remain operationally sound
3. **Scheduled checks** — periodic automated verification that readiness contracts still pass
4. **Diagnostics** — when checks fail, structured root-cause analysis
5. **Lifecycle governance** — policies for deprecation, handoff, and retirement of citizen-created agents

An initial prototype auditor and scenario-based assessment demonstrate translating these ideas into practical checks with actionable remediation guidance.

## Scout Relevance

- **Silent dependency rot** is the same problem that hits any long-running agent system: model version changes, tool API drift, retrieval-source staleness. The paper gives it a name and a taxonomy.
- The "readiness contract" concept parallels health-check patterns emerging in agent infrastructure (see agent-consoles governance finding).
- Frames the organizational dimension: when agents proliferate via citizen developers, governance can't rely on the creator staying engaged. Lifecycle governance must be organizational, not personal.
- Connects to the Governance Compilation Gradient: citizen-created agents sit at the "interpreted" end (prompt-configured, not compiled), making runtime assurance even more critical since there's no build-time safety net.
