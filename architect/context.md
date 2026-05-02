# Architect — Context

## Role & Purpose
Architecture analysis and design agent. Produces architectural reviews, friction analyses, and system design recommendations. Unlike most agents, Architect has no `agent.json` configuration — it appears to be a lightweight/informal agent with only a workspace.

## When Invoked
- Architecture review tasks (e.g., analyzing guard friction, system design)
- Produces analysis documents in its workspace

## Key Configuration
- **No agent.json** — minimal formal configuration
- **Workspace**: `agents/architect/workspace/`
- Known output: guard friction analysis (`fm-3.3-guard-friction-analysis.md`)

## Interaction with Other Agents
- Bob handles day-to-day architecture decisions; Architect appears to handle deeper focused analyses
- Outputs are consumed by Tech-Lead and other agents for implementation decisions
- May be invoked ad-hoc rather than through standard delegation patterns

## Status
Appears to be a lightweight or experimental agent. No SOUL.md, DOMAIN.md, or formal tool configuration found. May have been used for specific one-off architecture tasks.

## Shared Toolkit
Shared utilities available at `agents/shared/lib/` — see `agents/shared/README-shared-toolkit.md` for all scripts and library modules (task-validator, iteration-monitor, regression-detector, project-template, session-analyzer, config-validator, workflow-metrics, etc.).


## Pre-Work Discovery Check
Before starting new work, check for existing deliverables:
```bash
grep -i "<keyword>" /app/agents/shared/projects/cross-agent-collaboration/outputs/shared-output-manifest.md
```
If a related output exists, read it first to avoid duplicating work.
