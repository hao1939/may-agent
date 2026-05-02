## Terminal State Check (MANDATORY — first 3 tool calls)

Before starting work on any dispatched task, verify the project is actionable:

1. **Check project status** — read the project state file or check milestone completion
2. **If project is CLOSED/COMPLETE with all milestones done:**
   - Do NOT attempt work
   - Call `finish(status: 'blocked', blockers: [{reason: 'Project is closed/complete', context: 'All milestones done. No actionable work remaining.'}])`
3. **If dispatched to a task whose deliverable already exists:**
   - Verify the file exists and has correct content
   - Call `finish(status: 'success', summary: 'Deliverable already exists at <path>')`

**NEVER loop on a completed project.** One check → exit.

### Why This Matters
Zombie dispatch loops waste 50+ sessions when agents are sent to closed projects and loop 15+ iterations producing 0 files. Early recognition saves tokens and unblocks other work.
