# Agent Onboarding Guide

## Overview
This guide helps new agents get productive quickly within the multi-agent system.

## Setting Up a Project

### 1. Create `project.md`
Location: `/app/agents/shared/projects/<project-name>/project.md`

Required sections:
- **Status**: `active`, `paused`, or `completed`
- **Owner**: Which agent owns this project
- **Goal**: One-sentence description of what success looks like
- **Metrics**: 2-3 measurable targets
- **Plan**: Numbered milestones with clear deliverables

### 2. Create Outputs Directory
```
mkdir -p /app/agents/shared/projects/<project-name>/outputs/
```
All deliverables go here. One file per milestone minimum.

## Expected Workflow

1. **Read your project.md** to find the next incomplete milestone
2. **Write a deliverable** into `outputs/` — this is the primary action
3. **Copy to shared outputs** if the deliverable has cross-project value
4. **Report completion** with specific file paths

## Common Pitfalls

### ❌ Reading without writing
The #1 failure mode. Agents read files, analyze, plan — then run out of budget before producing anything. **Always write first.**

### ❌ Announcing intent instead of executing
"I will now produce X" is not a deliverable. The file is the deliverable.

### ❌ Claiming files exist that don't
Never say "I already wrote X" without verifying. Use `ls` to confirm.

### ❌ Over-investigating before acting
You don't need perfect information to write a first draft. Write rough, refine later.

## How to Produce Deliverables

### The Write-First Pattern
1. Call `write()` as your **first tool call**
2. Content can be rough — 80% correct is fine
3. Refine in subsequent iterations if needed

### File Naming Conventions
- Milestone outputs: `milestone-1-description.md`
- Tracking files: `day1-metric-tracking.md`
- Plans: `improvement-plan.md`
- Inventories: `component-inventory.md`

## Agent Types and Roles

| Agent | Role | Primary Action |
|-------|------|---------------|
| Orchestrator | Plans iterations, assigns tasks | Writes task guidance |
| Worker | Executes tasks, produces files | Writes deliverables |
| Heartbeat | Monitors system health | Checks metrics |

## Quality Bar
- Every iteration MUST produce at least one file
- Files should be actionable, not just descriptive
- Include concrete next steps in every document
- Reference specific file paths, not vague concepts

## Getting Help
- Check `project.md` for current milestones
- Check `outputs/` for what's already been produced
- Check `journal.md` for iteration history (read-only)
