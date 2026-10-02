# Host And App Boundary

**Supports:** [System Model](system-model.md#enable-useful-action-within-authority). Keeps judgment with Apps and agents while infra carries execution and bookkeeping.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#one-authority-for-each-resource).

**Design status:** Accepted.
**Implementation status:** The shared Task boundary is implemented for current
Apps. Named-agent permissions, deployment policy and private maintenance still
contain [domain-policy gaps](../proposals/app-policy-and-host-boundary-cleanup.md).
Task runtimes and test fixtures use resource authority; the legacy JSON
store and completed offline cutover path have been removed. The retired inbox
delivery table is retained only as historical schema evidence. Incident-shaped public
inputs remain a convergence gap rather than an alternate accepted boundary.
The safe-retry default below is a capability requirement; coverage must be
verified at each operation's effect boundary. Existing Task replay does not
certify every installed tool or external provider effect.

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
queues, mechanical retry controllers, process recovery, or presentation transport.

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

Host health observations report execution facts such as current sessions,
process ownership and workflow runs. The Evaluation App selects work for
assessment and owns exclusions; an agent name is not an evaluation policy in
the session manager. Typed capability connections should use their existing
contracts so the compiler can check the boundary.

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
[execution feedback trial](../archive/reviews/execution-feedback-poc-20260913.md)
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
| Task was closed or cancelled | The App/agent distinguishes observations from new requirements. Observation routes retain late evidence. Explicit user-authorized operator control reopens the same Task with its new App input atomically; notifications do not authorize it. |
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

**Implementation limit:** Task ownership, exact caller feedback and mechanical
recovery are implemented. Hosted helpers inherit scope and cleanup; startup
avoids heuristic standalone revival. The [consolidation record](../archive/reviews/execution-consolidation-poc-20260914.md)
retains the evidence. May admission failures have an explicit App-owned Conversation review route as described in the [Task engine](task-resource-engine.md#one-app-work-path). Automatic supervisor fallback and semantic review during
an awaited helper remain deferred. The [ownership review](../archive/reviews/ownership-boundary-review-20260913.md)
records their rationale; this contract does not promise universal recovery or
that a human has been notified merely because a failure was saved.

An installation can declare a narrower independent operational route without
implementing that deferred generic fallback. App-specific oversight thresholds,
coverage and response policy belong in the responsible App; May's current policy
is documented in the [May App](../../../may.app/README.md#conversation-guidance-ownership).
Such a route neither performs semantic self-review nor transfers Task authority.
Admission, notification, review and fulfillment remain distinct, and the original
retry and caller/dependency paths continue independently.

### Recovery uses evidence before repetition

Agent and workflow execution share one behavior model: read current facts,
choose useful authorized work, verify its effect, and retain the remaining
obligations on the same Task. Instructions teach that action path. Describe
the supported operation, verification and responsible authority together;
for example, repair an accessible environment through tools, report through
`finish()`, and let supported observations settle external Conditions. The
Host's state and approval checks enforce their precise mechanical boundaries.

Recovery restores useful progress toward the current assignment. Preventing a
recurrence is later improvement work; neither requires a second Task lifecycle.
The original Task keeps its independent obligations, accepted work and waits.
A safely recovered attempt can coexist with an unresolved implementation defect.
Validation rejected before App input persistence remains the caller's correction;
there is no accepted destination obligation. If the inbox already accepted input
but Task attachment fails, preserve that input and return the blocker through its
caller or the App's declared review route. This is failure feedback, not admission
of the rejected Task work; see the [Task engine](task-resource-engine.md#one-app-work-path).

Use current structured facts first. When they do not explain the failure,
follow the exact attempt, operation, workflow step, command receipt and source
contract references. Start at the failed boundary and its nearest verified
input; expand only as needed. A generic error, missing optional log or absent
classification is a reason to investigate, not permission to drop the outcome.
Evidence that remains inaccessible is an explicit limitation. Diagnosis must
distinguish facts, hypotheses and what the next bounded action can establish.

Code retains identity, original failures, available evidence links and pending
input; it bounds execution, releases capacity and enables normal reconciliation.
Optional logging, notification and Evaluation failure must not replace the
original error or make an unsuccessful execution look complete. These are
mechanical contracts to test through real entry and return paths. No universal
error taxonomy or mandatory model-generated diagnosis is required for admission.
Conversely, optional diagnostic failure does not invalidate independently
verified work; retain both facts and judge the actual outstanding requirement.

The worker chooses a safe correction, a useful diagnostic, a justified wait or
owner help. Before repeating an external effect, inspect its current target or
use that operation's supported idempotency contract; missing acknowledgment
does not prove the effect failed. Continue independent work when possible.
Record the observed result and remaining obligation through normal settlement.
A healthy wait needs no new investigation at every wake. Repeated unsuccessful
execution calls for reconsideration; backoff limits frequency, not total cost
or the quality of the next decision. Diagnosis is agent judgment, not a rule
to change strategies after a fixed error count.

Keep observations and interpretations distinguishable. A tool or workflow's
failure establishes what failed; whether a human must act remains a decision
requiring evidence of that person's needed action or authority. Perform useful
authorized setup or diagnosis when it can resolve that uncertainty. A known
human-only requirement can be reported directly. Preserve inaccessible reads
and unusable output as explicit limits while retaining independently verified
work. Empty data is an observation only when the relevant read succeeded.

Owners judge workflow recommendations against the assignment and current
evidence, just as they judge another agent's contribution. Preserve original
observations and independent obligations while correcting an unsupported
interpretation through the existing result and Condition mechanisms.
Evaluation separately checks the justification for a wait, the use of available
recovery, and delivery of any owed human request. A structurally accepted result
establishes settlement; behavioral evidence establishes whether the decision
helped the assignment. See the
[behavior review method](../2b-manual/workflow-authoring.md#checking-app-behavior)
for source checks, contrasting trials and bounded live review.

Recovery cannot depend entirely on the failed authored workflow returning a
special instruction. Its outer execution boundary and exact caller report
must still expose failure. An available owner can investigate with existing
tools and correct isolated source or revise the method through authorized controls.
A source-only repair may be exercised by ordinary retry of the same workflow and
Task generation; changing the specification is not itself a recovery requirement.
Prepared alternatives, backoff and idempotency guards are mechanical prerequisites,
not proof that an agent diagnosed unfamiliar broken code. Such proof needs the
agent's own investigation and authorized correction, followed by verification of
the original outcome through normal settlement. Explicit workflow selection is
not silently bypassed. A dead Host requires the installation's
process supervisor/operator; an unavailable owner uses only the fallback
actually installed. Automatic supervisor routing remains deferred as stated
above. A safe visible unresolved outcome is not successful restoration.

Automatic recovery requires more than a manually advanced successful retry. A
bounded proof admits original work once, then lets the installed controller,
scheduler, normal failure publication, exact caller return and owner wake carry
the remaining work. Fixture-seeded delegation is a disclosed setup seam, not
recovery scheduling. Harness reconciliation calls or synthetic failure/success
wakes cannot establish automatic restoration. Retain the first missing fact,
return, wake or decision if that chain fails; repair only its owning boundary.
A harness failure, model failure and safe unresolved escalation are different
results, and none is verified restoration.

The [recovery review and trial plan](../proposals/recovery-from-execution-evidence-20260922.md)
separates tested mechanics, observed agent behavior and remaining gaps.

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

Host [PR #220](https://github.com/hao1939/may-agent/pull/220) makes deployment
a standalone operation with a durable exact receipt; older installed scripts
still use their prior targeted interface. A deployment does not require an App,
Task, or Task-database read. An optional `{appId, taskId}` pair is only
best-effort result-notification metadata: it neither grants deployment authority
nor makes destination availability part of deployment success. Artifact identity
(`sourceCommit` and `artifactSha`) remains separately bound by the receipt and
live verification. The exact procedure belongs in
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
The App/agent also decides whether information updates evidence or changes the
assignment. Source and arrival time do not establish that meaning. An exact Task
observation route can retain history after closure; a new requirement needs
explicit authorized continuation, carrying ordinary App input in `task.reopen`.
The Host owns the atomic state change and replay fences, not this judgment.


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
For a claimed Task, core opens one attempt scope around handler selection and
execution, then closes its event subscriptions and lease renewal before settling
the report. Each selected handler uses that scope; adding a backend does not
add another Task execution lifetime.
The [implementation and evidence](../archive/reviews/execution-consolidation-poc-20260914.md)
record consolidation of these entry points; this is not a deployment claim.

Direct execution reports its actual model-visible tool surface. In its execution
manifest, `configuredTools` retains the capability-bundle names declared by the
agent while `effectiveTools` is replaced after preparation with the concrete
prepared tool names, including agent-local tools and any `finish` tool added for
a caller-owned result schema. Existing denials retain their narrower contract:
they name configured capability bundles and are applied before tool construction.

This change makes execution evidence agree with tool visibility; it does not
expand tool policy or provide an OS sandbox. Agent-local factories remain trusted
installation code, and denying individual concrete or local tools is deferred
until that policy has a clearer requirement and contract. Host
[PR #223](https://github.com/hao1939/may-agent/pull/223) at `6ace65ad` carries
the reporting correction; review, merge, deployment and live adoption remain
separate.

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

For a native Codex continuation, fresh canonical Task/attempt/input/settlement
feedback must precede the next model request. The adapter first persists the
same thread's goal as paused and waits for that acknowledgment while the thread
is still unloaded, resumes that exact thread in the paused state, injects and
acknowledges the refreshed developer context, and only then marks the goal active.
The pre-pause turn remains fenced from producing the next accepted request. After
a client or process restart, initialize the new client but preserve this same
paused-goal, thread-resume, context-injection, goal-activation ordering; do not
briefly activate cached context and correct it afterward. Failure of pause,
injection or resume is reported through the existing attempt/caller path
with bounded provider diagnostics. It does not authorize a parallel turn or a
second retry controller. These ordering guarantees describe reviewed Host
source only until its exact runtime revision and configured native adapter are
separately deployed and read back.

When no limit is configured, hosted execution uses a 30-minute invocation default,
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

Mechanical recovery cannot invent a new task, owner, strategy, or completion claim.
Apps with paused task reconciliation continue to store new work but do not
start task attempts.

Continuing the same obligation may mean rerunning an attempt from its input.
Precise session or step resumption is not required by this boundary. Prefer
safe redo when its cost is acceptable; retain additional progress only when
it earns its complexity. See the
[redo-versus-resume rule](../1-principles/core-principles.md#prefer-redo-when-it-is-simpler-and-affordable).

### Retry and recovery ownership

Following the [safe-retry principle](../1-principles/core-principles.md#safe-retry-by-default-explicit-exceptions),
infra owns routine retries of the same operation: identity, timing, backoff,
replay and recovery under the existing execution policy. The owning Task runtime,
executor or capability adapter supplies those mechanics. Agents and App-authored
workflows need no delivery retry loop or model call to resend unchanged work;
callers must not add a competing controller for the same recovery responsibility.

The agent may explicitly choose retry, repair, failover or another recovery
strategy within its authority, without waiting for automatic retries to end.
A workflow may express an established domain recovery procedure. Infra executes
those decisions through the owning capability. Both automatic and agent-requested
retries follow the same effect-safety, scope, cancellation and concurrency rules.

For durable work, retain operation identity before dispatch and reuse it across
delivery retries and recovery. Repeated or concurrent submissions reuse accepted
work and its receipt/result; a lost acknowledgment must not create another
request. Replaying a submission retrieves that existing work. A new execution
after failure follows the owner's recovery policy or an authorized recovery
decision through existing controls. Intentionally new work uses ordinary
admission. Similar input text alone cannot establish which of these is intended.
Infra supplies retained references and results for inspection and control;
the agent need not manufacture delivery identities.

Attempt-scoped retries share the current deadline and cancellation; they do not
extend the allowance. Durable work retains its owner's recovery policy across
attempts. Return known input or authority errors for correction; mechanical
retry does not invent new input or permissions. Retain progress and correlated
failures in existing context, metrics and declared review routes. Recurring
retries must remain observable without making an agent administer each one.

### Safe retry and declared exceptions

The default contract is that replaying the same operation does not duplicate
its committed effects. Code, reads or cheap computation may run again. Use the
smallest sufficient protection at the owning boundary: existing atomic admission
and replay records, an idempotent desired-state operation, or a provider's
supported idempotency key. One admitted Task alone does not make every external
effect inside it safe to repeat. Check the actual effect boundary, including
interruption after the effect but before its acknowledgment is recorded.

If an operation cannot provide safe retry at acceptable cost, disclose the
exception in its existing description/contract before use: what can repeat,
the scope or retention limit of protection, and available recovery actions.
For example, a provider may accept a message but support neither a retry key
nor confirmation after a lost response. Keep exceptions specific to the affected
operation; they need no caller-managed idempotency flag or separate registry.

Infra performs supported status checks and known-safe recovery. If an exception
leaves the effect unknown and replay could duplicate it, return that evidence
to the responsible agent to judge another effect, a different approach or help.
For a safely retryable operation, uncertainty normally calls for recovery of
that same operation and needs no additional semantic decision. Neither case
automatically pauses independent Task work or imposes a retry-count limit.

Operation safety and advertised limits must agree with installed behavior.
This contract is no exactly-once guarantee for arbitrary shell commands or
unsupported provider effects, and does not introduce a new retry service.

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

The operator socket's `task.close` command is a thin adapter over that same
publication boundary. It requires the Task's current generation and resource
version plus the exact accepted attempt ID, then publishes
`app.task.close.requested`; omission or an empty result identity is invalid even
when an earlier receipt could otherwise replay. The shared Task runtime checks
that identity and both fences, the stored converged phase, absence of a current
attempt, and absence of a pending trigger. Rejection leaves every Task fact and
link unchanged. These mechanics do not decide whether the owner should end the
responsibility; independent structural children can continue. The internal
completion callable has the same required result identity;
it is not a generic terminal operation whose optional argument selects intent.
This trusted operator boundary is not a Task-bound creator capability.
`task.cancel` and the internal cancellation callable remain the distinct
intentional-withdrawal control, sharing only the fenced terminal writer. They
must not be substituted for failed completion cleanup or attributed to a human
when their trusted ingress does not establish a human decision.

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
- Does the owning capability handle routine retries safely, disclose exceptions,
  and preserve agent-directed recovery through the same execution boundary?
- Can a fact start work only through an explicit App route?
- Are sessions and workflows bounded attempts rather than hidden controllers?
- Is any new public capability smaller than exposing Host internals?
