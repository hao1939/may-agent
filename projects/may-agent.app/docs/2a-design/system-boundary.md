# Host And App Boundary

**Design status:** Accepted.
**Implementation status:** The shared Task boundary is implemented for current
Apps. Named-agent permissions, deployment policy and private maintenance still
contain [domain-policy gaps](../proposals/app-policy-and-host-boundary-cleanup.md).
Task runtimes and test fixtures use resource authority; the legacy JSON
store and completed offline cutover path have been removed. The retired inbox
delivery table is retained only as historical schema evidence. Incident-shaped public
inputs remain a convergence gap rather than an alternate accepted boundary.

The responsibility split is:

```text
Host = persist, schedule, run, recover, validate controls, expose results
App  = define meaning, policy, desired outcomes, acceptance and closure convention
```

Infrastructure and runtime are both part of the Host. Infrastructure is what
the Host uses—storage, timers, model providers, processes, and transports.
Runtime is the code that connects and operates those things. Neither is a
third owner or something an App composes.

## The boundary in one flow

```text
event
  -> Host validates and stores it
  -> explicit event route creates any linked responsibility
  -> App decides what domain work means
  -> Host runs bounded work when the App asks
  -> App decides whether the result is enough
  -> Host stores, recovers, and exposes the result
```

The Host does not invent domain work. The App does not implement storage,
queues, retries, recovery, or presentation transport.

## Ownership and intervention

Use the same division of responsibility for normal results and difficult cases:

| Responsibility | Owner |
| --- | --- |
| Preserve accepted work, schedule attempts, validate identity and controls, recover execution, expose truthful state | Host core |
| Perform external I/O, translate a provider protocol, bound operations and report observations | Executor or source adapter |
| Judge progress and choose how to continue, wait, steer, or report a result within the assignment | Task's worker, under App policy |
| Judge scope, coordinate help, accept an outcome, revise or close the assignment | Assigning App, parent agent, or human |
| Review a problem the normal owner cannot handle | Installation-selected supervisor, within granted scope |

These are responsibilities, not five new services or a required agent hierarchy.
The same App or agent can perform more than one role. The Task remains the
durable execution identity. A supervisor uses existing App inputs and exact
controls; it does not directly revive a worker session or overwrite Task state.

Starting work establishes its feedback owner through trusted existing identity.
An awaited tool returns directly. Independent asynchronous work returns through
its Task/caller link; supported external observations use their declared App
route. Agents do not register a second watch for work the system already owns.
Conventions still require a source adapter: arbitrary shell commands cannot
automatically expose every external resource they create.

Delegation does not require the parent to stop all work. Ending an attempt is
appropriate when useful independent work is exhausted or its bound is reached.
A retained dependency may coexist with a running attempt. Keep lifecycle,
execution and outstanding results separate as described in
[System Model](system-model.md#execution-and-outstanding-results).

The recipient's name does not select a lifecycle. An agent can perform a
bounded helper call or execute a durable Task. A provider operation such as a
pipeline already owns its external execution; its caller Task owns interpreting
the result. Such an operation needs a durable reference and supported feedback
route before the parent releases execution, but not an automatic wrapper Task
or new agent. A call-scoped subprocess instead returns directly and is cleaned
up with that call. Ending the attempt must respect that distinction.

Events notify the owner that something deserves attention. The handler rereads
current state, judges what remains necessary and uses the same bounded Task
execution path. A periodic check does the same after a missed notification.
This is what reconciliation means here: compare the intended outcome with
current facts and act through the existing owner. It is not another lifecycle.

| Situation | Handling |
| --- | --- |
| Owner is busy | Preserve pending feedback; keep one executing attempt for the Task. |
| Execution disappeared | Fence it and recover the same Task under existing policy. |
| Worker cannot progress within scope | Report the blocker, attempted alternatives and useful remaining work to its assigning owner. |
| Task was closed or cancelled | Retain late evidence; do not reopen it because a notification arrived. |
| Task is unexpectedly missing | Report to its owning App; do not guess a replacement Task. |
| Owning App cannot accept feedback | Preserve the delivery problem; use one explicit supervisor route if installed. |
| Supervisor is unavailable | Expose the unresolved problem for human attention; stop fallback traversal. |

Fallback reports a problem with references to the original work. It does not
reassign that work, replay its action under a different authority, enable an
App, or grant new permissions. Unknown public targets remain validation errors;
an unhandled record-only fact needs no fallback. Publication and routing labels
are not proof that an agent accepted responsibility.

Silence and repeated errors are evidence for judgment. An explicit attempt or
operation budget is a mechanical execution limit; reaching it must preserve
the Task and report the interruption honestly. Agents choose actions, rather
than tracking timers. Intervention can wait for the current execution boundary
unless a demonstrated need justifies review while a helper is still running.

**Implementation limit:** Task ownership, caller feedback and mechanical recovery
exist. Automatic supervisor fallback, review during an awaited helper, and
replacement of the current silence policies remain deferred. Legacy session
helpers also retain exceptions to this boundary. The
[ownership review](../archive/reviews/ownership-boundary-review-20260913.md)
separates reproduced gaps from source findings; the
[feedback proposal](../proposals/execution-feedback-and-review.md) records the
implemented candidate repairs. This contract does not claim universal delivery
or supervision is already implemented.

## Plain names

Host and App identify responsibility. Core and replaceable capabilities identify
which dependencies may be absent without breaking the remaining system. Both
core mechanics and optional adapters can live in Host code. See
[System Model](system-model.md) and the
[Architecture](architecture.md#core-responsibilities) for that separate axis.
These record names are useful:

- **Request** — an accepted ask whose outcome must be returned to the caller;
- **task** — the App-owned execution identity that records outcomes and remains available until explicitly closed;
- **fact** — something observed or reported; and
- **attempt** — one bounded agent or workflow run.

Inbox item, event, session, workflow run, queue entry, claim, lease, condition,
trace, and projection are code or storage details. They do not own work.

## Host

The [four core responsibilities](architecture.md#core-responsibilities) are
App registration and input admission, Events, State and storage, and Work runtime.
Together they persist accepted work, coordinate bounded attempts, recover and
expose truthful results. Interfaces and other concrete capabilities attach to
those contracts.

Failure containment stays with admission and execution. The Host preserves
evidence, releases resources and applies known bounded responses. Apps or LLMs
judge uncertain diagnosis, repair and scope. Metric-service placement remains
[deferred](../archive/reviews/error-handling-and-conversation-discussion-20260910.md);
existing measurements cannot become acceptance authority.

The Host also validates and loads complete App definitions. Reload either
publishes a complete replacement or keeps the previous definition active.
Replacing Host code is a separately authorized deployment operation. The
responsible App owns the desired change and acceptance; installation policy
grants operational scope; deployment tooling enforces exact artifact checks,
safe activation and recovery. A particular App name is not a core authority.

The current deployment scripts still require a canonical `may-agent` Task.
That installation-specific restriction remains in force until a tested
replacement exists; this boundary correction does not grant other Apps
deployment access. The exact procedure belongs in
[Operations and Recovery](../2b-manual/app-operations-recovery.md#runtime-deployment-target),
not in the generic App contract.

Host maintenance may inspect and repair Host-owned state. If it discovers a
domain decision, it publishes a fact to an App. A maintenance file cannot
launch an App agent, workflow, task, or escalation directly.

## App

An App defines:

- its address and input schema;
- how actionable inputs and facts resolve to tasks;
- which bounded executor handles work;
- the desired outcome and acceptance evidence for a task; and
- domain reads, actions, observations, and metrics.

An App is source code and domain files. It has no daemon, database, event loop,
scheduler, queue, retry worker, or recovery worker of its own.

## Request and task

May owns recognizing and closing conversational Requests; the Host stores the
related state and validates effects. The current Host inbox row is narrower:
it correlates an input with handling and may finish before the conversational
ask is fulfilled. [Message Lifecycle](message-lifecycle.md#current-implementation-and-gaps)
owns that implementation distinction. Request tracking adds no execution owner.

When a caller asks an App for durable work, the Host records an inbox item and
links it to the Task that owns the outcome:

```text
inbox item -> Task owned by the App -> accepted result
```

A conversational frontend may finish authorized work directly or admit durable
intent/feedback. [Message Lifecycle](message-lifecycle.md) owns May's policy and
Topic-linked follow-up through the same conversation handler; it does not add
another Task lifecycle. The accepted [baseline](../proposals/conversation-input-unification.md)
makes one stable Task the Conversation's actual execution owner, with no second
executing inbox handler. Outcomes can be accepted while the Task stays open;
an App, parent agent or human decides when to close it. The Host enforces that
decision and preserves evidence without inferring responsibility lifetime.
This lifecycle and the shared-input route are implemented in merged
[Host PR #158](https://github.com/hao1939/may-agent/pull/158), source `f5d5a535`.
Release/deployment was not verified by this source review; the proposal records
the paired App and cutover requirements. The source also uses direct admission for ordinary App input:
a saved input and its Task link replace inbox execution claims. The
[cleanup review](../proposals/controller-poc-deeper-review.md#direct-admission-cleanup)
records failure recovery, exact result projection and the accepted costs.

A simple task may converge on its first bounded attempt. Harder work keeps the
same task identity across exact waits and later attempts:

```text
Task -> check current state -> run one bounded attempt
     -> record outcome, wait for an exact fact, require attention, or try again
     -> owner may close the Task independently of accepting an outcome
```

The inbox item retains caller correlation and the Task owns execution.
Conversational closure follows the accepted ask and its communicated outcome,
which can require more than a Task result alone. Sessions and workflow runs are
attempt evidence and may be replaced after a restart.

## Facts and time

A fact never starts model work by itself. An App must declare how that fact is
used:

```text
fact -> request
fact -> task or exact task wake
fact -> observation only
```

If no route matches, the fact remains a fact. The Host does not guess an owner.

A schedule has one destination: create an App input or publish a fact. An
observer reads external state and returns facts. A metric records what
happened; it does not become work state.

For conversational follow-up, a timer fact asks Host routing to check stored
links and handled outcomes. Only qualifying work enters the same durable inbox
as human input and linked Task facts, with system origin preserved. The App
judges the response; it does not implement the scan, queue or retry mechanism.
This optional discovery tick is separate from required Host recovery.

## Execution

The Host has one bounded execution implementation for direct, Gym, App-agent,
and workflow runs. It owns provider calls, tool permissions, timeouts,
cancellation, transcripts, and the common execution result.

A workflow receives typed App input and narrow capabilities. It does not
receive the database, event bus, scheduler, queues, manager, global paths, or
recovery state. A workflow finishes its attempt; it does not stay alive as a
background controller.

## Recovery

Recovery repeats mechanics, not meaning:

```text
unfinished stored request or task
  -> fence stale attempt
  -> repair known Host state
  -> run the same obligation again when allowed
```

Recovery cannot invent a new task, owner, strategy, or completion claim.
Apps with paused task reconciliation continue to store new work but do not
start task attempts.

Continuing the same obligation may mean rerunning an attempt from its input.
Precise session or step resumption is not required by this boundary. Prefer
safe redo when its cost is acceptable; retain additional progress only when
it earns its complexity. See the
[redo-versus-resume rule](../1-principles/core-principles.md#prefer-redo-when-it-is-simpler-and-affordable).

## Public boundary

Apps use `@may-agent/sdk` to describe input, policy, desired work, facts, and
bounded workflows. The SDK does not expose SQL, files and locks, queues,
leases, scheduler handles, event-bus handles, process recovery, delivery
internals, or global paths.

External interfaces have one state-changing operation:

```text
publish(event)
```

The event type selects one of four existing Host meanings: App input, reported
fact, exact task/session control, or Host lifecycle control. `get(eventId)`
reads admission and linked outcomes; `subscribe(filter)` observes Events.
Adapters do not call App agents or the model runner directly, and Apps do not
receive this Host interface.

## Extension rule

When adding a feature, ask two questions:

1. Is this stable mechanics? Put it in the Host.
2. Is this meaning, policy, desired outcome, or acceptance? Put it in the App.

Add an SDK capability only when an App responsibility cannot be expressed with
the current typed boundary. Add the narrowest operation needed; do not expose a
generic query, command, service locator, database, path bag, or runtime context.

## Review checklist

- Can the design be explained using Host and App without a third owner?
- Is work stored before it runs?
- Does every caller result correlate to one request and every durable outcome
  belong to one Task?
- Does the App decide meaning and completion?
- Does the Host own execution, concurrency, restart, and result exposure?
- Can a fact start work only through an explicit App route?
- Are sessions and workflows bounded attempts rather than hidden controllers?
- Is any new public capability smaller than exposing Host internals?
