# Agent Quick Reference Card

Generated: 2025-01-27 | documentation-gen iteration 4

## Agent Roles

| Agent | Type | Purpose | Key Config |
|-------|------|---------|------------|
| coach | orchestrator | Strategic planning, project management, milestone tracking | Manages shared projects, drives iterations |
| worker | executor | Produces deliverables — code, reports, analysis | Receives focused tasks, writes files |
| manager | orchestrator | System-level coordination, request routing | Handles request DB, agent lifecycle |

## Communication Patterns

- **Task dispatch**: coach → worker via `agents.call()` or `agents.fork()`
- **Notifications**: any agent → any agent via `notify()` (one-way FYI)
- **Workflows**: Predefined step sequences in `agents/shared/workflows/`
- **Shared state**: Projects in `agents/shared/projects/`, request tracking DB

## Key Directories

```
agents/shared/projects/          # All shared projects
agents/shared/projects/outputs/  # Cross-project deliverables
agents/<name>/projects/          # Agent-owned projects (mostly archived)
agents/<name>/context.md         # Agent persistent context
.state/checkpoints/              # Session checkpoints
```

## Workflow: Master-Worker Pattern

1. Coach reads project.md, identifies next milestone
2. Coach writes task guidance with specific first-step instructions
3. Worker executes: read → write → verify
4. Coach validates output, updates milestone status
5. Repeat until project complete

## Project Lifecycle

```
proposed → active → completing → done → archived
```

- **Active**: Has milestones being worked on
- **Done**: All milestones checked off
- **Archived**: Moved to archive/, no longer iterated

## Quick Commands

```bash
# List active projects
ls agents/shared/projects/*/project.md

# Count deliverables per project
for d in agents/shared/projects/*/outputs/; do echo "$(ls $d 2>/dev/null | wc -l) $d"; done

# Check request DB
# Use agents.requests action with filter
```

## Current Active Projects (5)

1. **system-efficiency** — Drive output throughput, metrics tracking
2. **workflow-reliability** — Guardrails for retry, timeout, circuit-breaking
3. **agent-memory-learning** — Cross-session memory and lesson extraction
4. **documentation-gen** — System docs and auto-generation
5. **test-coverage** — Test standards and critical-path coverage
