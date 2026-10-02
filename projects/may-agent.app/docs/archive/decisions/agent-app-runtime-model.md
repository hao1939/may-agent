# Agent App runtime model (superseded)

**Historical context:** [App Contract](../../2a-design/agent-app.md). Retained rationale and evidence; this record does not define the current contract.

This proposal introduced the Agent App boundary but used explicit
`ownerEntry`, `taskWorkflows`, `taskRoutes`, assignment, reviewer, and watchdog
configuration. Those mechanisms were removed during the convention-first
reconciliation migration.

The current design is
[`app-task-reconciliation-model.md`](app-task-reconciliation-model.md). Current
authoring guidance is
[`handler-authoring.md`](../../2b-manual/handler-authoring.md).
