# May-agent App Workflows

Reusable project task workflows for May-agent platform planning, review, and
task execution belong here when they are useful enough to outgrow direct owner
handling.

`app.ts` correlates planning and signal events to tasks; reconciliation invokes
an app-local workflow or falls back to `tech-lead`. May remains the human-facing
deputy and system-escalation path, not the owner of this project.
