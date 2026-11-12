# Task-owned Host simplification

Implemented and merged in [Host #449](https://github.com/hao1939/may-agent/pull/449).
The [source integration record](../archive/implementation/task-owned-host-simplification-20261111.md)
retains the decision, exact paired revisions, measurements and verification.

Current behavior is owned by [Conversation execution](../2a-design/conversation-execution.md),
[the App contract](../2a-design/agent-app.md), [workflows](../2a-design/workflows.md#crash-recovery),
[sessions](../2a-design/sessions.md) and [scheduling](../2a-design/cron.md).
Use [Operations and Recovery](../2b-manual/app-operations-recovery.md#upgrade-retired-task-contracts)
for the separate stopped upgrade. Merge does not establish deployment.
