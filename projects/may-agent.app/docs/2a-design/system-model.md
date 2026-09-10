# System Model

**Design status:** Accepted.
**Implementation status:** App Tasks, bounded conversational work, shared reads,
and event-driven follow-through are implemented at the [source baseline](../README.md).
The focused Conversation review at Host `99bc1a31` confirms accepted Request
storage, durable turn Stop and Esc/button bindings. Current-turn steering remains
[open](human-control-surfaces.md#current-turn-control); App judgment
needs separate [behavioral evidence](message-lifecycle.md#current-implementation-and-gaps).

May helps a human discuss, decide and get useful work done. An App owns a
responsibility and decides what a useful outcome means. The Host records work,
runs bounded execution, and preserves truthful state through waits and failures.
An agent, workflow or native executor performs the work within that boundary.

**Discuss in Conversation. Track accepted asks as Requests. Use Tasks when
work needs independent execution.**

## The records

| Concept | What it means |
| --- | --- |
| Conversation | The shared discussion: human, May, command and tool messages |
| Request | An accepted ask that May must close the loop on |
| Turn | One interactive execution, including repeated model calls, tool use and verification |
| Task | An App-owned outcome that can progress independently across attempts |
| Attempt | One bounded execution of a Task, returning evidence and a proposed result |
| Event | Input or a reported change; declared routes determine what wakes |
| Topic | Related discussion and exact Task references, with no execution lifecycle |

These concepts do not each require a service or controller. Task results are
accepted state. Sessions, queues, leases, traces and metrics support execution
or explain it; they do not own additional work.
An inbox item tracks admitted input handling; a model step is one internal
cycle. [Message Lifecycle](message-lifecycle.md#mental-model) owns the detailed
vocabulary and its current code-name mismatches.

A Request can span turns and link Tasks. Ending a turn, starting a Task, and
fulfilling the ask are different outcomes. Current Host `AppRequest`/inbox rows
track input handling, which can finish at handoff. Separate `conversation_requests`
records retain the accepted scope, revision, exact Task links and closure.
The App judges [acceptance and closure](message-lifecycle.md#requests-acceptance-and-closure);
the Host checks revisions and persists closure with its explanation.

## A turn or a Task?

Conversation is the default for discussion and joint work, across as many turns
as useful. May can investigate, edit, verify and answer directly within the
human's authorization. Length, complexity and tool use do not require a Task.
A Turn can repeat work, checks and repairs until it produces an appropriate
answer or reaches an explicit stopping point. "Bounded" limits execution cost;
it does not restrict the Turn to one model response or imply fulfillment when
time runs out. [Turn behavior](message-lifecycle.md#frontend-one-bounded-turn)
defines the stopping points.

Use a Task for an authorized outcome that can advance independently and needs
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
  -> May brings the findings back, explains the comparison and closes the Request
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
| Work needs an external fact or decision | Record the exact wait, release execution capacity, and reconsider on relevant input or a due review |
| Execution fails | Preserve evidence and contain the failure; use bounded retry when justified, otherwise expose the decision the App needs to make |
| The original goal is no longer worthwhile or possible | The App seeks or applies an authorized scope/stop decision; inability to finish is never reported as success |
| The human cancels a Task | Preserve its evidence and reject late effects/results under the cancellation fences |
| The Host restarts | Retain Task identity and accepted state; restore eligibility and prefer affordable safe redo to elaborate resumption |

Repeating reconciliation is safe only when the App observes prior external
effects before repeating them. SQLite cannot make arbitrary provider actions
exactly once. A process exit or an agent's success claim is evidence, not
accepted completion.

May's existing supervision Task observes exact Topic-linked Tasks and can
return updates or steer work. It neither parents nor copies those Tasks.
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
accepted Requests and exact links. The frontend, May's judgment/supervision and
presentation are replaceable. Removing them may remove chat or proactive
follow-through, while retained asks remain visible and unrelated Tasks continue.
The [component split](architecture.md#conversation-core-and-capability-boundary)
and [state API](storage.md#conversation-state-api) make this boundary explicit.

Events integrate meaningful input, changes and wakes. Typed local calls handle
reads, execution and atomic state changes. No broker, API server or event for
every storage operation is required. [Architecture](architecture.md) owns the
component boundaries, absence behavior and code organization.

## Names and detailed contracts

**May** is `app:may`, with policy in `projects/may.app`. An identifier such as
`agent:may` names an execution profile. **Host Operations** is `app:may-agent`,
with policy and these docs in `projects/may-agent.app`; it owns Host changes.
`projects/may-agent` contains the generic Host implementation.

Read [Architecture](architecture.md) for how the components fit,
[App Contract](agent-app.md) for declarations,
[Task Resource Engine](task-resource-engine.md) for transitions,
[Events](events.md) for integration, and [Storage](storage.md) for authority.
