# System Model

**Design status:** Accepted.
**Implementation status:** Conversation, ordinary work and maintenance use one
Task execution lifecycle. Accepted Requests, explicit outcomes, owner-controlled
closure and durable Turn Stop are implemented. Live steering of a running Turn
remains [limited](human-control-surfaces.md#current-turn-control). Source checks
do not establish the quality of App judgment or the installed release.

May helps a human discuss, decide and get useful work done. An App owns a
responsibility and decides what a useful outcome means. The Host records work,
runs bounded execution, and preserves truthful state through waits and failures.
An agent, workflow or native executor performs the work within that boundary.

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
| Execution fails | Preserve evidence and contain the failure; pace unfinished-work retries with backoff through bounded attempts; expose failure evidence so the App can judge repair, failover or owner intervention |
| The original goal is no longer worthwhile or possible | The App seeks or applies an authorized scope/stop decision; inability to finish is never reported as success |
| The human cancels a Task | Preserve its evidence and reject late effects/results under the cancellation fences |
| The Host restarts | Retain Task identity and accepted state; restore eligibility and prefer affordable safe redo to elaborate resumption |

Safe repetition follows the capability's idempotency or reconciliation contract.
Infra owns routine retries; the App/agent judges a changed recovery strategy.
An arbitrary provider action does not become exactly-once merely because its
request is stored. See [retry ownership and exceptions](system-boundary.md#retry-and-recovery-ownership).

Infra accepts the worker's judgment under the App contract. Accepted completion
is usable by default; it is not a guarantee that the judgment is correct.

Human messages and linked results use the same Conversation handler. A quiet
Conversation needs no model polling. [Conversation execution](conversation-execution.md#one-conversation-input-path)
owns routing, authority, missed-follow-up recovery and ordering.
Stopping a conversational turn, cancelling a Task and ending a watch have
[separate effects](human-control-surfaces.md#current-turn-control).


## From purpose to system responsibilities

**Supports:** [May's goal](../1-principles/purpose.md#mays-goal).

**Choice basis:** [Technical decision and review rules](../1-principles/core-principles.md#review-rule), applied to the goal's value, cost and steering requirements.

The goal is useful, verified results with decreasing supervision and acceptable
total cost, while work remains understandable and steerable. The responsibilities
below explain what the system must make possible to serve that goal. They are
reasons for the designs, not additional components. Exact contracts stay in the
linked owning documents; the [documentation hierarchy](../README.md#design-hierarchy)
defines how to follow the reasoning in both directions.

### Understand intent and close the loop

Useful results require understanding what the human needs and retaining what
was promised as discussion evolves. Conversation and accepted Requests preserve
that relationship; progress or handoff alone cannot establish fulfillment.
The agent judges intent and outcome, while infra retains inputs, accepted
decisions and delivery facts.

Owning designs: [message lifecycle](message-lifecycle.md),
[project context](projects.md), and [human control surfaces](human-control-surfaces.md).
Interfaces share those contracts: [Telegram](telegram-notifications.md),
[Web UI](webui.md), [May console](may-console.md),
[project readout](default-project-ui.md), [HTTP](http-boundary.md),
and [web terminal](web-terminal.md).

### Enable useful action within authority

Less supervision requires agents to choose and execute appropriate actions
without operating delivery machinery. Understandable context and callable
contracts support judgment; scoped execution and human controls keep the work
steerable. Agents decide, infra executes, and Apps supply domain guidance.
Known procedures can use workflows, asking an agent where judgment is needed.

Owning designs: [agents](agents.md), [SDK](sdk.md), [workflows](workflows.md),
[skills](skills.md), [native workers](native-coding-workers.md), and
[Host/App boundary](system-boundary.md). The
[capability guidance proposal](../proposals/task-execution-capabilities-20261002.md)
refines this responsibility and its connections to continued work; its proposed
interfaces remain separate from installed behavior.

### Carry work through change and interruption

Work that spans executions should not require the human to reconstruct the
assignment or repeat reminders. Retain requirements, accepted work and relevant
waiting facts, then return new input to the owner. An attempt can end while
the responsibility remains. This requires durable ownership and useful recovery,
not exact resumption of every internal step. Direct bounded work stays simple.

Owning designs: [Task engine](task-resource-engine.md), [events](events.md),
[storage](storage.md), [runtime](runtime.md), and [sessions](sessions.md).
[Cron](cron.md) and [heartbeat](heartbeat.md) supply declared time or health
observations through those owners; they do not introduce another work lifecycle.

### Improve from evidence and make problems actionable

Decreasing supervision and acceptable cost require recognizing repeated failures,
learning from successful work, and checking whether changes improve later work.
Infra retains usable evidence and executes declared observation routes. The
responsible agent judges trends and chooses repair, further observation or help.
The evidence must distinguish an accepted assessment from recovery of the work.

Owning designs: [metrics](metrics.md), [guards](guards.md),
[event traces](event-graph.md), [evaluation evidence](session-eval-trail.md),
[escalation](escalation.md), and the optional
[practice and learning integration](practice-learning-loop.md). The
[learning principle](../1-principles/evolution.md) explains when verified experience
should change knowledge or mechanisms.

### Reuse the foundation at an acceptable cost

New domains should add useful abilities without rebuilding execution and
coordination. Shared contracts and clear owners keep changes local and reduce
implementation, operation and reasoning costs. A common interface earns its
place through real use; abstraction or coverage alone does not establish value.

Owning designs: [architecture](architecture.md), [Host/App boundary](system-boundary.md),
[App contract](agent-app.md), [App layout](app-root-layout.md), and
[bounded Task reads](task-resource-read-interface.md). Shared mechanisms can
support several responsibilities; each has one contract owner.

## The shared work model

**Discuss in Conversation. Track accepted asks as Requests. Delegate Tasks when
work needs independent execution.** Underneath, the Conversation uses one
logical Task lineage to handle its inputs; normally that is one stable Task. If
its execution identity was explicitly cancelled, fresh human input may establish
a deterministic linked successor without mutating the cancelled history. The
human need not manage these execution identities to chat.

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
fulfilling the ask are different outcomes. Host `AppInboxItem` rows
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

[Architecture](architecture.md#one-reconciliation-model) defines the component
boundary; [Task lifecycle](task-resource-engine.md) owns the exact continuation
and closure rules. Older migration choices remain in the
[implementation record](../archive/reviews/conversation-input-unification.md).

## Execution and outstanding results

A pending Condition says a fact is still needed; it does not prohibit useful
independent work. The agent decides what can progress and whether to yield.
Infra retains each outstanding requirement and delivers relevant results.
Ending an attempt, completing its addressed input and closing the Task have
different scopes. [Task lifecycle](task-resource-engine.md#execution-and-outstanding-results)
owns their current-state interpretation; [the agent guide](../2b-manual/task-execution-guide/SKILL.md)
shows how to act on it.

## A turn or a Task?

Here “Task” means delegated work visible to the user; the common underlying
execution mechanism does not turn discussion into a background assignment.

Conversation is the default for discussion and joint work, across as many turns
as useful. May can investigate, edit, verify and answer directly within the
human's authorization. Length, complexity and tool use do not require delegation.
A Turn can repeat work, checks and repairs until it produces an appropriate
answer or reaches an explicit stopping point. "Bounded" limits execution cost;
it does not restrict the Turn to one model response or imply fulfillment when
time runs out. [Turn behavior](conversation-execution.md#frontend-one-bounded-turn)
defines the stopping points.

Delegate a Task for an authorized outcome that can advance independently and needs
background continuation, later work control or restart-safe execution. Its
findings return to the discussion, which stays interactive. May can own an
ordinary Task; another App fits when it owns the responsibility, has the needed
authority, or supplies useful expertise. A matching name alone is not a handoff
requirement. Existing ownership and operation controls still apply.

[Message Lifecycle](message-lifecycle.md) owns the interaction and approval rules.

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
