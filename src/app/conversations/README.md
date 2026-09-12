# Human interaction within the Task loop

Conversation describes a Task's interaction with a human. It keeps messages,
Topics and accepted Requests; the Task owns execution, waits, retry and closure.
This directory supplies context and agent judgment for that role. It has no
controller or independent execution claim.

## Follow one input

```text
human input / linked Task outcome / relevant timer-discovered change
  -> durable input on the same stable Task
  -> common Task claim and bounded attempt
  -> prepare human context and invoke the App's agent
  -> commit answer, Request updates and authorized effects together
  -> release execution; run again for pending input or paced retry
```

[`context.ts`](context.ts) selects bounded messages, Topics, Requests and canonical
Task observations. [`turn-agent.ts`](turn-agent.ts) invokes the model/tool runner
and validates `ConversationTurnResult`. The agent can answer, request a handoff,
or apply an authorized control; it does not manage admission receipts or retry.
The `conversation_context` tool reads omitted history and full Request records.

[`composition/conversation-task-turn.ts`](../composition/conversation-task-turn.ts)
prepares the judgment under the current Task claim and validates contextual
handoff/control targets. [`composition/task-execution.ts`](../composition/task-execution.ts)
wires this handler into the [Task runtime](../core/tasks/README.md), which owns
capacity, attempts, session binding, cancellation and backoff for every Task.
A handler-specific result shape is not a second lifecycle.

## Durable effects and follow-through

[`core/state/conversation-task-turns.ts`](../core/state/conversation-task-turns.ts)
commits the reply, Topic selection, Request updates, Task result and any admitted
work or authorized control in one fenced transaction. Failed settlement retains
the input for normal Task retry. Rejected proposals do not publish a misleading
reply. Previous-attempt facts let the App correct its decision after backoff,
including after storage reopen; there is no extra conversational retry loop.

A handoff links the responsible Task to the caller's Topic and, when declared,
accepted Request. Linked answers, honest failure reports and owner closures
return as durable input. Intermediate waits remain readable without executing
the caller. Live events provide prompt return; bounded discovery finds missed
changes. The agent judges whether the facts resolve the accepted ask.
Completing an attempt or an inbox item does not itself fulfill a Request.

Task A can discuss with a human while B works, and B can delegate C. All use the
same Task controller. The App/parent/human owns assignment closure; an accepted
answer or worker failure report leaves the Task open.

[`core/state/conversations.ts`](../core/state/conversations.ts) owns message and
Topic reads, including canonical resolution of short Topic references.
[`core/state/conversation-requests.ts`](../core/state/conversation-requests.ts)
owns accepted asks, revision checks and exact Task links. These are product
records and projections, not schedulers or additional work lifecycles.

## Controls and boundaries

Console Esc and interface Stop buttons address an exact observed Turn. Task
state records the stop before local execution is aborted, rejects late output,
and preserves newer input and the accepted ask. Delegated Tasks continue.
Closing the stable Task is a separate authorized owner action.

Omitting this handler leaves its input visible and prevents execution through
an old inbox owner; other Task handlers continue to work. The candidate refuses
cutover when unfinished legacy input still has a different execution owner.
The isolated old-to-new daemon fixture verifies shutdown, conversion and fresh
input after restart. Its [procedure and limits](../../../test/README.md#shared-task-execution-coverage)
do not certify an installation-specific rollout or rollback.

Start verification at `core/tasks/conversation-runtime.test.ts` for actual
execution and `core/state/conversation-task-turns.test.ts` for atomic effects and
reopen. `turn-agent.test.ts` owns context tools and result validation. The
[test coverage map](../../../test/README.md#shared-task-execution-coverage)
records migration of old callback tests and its remaining limits.

The canonical design and PoC facts live in the sibling App project's
`docs/proposals/conversation-input-unification.md`; this guide describes the
candidate source, not a deployed release.
