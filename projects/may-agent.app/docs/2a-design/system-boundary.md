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

## Core, external capabilities and composition

Here **external** means outside the core responsibility boundary. It includes
local tools, executors and interfaces shipped in the Host; it does not mean
another process, remote service, or separate repository. App policy is also
outside core. Folder location alone does not establish ownership.

| Part | Owns | Must leave to another part |
| --- | --- | --- |
| Core: registration and admission | Validate definitions/inputs, preserve exact work and caller identity, publish an accepted generation | Filesystem discovery and App decisions about the requested outcome |
| Core: Events | Durable facts, validated routes, pending delivery and recovery of accepted input | Provider protocols and deciding what an observation means |
| Core: State and reads | Accepted work/results, outstanding waits, execution claims and truthful shared projections | Interface wording, reports and provider-specific caches |
| Core: Work runtime | One current Task attempt, eligibility, capacity, timing, cancellation fences and mechanical recovery | Selecting a strategy because work is quiet or difficult |
| External execution/tools | Model or process execution, provider I/O, operation references, bounded evidence and cleanup under the chosen contract | Creating a second durable work lifecycle or bypassing Task controls |
| External observation/reporting/interfaces | Read sources, normalize changes, present shared facts, submit validated controls | Claiming work was accepted because a message was emitted; deriving live execution from history |
| App and responsible agent | Desired outcomes, useful actions, acceptance, scope, help and closure decisions | Implementing queues, polling bookkeeping, leases or storage recovery |
| Composition/installation | Select and connect concrete capabilities, trusted operational scope and any supervisor route | Owning a competing scheduler or inferring domain success |

The agent sees useful actions and their results. Capability implementations
handle whether those actions use an awaited helper, a Task or an external
provider's operation. Keep the differences needed for correct cancellation,
recovery and ownership inside those implementations. An agent still needs to
know the observable promise and its authority; it should not invent an event
type, timer cadence or registration merely to receive a supported result.

For a supported asynchronous action, acceptance preserves the trusted caller
link and operation reference before reporting that feedback will arrive later.
The operation may finish before the caller yields; preserve that result too.
When useful independent work remains, execution may continue. When the caller
yields, retained results/waits and normal Task scheduling carry the obligation.
Use existing Task/input/Condition records where appropriate; do not introduce
a second operation registry or require every provider resource to become a Task.

Direct calls continue to return synchronous results to their caller. Events
provide asynchronous notification. Source scans and pending-input recovery
repair missed opportunities through the same route; neither an extra model
poll nor a second notification for every direct result is required. An
unsupported shell-created resource does not acquire automatic feedback by
convention alone. The capability must say what it actually supports.

Typed delegation preserves exact caller links. The
[tested implementation candidate](../archive/reviews/execution-feedback-poc-20260913.md)
adds explicit parent continuation at the existing attempt boundary. Scout's
credential capability already supplies its wait. General tool-driven wait
setup remains source-specific; arbitrary shell operations do not gain feedback
automatically. Candidate source is not a deployment claim.

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
The same App or agent can perform more than one role. A Task is the durable
identity when work needs to survive its caller's execution; a direct invocation
need not create one. A supervisor uses existing App inputs and exact
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

For implementers, the recipient's name does not select a lifecycle. An agent
can perform a helper call or execute a Task. A pipeline can retain its native
provider identity while the caller Task owns interpreting its result. Its
reference and feedback must survive a yielded attempt. An attempt-scoped
subprocess instead returns within that execution and is cleaned up with it.
These internal lifetime rules preserve the simple agent-facing promise; they
are not three kinds of work the agent must learn to route or recover.

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
exist. The [consolidated candidate](../archive/reviews/execution-consolidation-poc-20260914.md)
removes silence stopping and heuristic standalone revival across the supported
entry points. Its scoped helper cleanup is locally tested; rollout remains
separate. The [consolidation proposal](../proposals/execution-entrypoint-consolidation.md)
records the changed defaults and consumer guidance. Automatic supervisor fallback and review
during an awaited helper remain deferred. The
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

Host [PR #220](https://github.com/hao1939/may-agent/pull/220) adds a
responsible-App option to the deployment scripts; older installed scripts still
lack that option. The candidate requires a canonical exact Task for the
explicitly supplied responsible App, with `may-agent` retained as a compatibility
default. That App identity remains receipt and wake correlation metadata: it
neither grants deployment authority nor creates an App-name permission rule.
Artifact identity (`sourceCommit` and `artifactSha`) remains separately bound by
the receipt and live verification. The exact procedure belongs in
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

All supported Host executions share rules for limits, cancellation, cleanup and
results. Entry points and provider adapters may differ; they do not select a
second work lifecycle. Core owns durable Task admission and result fences;
execution helpers/adapters run the work, and composition supplies trusted scope.
The [candidate and evidence](../archive/reviews/execution-consolidation-poc-20260914.md)
record consolidation of these entry points; this is not a deployment claim.

| Invocation | Ownership and result |
| --- | --- |
| A user runs an unrelated CLI | Its native caller owns it; May does not automatically discover or recover it. |
| Direct Host execution, one-shot CLI or evaluation | One bounded invocation returns to its caller; no Task, EventBus or database is required merely to run a model. |
| An agent invokes a helper or CLI tool | Caller scope supplies authority, cancellation and remaining allowance; the tool returns its result directly. |
| A CLI or other interface submits durable App work | Normal App admission creates or addresses the exact Task; the CLI does not own background execution. |

Helpers share the caller's remaining allowance and stop with its cancellation.
Shorter provider/operation limits can apply. Activity, retries and corrections
do not extend an invocation's allowance. Code supplies and enforces these limits;
agents judge continuation or steering without managing timeout counters. The
allowance bounds active work, not an idle chat's lifetime or a durable Task's life.
Unconfirmed cleanup is a visible failure, not permission to overlap executions.

When no limit is configured, the candidate uses a 30-minute invocation default,
matching the existing Task workflow default. One-shot CLI keeps its five-minute
default and explicit positive configured limits remain supported. Each active
direct chat turn gets a fresh allowance; idle time consumes none. These are
execution limits, not instructions for an agent to track time or judge progress.

Keep bounded agent calls as ordinary capabilities; `ctx.agents.call` and the
model-facing call can be thin wrappers. Required work that outlives a caller
uses existing Task ownership or a supported provider operation with durable
feedback. A session ID alone is no such promise. See
[agent cooperation](agents.md) and [execution evidence](sessions.md).

A workflow receives explicit invocation input and narrow capabilities, including
the owning Task context when Task-bound. It does not
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

External interfaces submitting work or controls to an installed Host have one
state-changing operation:

```text
publish(event)
```

The event type selects one of four existing Host meanings: App input, reported
fact, exact task/session control, or Host lifecycle control. `get(eventId)`
reads admission and linked outcomes; `subscribe(filter)` observes Events.
Those interfaces do not bypass App admission by launching its agent or model
runner directly, and Apps do not receive this Host interface. A standalone local
execution wrapper uses the execution capability described above; it neither
claims an App Task nor becomes an alternate control route for installed work.

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
