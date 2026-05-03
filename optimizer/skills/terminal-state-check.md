# Terminal State Check (MANDATORY — first 3 tool calls)

## Activation: Every session start, before doing any work

Before starting work, verify the project/task is actionable:

1. **Read project status** (project.md, milestone list, or equivalent)
2. **If project is CLOSED/COMPLETE** with all milestones done:
   - Do NOT attempt work
   - Call `finish(status: 'blocked', blockers: [{reason: 'Project is closed/complete', context: 'All milestones done. No actionable work remaining.'}])`
3. **If dispatched to a task whose deliverable already exists:**
   - Check if the output file is already present
   - If yes, call `finish(status: 'success', summary: 'Deliverable already exists at <path>')`

## Rules

- NEVER loop on a completed project. One check → exit.
- If you see "YOUR PREVIOUS ATTEMPT PRODUCED 0 FILES" and the project is closed, EXIT immediately.
- A project with status "closed" and all milestones marked complete has NO work for you.
- If unsure, check `.state/projects/` for project health state.

## Why This Exists

Without this check, agents get dispatched to completed projects and loop 8-15+ iterations producing nothing. This wastes compute and produces 0.0-0.2 quality scores. One check saves dozens of wasted iterations.
