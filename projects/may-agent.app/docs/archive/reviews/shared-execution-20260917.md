# Shared agent/workflow execution — 2026-09-17

Status: source candidate, local activation pending.

The owning contract is [Workflow execution](../../2a-design/workflows.md).
This candidate carries one live Task execution context through managed-agent,
workflow and Conversation entry points. The context contains existing fenced
capabilities and snapshots; it is not serialized as another work state. The
shared managed-agent scope handles feedback subscriptions and cleanup. Model
workflow invocation uses exact caller identity, structured input and the caller's
remaining cancellation scope. Task-owned history recovers through its Task.

Portable tests exercise the real loader, workflow runner, managed agents and
controlled tool execution with synthetic provider responses. Concurrent calls by
the same agent retain distinct Task contexts. A correction reaches the matching
active specialist and remains unacknowledged. Cancellation drains both callers
and specialists and removes subscriptions. Existing process composition tests
cover subprocess cancellation; Task runtime tests cover durable input and restart.

These checks do not establish semantic understanding of arbitrary corrections,
preemption of synchronous JavaScript or durable continuation of `await`. Live
trial evidence and exact revisions will be recorded when activation completes.
The [May iteration](../../../../may.app/docs/shared-execution-iteration-20260917.md)
owns team-policy changes and domain evidence reuse.
