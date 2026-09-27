# Workflow Discovery And Execution

**Design status:** Accepted.
**Implementation status:** Bounded workflows use the scoped SDK context,
Task-bound execution, cancellation, retained results and shared result admission.
Agent-selected workflow calls and workflow-selected agent calls preserve the
caller's Task binding. [Enforcement and guidance](#enforcement-infrastructure-and-guidance)
separates mechanical guarantees from author judgment and remaining gaps.

## Purpose

A workflow is reusable bounded orchestration owned by one agent. It moves a
learned sequence, branching, bounded retry, and verification out of model
memory and into tested TypeScript.

```text
typed input -> bounded workflow -> agent/helper steps -> ExecutionResult
```

A workflow is not durable work ownership, a scheduler, an event handler, or a
suspended business process. The enclosing task owns the outcome. A workflow run
owns only one bounded execution attempt.

## Skill and workflow boundary

| Concern        | Skill                          | Workflow                        |
| -------------- | ------------------------------ | ------------------------------- |
| Primary source | `SKILL.md` instructions        | TypeScript module               |
| Controller     | Model judgment                 | Workflow code                   |
| Unit of use    | One model turn                 | One bounded execution run       |
| Sequencing     | Advisory                       | Enforced and testable           |
| Durable state  | None                           | None beyond attempt evidence    |
| Best fit       | Variable judgment-heavy method | Stable repeatable orchestration |

A workflow may ask an agent to apply a skill. The workflow controls sequence;
the skill guides judgment inside one step. Neither owns the enclosing App/task.

### Procedural evidence and agent judgment

For a stable domain procedure, the owning App can fetch bounded source material,
call its agent with observation tools, and persist the returned analysis through
code before reporting success. The existing workflow and Task result contracts
are sufficient; an optional helper is not enforcement when completion can bypass
it. Code records mechanically observed facts such as supplied text spans and a
successful file save. Those facts do not prove comprehension, research quality,
or fulfillment of the caller’s question. The worker and assigning owner retain
those judgments. Keep domain formats and source selection inside the App.

A completed agent call can carry a valid structured draft with a partial outcome.
When the App requires an artifact, preserve that useful draft and its missing
requirements without reporting the assignment fulfilled. A missing or invalid
draft is a different failure. The assigning owner uses the returned gap to judge
whether different evidence, a revised procedure or human input is needed.

A conversational acknowledgement explains the accepted outcome; it is not a
second work specification. Existing Request revisions and Task updates preserve
corrections. App policy owns the wording and when a separate acknowledgement is
useful. No extra interpretation service or confirmation lifecycle is required.

## Location and ownership

Canonical workflows live under the agent that owns the experience:

```text
projects/<id>.app/agents/<agent>/workflows/<name>.ts
agents/<agent>/workflows/<name>.ts
```

For an App Task, agent selection resolves from the Task, nearest explicit
ancestor, then the App default. If that agent is App-local, its App-local
workflow directory is the complete scope; otherwise the standalone agent
directory applies. Runtime never merges catalogs from several agents or
discovers an App-root workflow registry.

Workflow names need only be unique within the resolved agent scope. Duplicate
effective names are invalid and visible in catalog diagnostics rather than
resolved by filesystem order.

## Module contract

Export `name`, `description`, and an asynchronous `execute(ctx)` from an ordinary
TypeScript module. The [authoring manual](../2b-manual/workflow-authoring.md)
and [checked review example](../examples/review-change.ts) show the SDK surface.
The example completes a review contribution; its verdict does not accept the
reviewed change or settle the enclosing Task.

Rules:

- export explicit `name`, `description`, and `execute`;
- receive procedure parameters through typed `ctx.input`; for Task-bound work,
  read the authoritative outcome, acceptance and admitted input through the
  supplied Task context and scoped reads;
- return one terminal contribution, normally with `ctx.done(...)` or
  `ctx.blocked(...)`; preserve failure evidence and allow control failures to throw;
- call agents with `ctx.agents.call` and nested workflows with
  `ctx.workflows.run`;
- keep deterministic mechanics in imported TypeScript helpers;
- use `ctx.read` only for exact bounded current facts;
- publish facts with `ctx.events.emit`, never as a work-dispatch shortcut; and
- keep tests beside the workflow or in the owning App's established test
  layout.

For a standalone bounded invocation, its caller supplies the assignment through
explicit input. For a Task-bound invocation, an objective parameter describes
the assigned operation; it cannot replace or broaden the owning Task's outcome.
Do not reconstruct missing authority from prompt text, global task files,
unscoped event history, the current working directory or an unrestricted query.

## Scoped context

The canonical context contains:

- typed `input`;
- optional bounded `reconciliation` facts when a task owns the attempt;
- exact `read` projections for one App result, task, execution, or metric;
- bounded agent and nested-workflow execution;
- fact publication and domain metric recording;
- the allocated workspace/output paths; and
- logging plus one terminal result vocabulary.

It intentionally contains no raw database, event bus, task store, queue, lease,
scheduler, recovery handle, global path set, session manager, or arbitrary
command surface.

### Workflow or host-private maintenance handler

The absence of raw SQL and host paths is an authoring boundary, not a missing
workflow feature. If a timed job must inspect runtime-owned ledgers, repair
host mechanics, or produce an operational report from global runtime state, it
is a host-private maintenance handler rather than an App workflow.

That handler may use an explicitly supplied host query/path/delivery adapter,
record its mechanical output, and publish a fact such as an owner request. It
cannot become a second App inbox or task controller, and it cannot duplicate a
canonical App schedule/subscription for the same obligation. Any judgment or
durable domain continuation still enters the App through a declared input,
subscription, task trigger, or exact target.

Placement beside an App-local operations agent does not make a host handler a
public App capability. Host-handler modules use a local structural contract and
are checked against the paired Runtime separately from workflow authoring.

### Task reconciliation input

For task-owned execution, `ctx.reconciliation` supplies:

- App/task identity and current generation/resource version;
- selected agent, mode, outcome, and acceptance;
- typed workflow input;
- bounded live and completed child views; and
- a capped snapshot of other live App tasks when App-wide frontier health must
  be reviewed; and
- the ordered unobserved event batch that triggered this pass.

The snapshot excludes the current task, carries a `truncated` bit, and contains
only compact planning facts. It does not replicate the input, acceptance,
result evidence, or attempt history of every live Task. A workflow that needs
one Task's exact desired input or Conditions uses
`ctx.read.tasks.get(taskId)`. A workflow returns a typed output for the task
boundary to validate and admit. It never edits task state itself.

Agent steps called inside that workflow inherit its exact Host-supplied Task
binding (App, Task, generation and attempt). The native Task tool resolves this
binding independently of the session's display/source label. A project name
alone cannot grant an unbound workflow Task access or fenced event authority.
This is capability propagation within one attempt, not a new Task or session
ownership rule; existing read scope and event-publication fences still apply.

## Invocation and ownership

A workflow orchestrates agent operations. Wrapping operations in a workflow
preserves the same Task identity, permissions, remaining execution allowance,
workspace, feedback and cancellation mechanisms as direct agent execution.
There is no workflow-specific work lifecycle or parallel Task reconciler.

The responsible agent chooses a method from its scoped catalog using judgment.
Descriptions support discovery; they do not trigger code by fuzzy matching.
An App may explicitly bind an established procedure when its input promises
that procedure. General assignments do not need a new public input kind for
each workflow. Procedure parameters belong to the workflow invocation; the
owning Task remains authoritative for the desired outcome and acceptance.

The model tool lists and invokes the selected agent's catalog:

```ts
workflow({ action: "list" });
workflow({ action: "run", name: "implement-and-verify", input: {
  objective: "Update the parser", maxIterations: 2,
} });
```

The legacy `task` string remains an alternative input for existing callers;
passing both `input` and `task` is an error. Nested workflows use
`ctx.workflows.run(name, input)`. Neither interface permits selecting another
App's private workflow catalog. Adding a workflow normally changes only its
owning agent's files and guidance.

An App schedule, subscription or observer first enters through a declared App
input or Task trigger. Publishing a fact does not directly launch a workflow.

### One handoff contract

Agent-to-agent, agent-to-workflow, workflow-to-agent and workflow-to-workflow
calls delegate a bounded contribution under the caller's execution scope. The
receiver's implementation does not change context, responsibility or acceptance.
Keep the existing agent tools and SDK calls as scoped entrypoints; a universal
invocation tool, extra queue or handoff lifecycle is unnecessary.

Each call has two distinct inputs:

- **Inherited context:** exact caller identity and, when Task-bound, its
  App/Task/generation/attempt, Task entry, scoped reads, feedback source, working
  paths, effective capabilities, cancellation and remaining execution allowance.
  The Host supplies these from the live execution. An input path or agent name
  cannot establish them or broaden access. Resolve the exact current caller
  session, never the latest session sharing an agent name.
- **Assigned contribution:** the requested outcome, constraints, relevant
  references and expected evidence. The caller supplies ordinary task text or
  private workflow parameters. There is no public schema per scenario and no
  requirement to copy the whole Task or transcript into each call.

`TASK.md` describes the overall Task. The specific call describes the receiver's
role. Receiving the shared brief never assigns the receiver the entire Task.
The receiver chooses useful methods within its assignment; a workflow applies
its authored procedure and calls agents where judgment is needed. The caller
judges the returned contribution, and the Task's owning executor proposes the
overall settlement. A helper finishing does not transfer ownership or settle
the Task. Independent obligations that must outlive the call use the existing
Task/dependency mechanism; lifetime and ownership determine that choice.

Task feedback remains durable input with optional live notification. Participants
inspect relevant updates at useful operation boundaries and before depending on
affected evidence. Notification alone neither consumes input nor permits a
concurrent replacement executor. A receiver can report how an update affects
its contribution; only accepted Task settlement can record its incorporation.
Long operations must cooperate with cancellation or offer bounded observation
opportunities. No guarantee of instantaneous reconsideration or exact stack
restoration follows from this contract.

Execution records retain the specific assignment, caller/session/workflow
correlation and results. Discovery follows those existing records and the Task
entry; it does not overwrite the shared brief for each specialist or introduce
a separate handoff registry. References identify evidence, not permission or
acceptance. Returned execution IDs must identify the actual execution, never
the caller substituted for a child that did not start.

The [Task context proposal](../proposals/task-context-discovery-20260917.md#uniform-handoff-refinement)
records the current implementation slice and remaining gaps.

## Shared contract and changeable procedure

Keep the execution contract common; let each owning App evolve its procedure.
The May development workflow is one application of this contract, not a template
that every workflow must copy. A research assessment, a code review and a Gym
experiment can have different graphs and evidence while using the same execution
mechanisms. A simple procedure may need no specialist call at all.

### What every implementation must preserve

| Shared rule | Responsibility in a workflow |
| --- | --- |
| One authority for the outcome | When Task-bound, retain that Task's identity, current requirement and authority. A workflow result is evidence for its caller, not independent Task completion. Standalone calls remain bounded caller-owned work. |
| Inherited execution scope | Use supplied agent/helper capabilities, scoped reads and workspace. Propagate cancellation to cooperative I/O and respect the remaining allowance; do not recreate scheduling, leases or recovery. |
| Durable input, optional live observation | Use the supplied Task input and shared feedback mechanism. Observing a hint does not acknowledge input, grant authority or justify another executor for the same Task. |
| Honest result admission | Validate structured data before depending on it. Return useful evidence, partial work and failures truthfully; command success alone does not establish outcome acceptance. |
| Recoverable effects and evidence | Preserve enough evidence to inspect what actually happened. Reassess it against current requirements; do not delete it merely because input changed or repeat an external write merely because an attempt failed. |
| Bounded execution versus durable waiting | Use ordinary calls and await for in-attempt dependencies. Return to the existing Task/dependency/Condition mechanism for work that must wait across attempts; do not keep a JavaScript stack as durable state. |

The Host supplies identity, delivery, fencing, execution limits and cleanup.
Workflow authors use those capabilities and implement the domain checks that
the Host cannot infer. Shared does not mean copying that infrastructure into
every workflow. These are stable compatibility rules, not a claim that the SDK
can never change; changing them requires updating the common contract and its
affected consumers together.

### Enforcement, infrastructure and guidance

Enforce stable, mechanically decidable boundaries in their existing owner.
Use guidance for uncertain choices, then learn from ordinary executions before
promoting them. A recommendation does not become a runtime rejection merely
because it appears in an authoring checklist. An explicit App acceptance
requirement still applies through every method the agent chooses.

| Concern | Enforcement or support owner | Current support and limit |
| --- | --- | --- |
| Task/caller identity and accepted state | Host Task admission and execution adapters | Existing scope propagation and settlement fences. Helpers do not gain Task ownership. This is not an OS sandbox for arbitrary TypeScript. |
| Finite execution and cancellation | Shared execution scope | Existing deadlines, cooperative cancellation and child cleanup. No preemption of synchronous JavaScript or rollback of external effects. |
| Terminal status, identity and returned evidence | Shared result adapters and retained run artifacts | Explicit partial work and returned output/facts survive terminal statuses. Retention is bounded; pre-return work and historical replay are not universally captured. |
| Structured data and required domain checks | Workflow/App validation at use and admission | SDK supports structured agent results; authors supply domain schemas and checks. TypeScript input types alone do not validate caller data. Host cannot prove semantic sufficiency. |
| Task fact publication | Existing scoped event capability | Stable local key and attempt fence required; deduplication is within a Task generation. This does not make arbitrary provider writes idempotent. |
| Task context and evidence discovery | Host projections, existing reads and artifacts | Shared entry and exact execution links are implemented. Managed-agent briefs refresh before model requests; workflow invocation context remains a snapshot with explicit reads. Pending input is bounded, not complete history. |
| Feedback and incorporation | Durable Task input, live hints and accepted settlement | Executor acknowledgments are consumed only with accepted settlement. Generic workflow event callbacks observe input but expose no acknowledgment; neither delivery nor reading a brief proves incorporation. |
| Recovery and wait justification | Owning agent, App behavior tests and existing Evaluation | Runtime preserves work and schedules reconsideration; the owner judges authorized repair and human need. Evaluation inspects that decision independently. A schema-valid wait alone establishes neither necessity nor delivery. |

These rows distinguish contracts from current coverage. The
[handoff trials](../proposals/task-context-discovery-20260917.md) and
[context integration](../proposals/task-decision-context-integration-20260926.md)
retain evidence at their recorded revisions.
An unavailable capability must be reported truthfully rather than replaced by
an App-local copy of Task storage, scheduling or recovery.

Workflow code enforces its declared procedure. Optional shared modules make
mechanics easier but cannot enforce a gate that callers can bypass. If a check
is required regardless of method, the App's common acceptance boundary owns it.
If compliance requires understanding meaning, let an agent judge it using
evidence; a field-presence check cannot substitute for that judgment.

Retry counts, specialist roles, review order, progress frequency, exact update
checkpoints and artifact organization remain guidance unless the particular App
has an established requirement. No mandatory step template, general checkpoint
API, automatic retry policy or new tool restriction follows from this refinement.
Proposed infrastructure needs a concrete missing capability and evidence that
existing APIs plus guidance are insufficient. See the manual's
[best practices](../2b-manual/workflow-authoring.md#best-practices-and-learning)
for observations that can justify a later change.

### What the owning App can change

| Procedure choice | Freedom and boundary |
| --- | --- |
| Participants and method | Choose agents, models, skills, deterministic helpers or direct tools that fit the assignment and granted capabilities. Bob and tech-lead are not universal roles. |
| Order and branching | Use the necessary steps, including a path that accepts existing work without implementation. Independent operations may run concurrently when their effects do not conflict and the caller's scope permits it. |
| Review and verification | Choose domain evidence, commands and whether independent review is required. A paper assessment need not run a compiler; an explicit acceptance requirement cannot be silently weakened. |
| Input and output shape | Own private procedure parameters and structured step results. Add public App input only for a distinct caller-facing contract, not for each workflow or task. Keep results bounded and large evidence referenced. |
| Repair and feedback response | Choose bounded local repair, another agent judgment or return to the caller. Check updates at useful operation boundaries; long operations must cooperate with cancellation or expose bounded observation opportunities. No fixed retry count or review graph applies to every workflow. |
| Evidence format and reuse | Define domain artifacts and applicability rules while retaining shared Task entry/discovery links. Preserve readable references, or report incompatibility and inspect current state. |

The agent chooses a method within its assignment. Once it invokes a workflow,
code enforces that workflow's declared procedure and required checks; agent
judgment enters through its explicit decision points. If the procedure no longer
fits, preserve the evidence and return control for another authorized approach.
Flexibility is not permission to skip a gate while reporting that procedure
completed. A changed procedure is an ordinary source change: active runs keep
their pinned definition, and subsequent dispatches use the new version. A new
version must reassess earlier evidence rather than pretending it came from the
new procedure.

### Applying this to another workflow

Describe its promised result, required evidence and reasons to return control.
Start with explicit invocation input and supplied Task context where present;
reuse retained work where it fits, perform only the missing operations, validate
the results and return the evidence. This is a reasoning guide, not a mandatory
base class, stage registry or new configuration language.

Use existing Host coverage for shared execution guarantees. Add workflow tests
for its actual domain decisions and effects: for example, whether valid evidence
can avoid reimplementation, whether failed verification prevents a success claim,
or whether a changed requirement prompts reassessment. Add a boundary regression
when extending a capability or when a live trial demonstrates a missing contract.
Do not duplicate the full Host test suite for every workflow or require a live
model to test deterministic branches.

## Awaited execution and durable waiting

`await` expresses a dependency inside an active attempt: the next step needs
this result. It suspends the calling function, not event admission or unrelated
Tasks. The Host can receive feedback while an agent or workflow awaits a helper.
A JavaScript promise is not durable state or a restartable continuation.

Use an awaited tool, specialist or nested workflow for bounded work that belongs
inside the current attempt. Independent work and external waits retain their
caller correlation through the existing Task/dependency/Condition mechanism.
When no useful independent work remains, return a meaningful wait. Work lifetime
and ownership determine this choice; whether code is called an agent or workflow
does not. Do not add a second queue, subscription protocol or recovery service.

The Host applies one finite deadline to the whole workflow execution, including
code between calls, capped by the caller's remaining allowance. Cancellation
propagates to nested agents and cooperative I/O. Helpers are drained before the
attempt releases execution capacity. Arbitrary synchronous JavaScript cannot be
preempted; long I/O must accept cancellation or provide bounded observation
opportunities. Cancellation does not undo completed external effects.

### Input during execution

New input is saved durably against its owning Task. Shared managed-agent execution
supplies live hints to active agents, including workflow specialists; workflows
may optionally observe the same input with `ctx.events.onEvent`. Delivery does
not acknowledge input, expand authority, or prove that a correction was followed.
The executor's lower-level `TaskAttempt.onEvent` callback can mark an exact
event for consumption with accepted settlement; `ctx.events.onEvent` is only an
observation API. Reading a refreshed brief also leaves input pending.
Accepted Task settlement owns consumption. Missed live hints remain available
for reconciliation; callbacks are a responsiveness aid, not durable state.

The active specialist judges updates within its assignment. The caller judges
whether the overall procedure still fits when control returns. Do not launch a
second executor for the same Task simply because input arrived. A correction
requiring a different procedure can return control at a safe boundary; explicit
cancellation stops supported ongoing operations through the common mechanism.

New input requires reassessment, not deletion of completed work. Retained edits,
reports and execution receipts remain available as evidence. Their validity for
the latest requirement is a new judgment. After restart, the Task retries using
current input and retained evidence; it does not revive a historical workflow's
JavaScript stack or replay a prior attempt's authority. Task-bound historical
runs are inspectable but cannot be resumed through the model tool.

Retries inside a workflow remain bounded and evidence-based. Each iteration must
make progress, establish a durable wait, return a result or fail honestly. Do not
recursively re-enter the same procedure with identical input and evidence.

### Repair within an attempt

One Task attempt can contain several work/check/repair iterations. A failed
check need not return control to the Task controller:

```text
One bounded attempt
  -> do work -> check result and evidence
                    |
                    +-- fixable now -> repair -> check again
                    +-- satisfactory -> return proposed result
                    +-- cannot continue -> return wait or blocker

Host validates the returned result and applies any declared verifier
  -> checked state commit
  -> a later permitted continuation uses a new attempt of the same Task
```

The workflow or agent owns this inner loop. Code runs predictable checks; the
App/LLM judges uncertain failures, useful repairs and whether another iteration
is worth its cost. Continue while the repair is authorized, conditions are
available now, the existing deadline/budget permits it, and there is a credible
next step. Repeated failure without useful progress calls for reconsideration.
Local iterations do not create new Task attempts or reset their limits.

An external dependency ends the run when no useful independent work remains.
Otherwise continue authorized work within the existing bound while retaining
the dependency. An exhausted bound or a scope decision needed for all remaining
work also ends the run with truthful evidence. Cancellation or lost ownership
stops execution; it is not a quality problem the workflow can repair around.
The Task retains the commitment, and normal reconciliation can arrange later
authorized work.

Put ordinary quality checks inside `execute()` before returning. When an App
also declares a final `verify`, reuse the same check helpers where appropriate
so both express the same acceptance criteria. As implemented, that final
verifier runs after `execute()` returns; rejection is recorded as a blocker and
is not automatically fed back into the finished workflow. The Host still checks
current authority, input, result shape and allowed changes before committing.
This convention uses existing workflow control flow and adds no repair service
or automatic verifier-feedback protocol.

<a id="execution-evidence-candidate"></a>

## Execution evidence

Workflow runs retain step timing/status, input summaries, source errors and
bounded result evidence. Optional observations cannot veto a successful result;
required execution-state persistence remains required. The
[workflow tracing record](../proposals/workflow-tracing-and-health-metrics.md)
and [stability trials](../proposals/workflow-stability-poc-20260912.md)
retain the original evidence. Current source supplies these contracts:

- `ctx.signal` is aborted on caller cancellation, the run or parent deadline,
  and settlement. Pass it to cooperative I/O and check it before another
  operation. Child runs inherit the parent signal; their own longer timeout
  cannot extend the parent bound. It cannot preempt arbitrary JavaScript,
  interrupt synchronous work, or undo external effects.
- Returned output and facts get a bounded JSON inspection copy in the existing
  run artifact (`result_payload`), including its kind and
  availability. Inspected source strings/keys and the compact encoded value each
  have a cumulative 64 KiB budget, with a depth limit of 32, sufficient for small
  evidence packets; larger bodies should use existing artifact references.
  Known secret patterns and credential fields are redacted with a visible flag.
  A secret-bearing property name makes the payload unavailable (`sensitive-key`)
  rather than leaking it or collapsing multiple redacted names into one key.
  This is best effort, not permission to return credentials. The encoder avoids
  authored getters, serializer hooks and proxy traps. Unsupported data, including
  nested undefined values and sparse arrays, or oversized/deep structures is
  explicitly unavailable and does not change the execution
  outcome. No field means no captured payload, not proof of no source evidence.
  Retention covers all terminal statuses and preserves output and facts together
  when both are returned. Missing data stays explicitly unavailable.

Existing artifact integrity checks cover that copy. Missing or corrupt artifacts
remain explicit failures of inspection; required run-state persistence remains
required. Only returned data is captured, not a stream of every helper response.
Cancellation before return may therefore leave logs but no packet. This adds no
SQL migration, background collector, new result authority, or retry mechanism.

## Durable waits

Do not keep a workflow open across human replies, approval, long timers,
callbacks, runtime restart, unavailable providers, or other unbounded waits.

For task work:

```text
workflow pass -> return typed waiting result + exact Conditions -> run ends
later fact    -> exact task wake -> new reconciliation pass
```

For a cross-App dependency:

```text
task pass -> return typed child dependency -> run ends
child result -> parent task wake -> new reconciliation pass
```

The next pass receives current durable state through its typed request or
reconciliation context. It never depends on workflow-local variables, an open
session, module memory, or source-session resume.

In the current typed dependency path, returning the dependency ends the parent
pass before the Host submits it. It is not a mid-pass background-start tool.
Several independent dependencies can be returned together; their execution is
subject to ordinary capacity. A later pass can work while those results remain
pending. A `waiting` result with `continue: true` requests that next bounded
pass. Use it when independent work remains; no failed result or polling timer
is needed. See [Task result admission](task-resource-engine.md#one-attempt-interface).

An asynchronous TypeScript function or subprocess is not automatically a
durable operation. Awaited helpers remain within the current attempt and its
budget. A provider-owned asynchronous operation can outlive the attempt when
its stable identity and observation route are retained. This does not require
turning each pipeline or pull request into a separate worker Task.

### A wait reason is not an exclusive event filter

Waiting releases execution capacity; it does not suspend the Task's ownership
of its outcome. Outstanding waits and reasons to wake are independent. A Task
may retain several external waits. Any legitimate new input routed to that Task
can request reevaluation, even if its event type was not anticipated by the
workflow and matches none of those waits. It must not need an `overrideWait`
flag or membership in a special event-type allowlist merely because the Task
is waiting. Routing still establishes relevance and authority: an unrelated
broadcast or invalid input must not wake every Task.

Receiving or claiming that input does not cancel, satisfy, replace, or reset
the outstanding waits and their review deadlines. Only accepted reconciliation
can retire a wait after establishing that it is satisfied, obsolete, or explicitly
cancelled. The Host retains unchanged accepted waits; the next result need not
redeclare them to keep their identities. A Task can therefore
wake to handle an unexpected review finding while retaining both a pipeline
wait and a separate external decision wait; no new subscription registry or
work lifecycle is needed.

Redeclaring an unchanged wait preserves its future review deadline. Once the
checkpoint is due, accepted reevaluation may renew it if the fact is still
pending; renewal does not satisfy the wait.

Replacing an interrupted or expired attempt also preserves the accepted Task
generation and its waits. Execution recovery is not desired-state drift. The
replacement recollects current facts using the same Task; it does not remove
subscriptions merely because the previous execution could not finish.

Any relevant changed fact may wake reconciliation; all acceptance requirements
must hold before completion. A wake means recollect current facts and decide
what is now useful, not blindly continue the next step after the original wait.
If a pass is already running, newer admitted input remains durable for that
same Task until incorporated by an accepted result. Returning a new waiting
result must not discard that input simply because it matches none of the
returned Conditions. Do not create a parallel attempt. Unchanged observations must
not purchase repeated model work. Repeated provider observations and declared
review checkpoints repair missed wake hints by rereading current state, not by
assuming the awaited operation succeeded or replaying obsolete workflow steps.

Review a waiting result for both its named producer and its retained wake
coverage. Test an unexpected routed event with two outstanding waits, retention
of both waits/deadlines, another event arriving during reconciliation before it
returns to waiting, and later independent satisfaction of either original wait.
Also test a missed observation followed by a repeated level/checkpoint and
unchanged facts causing no duplicate work. A declared
blocker is different from a wait and still needs explicit recovery ownership;
this rule does not authorize retrying every unchanged failure.

Implementation status: the Host removes wait-phase input suppression
and preserves unaccepted input when an attempt returns to waiting. Regression
tests cover exact-target scheduling, independent wait/deadline retention,
restart, concurrent input and passive no-op checks. Seven recovery paths retain
accepted waits; the MLVM trial verified unchanged Conditions and deadlines on
three real Tasks across attempt replacement. See Host
[PR75](https://github.com/hao1939/may-agent/pull/75). This does not add event routes
or bypass explicit `dependsOn`
execution prerequisites; blocked dependencies retain their pending input.

`ctx.done` means this bounded workflow completed its own contract. It does not
mean the enclosing App request, task, or project completed. `ctx.blocked` means
this workflow cannot safely produce its contract; it does not create a durable
wait, escalation, agent handoff, or new request automatically.

## Result admission

Terminal agent and workflow contributions use:

```ts
type ExecutionResult<T = unknown> = {
  id: string;
  kind: "agent" | "workflow";
  status: "done" | "blocked" | "error" | "interrupted";
  summary: string;
  output?: T;
  facts?: unknown;
};
```

The model-facing tools retain legacy diagnostic fields such as `sessionId`,
`workflowRunId`, `outputDir` and workflow steps while exposing this common
terminal vocabulary. Callers use the normalized `status`, `summary`, `output`
and `facts` to assess the contribution. Raw agent `lastAssistantText`,
`structuredResult` and `finishResult` payload aliases are replaced by these
shared fields; do not add more copies of large payloads for compatibility.
An explicit partial agent result is `blocked` with its partial output retained,
not `done`. Both optional `output` and `facts` survive every authored terminal
status and nested workflow boundary. A workflow may return an error or
interrupted contribution with useful evidence; actual caller cancellation and
failed persistence still follow the execution fences and failure path. Retain
both fields in the existing bounded run artifact, including explicit unavailable
markers when evidence exceeds retention limits. Prose-only calls may return a
summary when no structured result was requested; this does not manufacture
verified domain data.

Invocation/setup failure can occur before a child exists, and cancelled scopes
or infrastructure failures may throw. Do not fabricate a terminal execution ID
to make those paths look like completed calls. Existing control errors or thrown
failures describe the failed operation; available diagnostic references remain
discoverable. The shared contract does not require every tool response or
exception to be an `ExecutionResult`. The system-facing workflow adapter keeps
its failure contract: when a terminal result is available, its typed exception
carries the normalized `execution` and includes the run reference in its message.
The Task adapter retains that reference while preserving `state: error` and the
existing recovery path. Evidence preservation must not turn failure into an
accepted result or require a new Task lifecycle.

When later workflow code requires structured agent output, the workflow owns a
TypeBox or equivalent schema and validates `result.output` before use. A prose
response or invalid payload cannot become trusted domain data. At most one
bounded correction may occur inside the agent execution contract; validation
never starts an unbounded model retry loop.

The App/task boundary separately validates the workflow's terminal output,
generation, allowed actions, Conditions, and evidence. An execution status of
`done` is still only a claim until admitted.

For task-owned work:

- continue locally while bounded in-scope repair remains;
- return exact Conditions only after establishing the corresponding external
  dependency;
- use `needs-agent` only for exceptional same-App judgment the learned workflow
  cannot safely resolve;
- create cross-App/human escalation only through an explicit App/task
  dependency; and
- use `blocked` for inability to produce a safe structured execution result,
  not as an ordinary domain branch.

## Evidence retention and autonomous recovery

The shared recovery rule is **read the current requirement, inspect retained
evidence, validate its applicability, and continue unfinished work on the same
Task**. It applies to a resumed executor and to a replacement agent. Neither
agent identity nor remembered conversation is the work's authority.

The [shared recovery rule](system-boundary.md#recovery-uses-evidence-before-repetition)
uses structured facts first, then linked step evidence when diagnosis is needed.
Improving the failed implementation is separate from restoring this assignment.

Runtime retains Task identity, current specification, accepted results and
previous-attempt evidence. `previousAttempt.unacceptedResult` is a proposed
result whose settlement failed; it is inspectable evidence, not an accepted
effect. A retry must distinguish work that ran from results that were admitted.
Do not replay external writes simply because an attempt failed: inspect the
actual target state or use its supported idempotency identity first.

Workflow code retains the data needed to assess a step: actual execution ID,
returned output/facts and command receipts, including failure details. Store
long bodies in artifacts and carry checksummed references through bounded Task
results. Validate the aggregate result with SDK admission; independent string
limits on each field do not establish aggregate size correctness. Keep current
relevant receipts reachable regardless of how many later attempts fail. A
summary or preview is not the full evidence, and saving a receipt is not proof
that its claims satisfy the requirement.

`shared/tools/task-evidence.ts` supplies reusable local immutable JSON/Markdown
storage and checked reads for workflows. It accepts an output directory and
arbitrary JSON records; it depends on no agent name, team stage, repository or
Task scheduler. It has no latest pointer, executable phase or queue. The Task's
Runtime-retained reference selects evidence. Shared agent guidance tells any
executor to inspect those references before repeating work. This is available
support, not automatic adoption by every App or a universal guarantee of
unassisted recovery.

Applicability remains App policy: a coding check may match a clean commit and
requirement; research may match a source version and question; an external
operation requires a current target read or operation receipt. Use code for
identities and observed facts, and agents for relevance and sufficiency. A
shared helper cannot infer these validity rules. Missing/corrupt evidence calls
for fresh inspection; changed requirements call for reassessment; missing
credentials, authority or an owner decision remain ordinary caller feedback.
Work before an interrupted executor produced a Runtime-referenced result may
require source inspection or repeated safe checks. This does not create exact
step replay or a separate durable workflow engine.

## Facts and side effects

Facts and judgments are separate. A new event may change the judgment of what
to do next; it does not erase commits, diagnostics, completed runs, artifacts,
or the scope under which they were produced. Retained `result` is prior App
output to reevaluate, not permission to repeat its proposed effects or a current
readiness certificate. Recollect authoritative state and check an action's
current prerequisites before acting. In particular, a comment alone does not
invalidate a live run; a repair that moves the head leaves that run as historical
evidence and may require new exact-head validation.

The Host retains no-action same-attempt output when newer input is pending
and keeps the Task eligible for another pass. A result proposing Task actions
still commits atomically with those actions or remains fenced; it must not
report unapplied work as admitted. The Host does not infer semantic relevance,
automatically accept unseen events, or waive generation/cancellation fences.
This uses the existing result, event, attempt, and Condition records.

`ctx.events.emit` publishes observed or produced facts. In a resource-backed
task attempt, every event requires a stable `localKey`. The Host verifies the
attempt fence, deduplicates that key within the task generation, persists the
event and exact target wake, and only then exposes it to subscribers. This
commit is independent of the workflow's later final result. The workflow cannot
assume publication means another owner accepted work. Any actionable consumer
must be declared by the destination App as an input subscription, exact task
target, or matching Condition.

The compatibility `ctx.emit` and `ctx.dispatchEvent` forms are rejected for a
resource-backed task because they cannot carry the fenced local key. Use
`ctx.events.emit`. To request a result from another App, return a typed
dependency instead of emitting `app.input.requested`; the App request row is
the single durable correlation authority.

Where a domain mutation and its resulting fact must be atomic, use an explicit
domain adapter/outbox capability owned by the Host. Do not emulate
atomicity by writing runtime SQL or emitting before the mutation is durable.

`ctx.metrics.record` records one domain measurement. Metrics and emitted facts
must not become workflow-local retry schedulers.

## Workspace convention

The host allocates the workflow workspace according to the App/task policy and
provides working/output roots and, when available, the Task entry:

```ts
ctx.workspace?.root;
ctx.workspace?.output;
ctx.workspace?.taskFile;
```

Task-owned writes and commands use the supplied working/output roots or explicit
scratch allocation. Supplied context and source/evidence references may resolve
outside the checkout within existing access scope; a reference grants no mutation
authority. Workflows do not derive repository, App, agent, or persistent-state
roots from process cwd.

For isolated Git work, the host owns worktree creation, base revision, branch
lineage, cleanup, and recovery. A workflow returns verified evidence and clean
result; it does not create a parallel workspace registry or select random
branches. Retries for one task generation preserve the recorded lineage.
Waiting releases the attempt slot but retains that generation's clean checkout,
including ignored dependencies and local evidence. Recreating it on every wake
would turn observation into repeated setup and model-driven repair. Normal
cleanup runs after accepted completion; dirty source still requires explicit
recovery. This uses the existing workspace identity, not another cache or lease.

Cleanup recognizes both commit ancestry and squash/rebase integration. For a
non-ancestor branch, a conflict-free Git merge-tree must equal the exact pinned
target tree; the probe changes no refs or working files. Unknown integration,
conflicts, and dirty work remain recoverable, not silently discarded. A human
squash merge must not cause unchanged completion attempts indefinitely.
If workspace finalization cannot establish a clean waiting/completed result,
the same Task enters recoverable attention with its prior evidence and workspace
diagnosis. It does not replay the unchanged handler as a transient process error.
Normal parent judgment or explicit fenced retry can revisit the retained work.

Shared ledgers, observation state, and maintenance migrations do not belong in
task worktrees. Genuine offline repair belongs in an explicit maintenance CLI.

### Task entry and discovery

**Design direction:** Agreed for the next workspace iteration. The
[implementation proposal and local trials](../proposals/task-context-discovery-20260917.md)
track generation of `TASK.md`, its discovery references and remaining limits.

Every Task should have a Host-supplied entry path to `TASK.md`, shared by its
agents and workflows. The brief summarizes the outcome, acceptance, pending
inputs, effective working paths, prior results and current execution problems.
Agent-owned notes and outputs remain separate from this generated brief. The
entry path does not require moving existing source workspaces or artifacts.

The discovery rule is: **information omitted from the brief remains reachable
through a reference or a concrete listing/search route.** The brief is an entry
point to the available Task context, not a closed selection of what the
generator considers relevant. Each information category links to its existing
source or index so the agent can discover items that were not individually
mentioned. This includes:

- full original inputs, attachments, corrections and Task history;
- App/project instructions, design documentation and source roots;
- available team members, tools, skills and workflows through their catalogs;
- related Tasks, dependencies, results, reports and produced artifacts; and
- attempt/workflow/session evidence, command output and failure diagnostics.

A reference identifies what is available, where it comes from, and how to read
or enumerate it: an accessible path, an existing index, or an exact supported
tool/query with the relevant Task or execution identity. A vague instruction
to "look in the logs" is insufficient. Large collections use existing
paginated reads, directory listing or search; a shortened preview retains a
route to the full content and remaining entries. Unavailable sources and
access limitations are explicit. References must resolve within the receiving
agent's environment and existing access scope.

`TASK.md` records its Task/attempt identity, source version and generation time,
and provides the existing read route for current Task state. The Host refreshes
the projection at defined execution/read boundaries. The underlying Task and
source records remain authoritative; editing the brief, notes or an artifact
does not accept an input or settle work. Existing artifact indexes and result
references expose new outputs without a second workspace registry or copied
event ledger. Historical evidence and unaccepted proposals remain distinguishable
from accepted results.

The first implementation should generate the small brief and working discovery
routes from existing context and read capabilities. Agents choose what to
inspect, including for self-diagnosis; the Host need not predict every useful
document, preload full histories or introduce another search service.

## Discovery, reload, and provenance

Discovery enumerates the resolved agent's workflow entries, imports and
validates exports, rejects duplicate effective names, and produces an immutable
catalog snapshot for each dispatch generation. Missing roots are empty;
invalid modules are visible but not invocable.

A run records at least:

- workflow name and owning agent/App scope;
- entry path and source revision/hash;
- input/reconciliation identity without leaking secrets;
- parent execution and causal trigger;
- child execution IDs;
- terminal status, summary, output/evidence references; and
- allocated workspace lineage where applicable.

Active runs keep their prepared source generation. A reload affects subsequent
dispatch only. A complete executable fingerprint should cover the entrypoint,
repository-local imported source graph, and dependency lock revision; an entry
hash alone is useful evidence but not a full reproducibility claim.

Workflow-run storage and SQL projections are host-private. App code consumes
only bounded `ExecutionView`/result references.

Ordinary error results link to a run only when its terminal error record and
artifact are readable. Setup belongs inside the execution failure boundary:
a failed startup event must finalize an inserted run with the original reason.
If storage cannot create or finalize that evidence, report the error without
claiming a usable run link. Existing restart recovery handles incomplete rows;
optional diagnostics and failure notifications cannot replace the original error.

Expected durable waits always start a new workflow run later. Recovery of an
interrupted run is mechanical attempt recovery only; it never becomes a hidden
business-process continuation mechanism.

## Promotion heuristic

Use demonstrated procedural stability and explicit acceptance to choose code.
The [authoring guide](../2b-manual/workflow-authoring.md#when-to-promote-a-learned-practice)
explains when to promote a practice to a workflow or retain agent judgment.

## Integrity checklist

- Every workflow belongs to one agent and one immutable dispatch snapshot.
- Every invocation has typed input and one bounded terminal result.
- The enclosing App request/task, never the workflow run, owns durable work.
- Schedules, observers, facts, and metrics cannot launch workflows directly.
- Durable waits end the run and resume through persisted App/task state.
- Agent outputs and workflow outputs are validated before domain admission.
- Workflows use scoped reads and workspace paths only.
- No workflow imports raw SQL, task storage, global paths, scheduler, queue,
  lease, delivery, or recovery mechanics.
- Runtime-ledger observation or repair that needs those capabilities is
  explicitly classified as a host-private maintenance handler, never disguised
  as a workflow.
- Result `done` never implies enclosing task/project completion without App
  admission and evidence.

## Cross-App outcome review and report consumption

Cross-App reviews use ordinary Tasks, scoped reads and durable report outputs.
Agents judge the evidence; missing coverage is inconclusive and publication or
acknowledgment does not establish resolution. See the
[authoring guide](../2b-manual/workflow-authoring.md#cross-app-outcome-reviews)
for identity checks, report handling and independent consumption.
