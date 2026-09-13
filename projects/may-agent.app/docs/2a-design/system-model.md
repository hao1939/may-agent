# System Model

**Design status:** Accepted.
**Implementation status:** App Tasks, bounded conversational work, shared reads,
and event-driven follow-through are implemented at the [source baseline](../README.md).
The accepted baseline below uses one Task execution lifecycle for Conversation,
ordinary work and maintenance, with explicit outcomes and owner-controlled
closure. Shared execution replaced separate conversation execution and
supervision in [#158](../proposals/conversation-input-unification.md). At reviewed
Host `649d801c`, old Task mode names remain in the SDK; their removal is tracked
separately in [the simplification proposal](../proposals/authority-boundary-simplification.md).
The focused Conversation review at Host `99bc1a31` confirms accepted Request
storage, durable turn Stop and Esc/button bindings. Current-turn steering remains
[open](human-control-surfaces.md#current-turn-control); App judgment
needs separate [behavioral evidence](message-lifecycle.md#current-implementation-and-gaps).

May helps a human discuss, decide and get useful work done. An App owns a
responsibility and decides what a useful outcome means. The Host records work,
runs bounded execution, and preserves truthful state through waits and failures.
An agent, workflow or native executor performs the work within that boundary.

**Discuss in Conversation. Track accepted asks as Requests. Delegate Tasks when
work needs independent execution.** Underneath, the Conversation itself uses
one stable Task to handle its inputs; the human need not manage that execution
identity to chat.

## The records

| Concept | What it means |
| --- | --- |
| Conversation | The shared discussion: human, May, command and tool messages |
| Request | An accepted ask that May must close the loop on |
| Turn | One bounded attempt handling Conversation input, including model calls, tool use and verification |
| Task | An App-owned execution identity that accepts input, records outcomes and remains available until explicitly closed |
| Attempt | One bounded execution of a Task, returning evidence and a proposed result |
| Event | Input or a reported change; declared routes determine what wakes |
| Topic | Related discussion and exact Task references, with no execution lifecycle |

These concepts do not each require a service or controller. Task results are
accepted evidence for the exact work considered. Sessions, queues, leases, traces
and metrics support execution or explain it; they do not own additional work.
An inbox item tracks admitted input handling; a model step is one internal
cycle. [Message Lifecycle](message-lifecycle.md#mental-model) owns the detailed
vocabulary and its current code-name mismatches.

A Request can span turns and link Tasks. Ending a turn, starting a Task, and
fulfilling the ask are different outcomes. Current Host `AppRequest`/inbox rows
track input handling, which can finish at handoff. Separate `conversation_requests`
records retain the accepted scope, revision, exact Task links and closure.
The App judges [acceptance and closure](message-lifecycle.md#requests-acceptance-and-closure);
the Host checks revisions and persists closure with its explanation.

## One reconciliation model

```text
input or change -> wake Task -> read current state -> bounded attempt
  -> validate and record outcome -> release execution
  -> rest, or handle relevant pending input

App / parent agent / human -> close Task -> prevent further execution
```

Use this loop for ordinary work, maintenance and Conversation. The controller
never needs to judge whether a responsibility should last forever. A Task stays
available until an authorized owner closes it. A quiet Task needs no running
agent or model polling. Timers are optional inputs, not a separate Task mode.

Producing a result and closing its Task are distinct. A parent can consume a
child's accepted result while the child stays open for follow-up. Ordinary Apps
usually close work after its result is accepted; Conversation and maintenance
usually remain available. This is App convention, with no extra human approval
or lifecycle-manager service.

A Turn can end while a Request remains open. A Request can close while the
Conversation's Task remains available. Closing a Task prevents future execution
and retains evidence; it never implies success or silently cancels its children.
Esc/Stop ends only the current Turn, so later discussion remains possible.

[Architecture](architecture.md#one-reconciliation-model) defines the execution
boundary. The [proposal](../proposals/conversation-input-unification.md) records
controls, exact-result correlation, migration and the code deletion to prove.
Shared execution is implemented. Removing the retained `achieve`/`maintain`
SDK vocabulary is separate from that execution change and does not imply
another Task controller.

## Execution and outstanding results

For the agent's work, ask two independent questions:

- **Running:** is an execution in progress?
- **Waiting:** is a needed result still outstanding?

| Running | Waiting | Meaning |
| --- | --- | --- |
| Yes | No | Working, with no outstanding result needed from elsewhere. |
| Yes | Yes | Working while also waiting for a result; for example, preparing a review while a pipeline runs. |
| No | Yes | No current execution; a result remains outstanding. Other useful work may already be queued. |
| No | No | No current execution or outstanding wait. Work may be queued, up to date, closed, or need attention; read those facts separately. |

An execution includes its tool calls and I/O; running does not mean the model
is continuously generating text or consuming CPU. A direct tool call can keep
that execution open while it awaits its response. Such a call does not require
a persisted Condition merely to describe that it is waiting.

The agent requests an outcome and handles a completed result, a pending result
or a failure. It need not choose between infrastructure categories such as a
helper call, delegated Task or provider operation. The selected capability must
make its promise clear: does this call return the result, or has work been
accepted with a reference and a supported later return path? Code owns that
bookkeeping and cleanup. These are common meanings, not a new universal tool
schema. See the [capability boundary](system-boundary.md#core-external-capabilities-and-composition).

Task closure remains separate: an open Task is a responsibility, not proof of
running execution or waiting. Existing attempts/claims and Condition/input
links provide the durable facts. The scheduling phase describes eligibility;
do not add combined phases, duplicate running/waiting flags or an agent-wide
availability registry. A child relationship or an FYI event alone is not an
outstanding result obligation.

A Task can execute useful work while retaining outstanding dependencies. New
relevant input can start a pass without satisfying an older wait. The agent
chooses what can progress within scope and budget; code preserves the other
waits and delivers their results. Answering that new input does not fulfill an
older ask whose required result is still pending.

When a result is still needed and no useful independent work remains, end the
attempt with a durable wait.
Release its execution capacity while the Task stays open. A matching result,
other relevant input or a declared review checkpoint can wake it later. Ending
an attempt is neither closing the Task nor abandoning the Request.

| Current facts | Human-facing explanation |
| --- | --- |
| An attempt is running; results remain outstanding | Working on the review; also awaiting pipeline 42. |
| No attempt is running; an external result is needed | Waiting for pipeline 42; no parent execution is running. |
| No attempt is running; useful work is ready | Queued to continue the review. |
| Current inputs are handled; no results remain outstanding | Up to date; available for later input. |
| Progress needs an owner's decision | Needs attention: explain the decision and what can still proceed. |

Idle is only an execution observation. It cannot establish that work is complete
or that a wait is sensible. Likewise, waiting for a worker's answer does not
prove that worker is currently running. Read its current status when making
that claim, and keep a missing/unknown result distinguishable from completion.

The same agent profile can serve several Tasks. One Task waiting does not make
that agent globally unavailable. Within one Task, preserve one current attempt;
outstanding dependencies do not authorize a second competing parent attempt.

**Implementation limit:** current Task state already retains waits during a
later running attempt. The canonical typed dependency path submits new work
when the parent returns `waiting`; it does not yet express immediate parent
continuation after that handoff without another wake. Human Task detail also
hides its ordinary wait list during running execution. The agent protocol still
requires explicit Condition mechanics for some sources. The
[clarification review](../archive/reviews/ownership-boundary-review-20260913.md#clarification-review-execution-and-pending-results)
records the evidence and scoped changes; this model does not claim those gaps
are already fixed.

## A turn or a Task?

Here “Task” means delegated work visible to the user; the common underlying
execution mechanism does not turn discussion into a background assignment.

Conversation is the default for discussion and joint work, across as many turns
as useful. May can investigate, edit, verify and answer directly within the
human's authorization. Length, complexity and tool use do not require delegation.
A Turn can repeat work, checks and repairs until it produces an appropriate
answer or reaches an explicit stopping point. "Bounded" limits execution cost;
it does not restrict the Turn to one model response or imply fulfillment when
time runs out. [Turn behavior](message-lifecycle.md#frontend-one-bounded-turn)
defines the stopping points.

Delegate a Task for an authorized outcome that can advance independently and needs
background continuation, later work control or restart-safe execution. Its
findings return to the discussion, which stays interactive. May can own an
ordinary Task; another App fits when it owns the responsibility, has the needed
authority, or supplies useful expertise. A matching name alone is not a handoff
requirement. Existing ownership and operation controls still apply.

[Message Lifecycle](message-lifecycle.md) owns the interaction and approval rules.

## One example, from ask to outcome

The intended complete flow is:

```text
Human: "Help me compare these two approaches."
  -> May recognizes the Request and explains the comparison it will make
  -> human and May discuss the tradeoffs in Conversation
  -> an authorized independent benchmark becomes a Task
  -> Host persists the Task and schedules a bounded attempt
  -> executor works, checks evidence and repairs within its budget
  -> executor returns a proposed result
  -> Host validates and commits the result under the App's acceptance rules
  -> the benchmark owner may close its Task; the result remains readable
  -> Task event routes through its saved Conversation link into the inbox
  -> the conversation handler explains the comparison and closes the Request
```

The comparison can finish entirely in Conversation if no independent work is
needed. “The benchmark is running” can finish a turn while the comparison
Request remains open. If the ask was only to start the benchmark, confirmed
admission may fulfill that narrower ask. Closure follows the accepted scope.
The source supports this tracking and closure; storage tests alone do not prove
that May consistently judges the accepted scope correctly in real discussion.

The same flow has ordinary branches:

| What happens | What follows |
| --- | --- |
| The attempt can fix a failed check | Work/check/repair continues inside its existing budget; after it returns, later work needs another attempt |
| Part of the work needs an external fact or decision | Preserve its return route; continue useful independent work within budget. End the attempt with a durable wait when nothing else can progress |
| Execution fails | Preserve evidence and contain the failure; use bounded retry when justified, otherwise expose the decision the App needs to make |
| The original goal is no longer worthwhile or possible | The App seeks or applies an authorized scope/stop decision; inability to finish is never reported as success |
| The human cancels a Task | Preserve its evidence and reject late effects/results under the cancellation fences |
| The Host restarts | Retain Task identity and accepted state; restore eligibility and prefer affordable safe redo to elaborate resumption |

Repeating reconciliation is safe only when the App observes prior external
effects before repeating them. SQLite cannot make arbitrary provider actions
exactly once. A process exit or an agent's success claim is evidence, not
accepted completion.

The accepted design uses one conversation handler for human messages and
linked Task facts. An ordinary timer signal first runs a bounded database check
for missed follow-up; qualifying reviews enter the same inbox. The handler
reads current Task evidence and Request scope, then responds or completes
quietly. Its stable conversation Task runs the handler; it needs no separate
supervisor or waiting execution. Human input has priority over pending system
reviews; an active review remains bounded.
[Message Lifecycle](message-lifecycle.md#one-conversation-input-path) owns the
routing, authority and replay rules.
Stopping a conversational turn, cancelling a Task and ending a watch have
[separate effects](human-control-surfaces.md#current-turn-control).

## Core and replaceable capabilities

> Removal should degrade capability, while preserving the remaining system's correctness.

The four core responsibilities are **App registration and input admission**,
**Events**, **State and storage**, and **Work runtime**. Shared timing and default
failure containment are mechanisms within that core. These are ordinary
modules, not four required services.

Concrete Apps, interfaces, executors, observers, schedule producers and reports
attach to those contracts. Useful execution needs a suitable App and executor,
but their implementations are replaceable. Removing an interface must not stop
Tasks; removing a selected executor may block its Tasks but must preserve their
state and let unrelated work continue. Optional schedules do not control Task
activation or required recovery.

For Conversation, core preserves input ownership and the consistency of messages,
accepted Requests and exact links. The conversation handler, May's judgment and
presentation are replaceable. Removing them may remove chat or proactive
follow-through, while retained asks remain visible and unrelated Tasks continue.
The [component split](architecture.md#conversation-core-and-capability-boundary)
and [state API](storage.md#conversation-state-api) make this boundary explicit.

Events integrate meaningful input, changes and wakes. Typed local calls handle
reads, execution and atomic state changes. No broker, API server or event for
every storage operation is required. [Architecture](architecture.md) owns the
component boundaries, absence behavior and code organization.

## Names and detailed contracts

In this workspace, **May** is `app:may`, with policy in `projects/may.app`.
An identifier such as `agent:may` names an execution profile, not a privileged
role. The ordinary App `app:may-agent` maintains May, with its domain policy
in `projects/may-agent.app`. This directory also hosts the system documentation;
that location does not make the maintenance App part of core. The generic Host
implementation lives in `projects/may-agent` and does not require these specific
App identities to execute unrelated work.

Read [Architecture](architecture.md) for how the components fit,
[App Contract](agent-app.md) for declarations,
[Task Resource Engine](task-resource-engine.md) for transitions,
[Events](events.md) for integration, and [Storage](storage.md) for authority.
