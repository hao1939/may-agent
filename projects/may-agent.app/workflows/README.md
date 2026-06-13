# May-agent App Workflows

Project-specific workflow-backed handlers for May-agent platform planning,
review, and task execution belong here when they are useful enough to outgrow
the default May owner workflow.

The current app starts simple: `app.ts` routes planning events to May through
the shared `verify-wrap` workflow. Add app-local workflows only when the task
shape is stable and reusable.
