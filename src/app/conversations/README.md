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
and supplies the core-selected result schema to the finish tool. The agent can answer, request a handoff,
or apply an authorized control; it does not manage admission receipts or retry.
The `conversation_context` tool uses a read capability bound to the admitted
Conversation, even when the prompt omits its history or identity. The model
adapter receives no database handle. Its contract is `AppInputResolver` in
[`core/tasks/execution.ts`](../core/tasks/execution.ts).

[`composition/conversation-task-turn.ts`](../composition/conversation-task-turn.ts)
connects context preparation and agent execution to core-owned proposal
preparation. It binds capabilities to the admitted Conversation, independently
of the rendered context. [`composition/task-execution.ts`](../composition/task-execution.ts)
wires this handler into the [Task runtime](../core/tasks/README.md), which owns
capacity, attempts, session binding, cancellation and backoff for every Task.
A handler-specific result shape is not a second lifecycle.

## Durable effects and follow-through

[`core/state/conversation-task-turns.ts`](../core/state/conversation-task-turns.ts)
derives the reply target, reply requirement and control authority from claimed
input. It validates exact installed Task targets and prepares data-only proposals
with control target identities and observed versions. A handoff has one target
authority, `decision.followUp`; core resolves it and invokes the App’s pure Task
mapping once during settlement. No separately prepared attachment can redirect it. Task references in context help
discovery; they neither grant authority nor limit authorized exact targets.

The same core module resolves current stores at settlement and commits the
reply, Topic selection, Request updates, Task result and any admitted
work or authorized control in one fenced transaction. Failed settlement retains
the input for normal Task retry. Rejected proposals do not publish a misleading
reply. Previous-attempt facts let the App correct its decision after backoff,
including after storage reopen; there is no extra conversational retry loop.

`conversation_request` saves an accepted ask or authorized correction before
work starts, returning the saved open Request and new revision. Composition
supplies this narrow capability; core derives its App/Conversation from the
claimed input and checks the claim in the write transaction. It reuses the
Request store, cannot close asks or control Tasks, and rejects stale revisions.
The correction survives later execution failure, Stop or rejected settlement.
The same effect fence used by other Task actions rejects a save while newer
input is unreviewed; the next ordinary turn considers that input before saving.

Final `requestUpdates` may omit `scope` to retain the stored ask. A new ask
requires scope. Closure uses the current revision and commits with its reply;
it cannot change an existing scope. Simple new asks may still be accepted and
closed with one answer. No correct-and-close exception is needed. The App
judges human intent and fulfillment; code checks the stable Conversation creator
and revision. The bounded Request list prefers
open asks, then includes recent closed asks so a human can naturally correct one.

When final result settlement fails, the attempt retains `unacceptedResult`
separately from accepted state, including its originating attempt/session and
the returned facts. Each repair claim saves that evidence before execution, so
ordinary failure, interruption and restart retain it. An accepted result retires
it from future repair context; the original failed attempt remains in history.
Context preparation also reads the
current Requests named by the rejected decision, including closed asks. The
agent judges whether to repair its decision or perform more work; failed
settlement never automatically replays the proposed effects or establishes
fulfillment. This is evidence for review, not an exactly-once tool guarantee.

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

The Conversation read view derives its active Turn and Stop target from the
current Task attempt, including a successor after an owner closed earlier work.
The reader follows retained Task links and selects a running current attempt;
it does not treat the first historical link as the current owner.
Retained inbox leases remain historical evidence for inspection and offline
cutover; they cannot advertise an active Turn. HTTP and Telegram reads use that
same projection, and Telegram control tests exercise Task admission, claims and
Stop through the shared Task operations.

For delegated requirement changes, the Conversation agent uses the common
`tasks update` capability described in the [Task contract](../core/tasks/README.md#adopting-creator-revisions).
It first saves any accepted human correction in the Request, then revises work
it created through the responsible App's input contract. Saving the Request alone
does not change a worker's assignment. Worker feedback uses the same loop; no
correction-specific handler or mandatory human turn is required. Code enforces
creator authority, while the agent judges whether the change is within the
human's agreed scope. Existing direct human cancellation remains supported.

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
