# Agent App runtime model (superseded)

This proposal introduced the Agent App boundary but used explicit
`ownerEntry`, `taskWorkflows`, `taskRoutes`, assignment, reviewer, and watchdog
configuration. Those mechanisms were removed during the convention-first
reconciliation migration.

The current design is
[`app-task-reconciliation-model.md`](app-task-reconciliation-model.md). Current
authoring guidance is
[`handler-authoring.md`](../2b-manual/handler-authoring.md).
