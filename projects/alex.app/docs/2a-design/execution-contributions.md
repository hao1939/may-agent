# Agent and workflow contributions

**Supports:** [Task attempts and results](task-attempts.md). Makes bounded help reusable without transferring the caller's assignment or inventing another work lifecycle.

**Choice basis:** [Match the mechanism to the responsibility](../1-principles/core-principles.md#match-the-mechanism-to-the-responsibility).

**Design status:** Accepted.
**Implementation status:** Scoped helper calls, common terminal results, evidence retention and Task-backed waiting are implemented. Cancellation requires cooperative I/O; arbitrary JavaScript stacks are not durable or preemptible. The sections below state specific coverage limits.

An agent or workflow can ask another agent or workflow for a bounded contribution.
The caller retains its assignment and judges the contribution. Task-level
settlement stays with [the attempt contract](task-attempts.md); workflow module
shape and discovery stay with [Workflows](workflows.md). Use the
[workflow manual](../2b-manual/workflow-authoring.md) for authoring examples.

## Common contract for code and agents

**Same assignment, authority, acceptance requirements and effect rules; the
method may differ.** Code handles understood work efficiently. An agent can
handle cases the code cannot resolve, without losing the assignment or gaining
different permissions. This lets Apps improve their methods while callers keep
one meaning for accepted work.

This file owns the shared behavior. The App/caller owns the particular outcome,
meaning and required evidence. Keep its structured schema and pure admission
checks in one App-owned module used by both producers' acceptance paths; expose
that schema to the agent through the existing tool/call. Explain meaning and
recovery in the linked guide. A prompt, later reader or executor adapter must not
invent a second acceptance policy. This requires no universal domain schema,
contract registry or new invocation API.

The shared rule applies to alternative implementations of the same contribution.
A helper's review judgment and its caller's Task settlement can have different
schemas and responsibilities. The Host keeps the execution rules common; the
App owns each domain contract. Do not force every operation into one payload.

| Concern | Rule for either implementation |
| --- | --- |
| Assignment and input | Use the requested outcome, original input/evidence and current scope. Unfamiliar content remains available for interpretation; a rejected admission remains the caller's responsibility. |
| Acceptance | Apply the same App-owned report checks to code and agents. Required fields must be available in every report; fields that can be unavailable are optional. A valid report enables code consumption, not a claim of fulfillment. |
| Partial work and inability | Keep execution status, returned contribution and remaining work independent. Preserve useful output from every status for caller assessment. Missing output cannot imply fulfillment; inability must be reportable without fabricating it. |
| Actions and replay | Use the same authority, cancellation, settlement and effect protections. Preserve accepted work and operation identities when changing method. Repeated consideration is allowed; it does not authorize repeating a committed effect. |
| Correction and recovery | Return the original reference, specific failure, useful results and known effect status. Correct while the producer can still act; otherwise use the existing caller/Task recovery path. Infra owns supported mechanical retry; the App/agent owns another method or escalation within existing bounds. |

For example, a workflow can produce a review directly or ask an agent to read
the supplied evidence. Both submit the same kind of judgment to the same App
checks. A malformed judgment receives correction feedback. A useful draft with
an unresolved question remains available without closing that question or the
whole Task. Publishing it and later retrying must preserve the publication.

Older content follows [contract evolution](#same-contract-as-content-evolves):
interpret when needed, preserving history. Keep recovery effort observable
through [existing feedback and audit](system-boundary.md#retry-and-recovery-ownership);
successful recovery remains success. Agent judgment is trusted within its scope,
not guaranteed correct.

**Coverage:** the shared execution scope, result vocabulary and Task admission
already carry valid incomplete reports. The October 17 Host candidate removes
hidden requirements for optional finish diagnostics; it is not deployed. App
reader drift and implicit validator conversion still need alignment. The
[implementation proposal](../proposals/host-contract-improvements-20261016.md#return-unresolved-work-to-agent-judgment)
owns that work and the comparison trials; these rules do not establish rollout.

### A valid report can describe incomplete work

The schema describes what the contributor can report, not everything that must
eventually be accomplished. Require only fields needed to understand and handle
every report. Make findings, test results and other information optional when
they can legitimately be unavailable. The caller judges whether the reported
work meets its acceptance criteria and what should happen next.

For example, a report can contain a summary and changed files while omitting
optional test results: "Patch written; test environment unavailable." Code and
agents can both return that same report. Accepting it preserves the patch without
claiming tests passed. Missing information stays missing; do not fabricate an
empty successful result or invoke the model again just to fill an optional field.

An App may attach an advisory observation such as "requested verification was
not supplied" using its existing summary or facts. The Host cannot infer those
expectations from an optional field. There is no warning for every omission,
mandatory warning schema, or retry caused solely by a missing optional field.
A supplied malformed value still needs correction or interpretation before code
uses it as validated data. Retain the original evidence for that judgment.

Keep one schema for ordinary reports, including incomplete reports; do not add
status-specific required-field exceptions in the Host. When a caller requests
`finish.result`, the report itself remains required and its declared required
fields still apply. The Host does not silently weaken the caller's schema.
Task reports separately carry the owner's `waiting`, `converged` or `incomplete`
decision. This needs no new partial-result state or Task lifecycle.

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
Apply the [common contract](#common-contract-for-code-and-agents).
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

The [Task context proposal](../archive/reviews/task-context-discovery-20260917.md#uniform-handoff-refinement)
records the current implementation slice and remaining gaps.

### When input or setup fails

Before destination admission, the existing caller retains responsibility. Return
the original input/reference and the specific rejection through that call so its
agent or workflow can correct the request or choose a supported route. Do not
pretend the destination accepted work or create another Task automatically.
After admission, failure belongs to the same Task. If its procedure cannot start,
use the existing caller or declared operational route, preserving the original
work and cause. A saved diagnostic alone does not establish delivered feedback;
an unavailable recipient must remain visible as unresolved delivery.

An App that relies on agent interpretation must test this route before its narrow
reader or workflow can run, as well as the ordinary in-workflow agent call.
Malformed content is evidence, not authority to bypass input or action checks.
Where content must remain open to interpretation, use an existing stable
message/goal envelope with original content as evidence. Its routing and authority
fields still validate before dispatch. A catch inside the destination workflow
cannot recover a request that never reached it.


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

### Finish before the execution deadline

Give a worker an opportunity to return useful progress before forcibly ending
its execution. This supports [accepted progress and continuation](task-attempts.md#accept-work-and-continue-what-remains)
and avoids reconstructing work merely because a helper consumed the entire
allowance. Following [agents judge; infra executes](../1-principles/core-principles.md#code-executes-and-brings-back-evidence-agents-judge),
infra controls when execution ends; the agent judges what was accomplished and
what remains. A timeout does not establish either completion or partial success.

For Host-managed model invocations that require `finish()`, reserve a finalization
window inside the existing hard deadline. At the work deadline, signal cooperative
tools and helpers to stop, retain their returned evidence, and give the model one
wrap-up instruction. Only `finish()` remains executable; rejected proposals can
still be corrected through that same tool. A helper is joined before its caller
receives its result, and outstanding helpers are drained before execution capacity
is released. Explicit Stop and the hard deadline still cancel the invocation.
The distinction between a work stop and ordinary cancellation survives nested
helper calls, so joining a deeper helper still returns its execution reference
and available evidence instead of replacing them with a generic cancellation error.

For example, a review exceeds its work allowance after a patch is prepared.
The parent receives the interrupted review's execution reference and available
evidence. It can return `waiting` with `continue: true`, recording the patch and
the unfinished review. Ordinary result admission accepts that scoped contribution,
retains its input and artifacts under existing rules, and supplies the result to
the next attempt. Infra does not fabricate acceptance or satisfy a Condition.

The source implementation reserves up to **60 seconds**, capped at **one fifth**
of the invocation's admitted allowance. Helpers inherit the caller's work
deadline; any finishing window of their own fits inside that bound. The time
signal is independent of tool counts and uses the existing completion guidance.
It does not extend deadlines, introduce an agent-facing timer API, or change Task
states or result schemas. The existing operation-count guidance still applies.

**Availability:** Implemented in Host PR #308 for managed and direct prepared model
invocations requiring `finish()`. The [implementation and deployment record](../archive/reviews/graceful-attempt-finish-20261004.md)
records exact revisions, scripted-provider tests through the real model/tool loop
and Task admission, and the verified local rollout. Deployment health does not
establish live model judgment or token savings.
Standalone native Codex execution, arbitrary workflow JavaScript and persistent chat
turns have no finalization window of their own. Structured agents' scoped tools
still receive their caller's work-stop signal.
A stalled model request or non-cooperative I/O may still consume the finalization
window; the hard timeout remains a failure if no valid result is returned. Cancelling
an operation does not prove its external effects were rolled back.

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
The worker can incorporate a live request by naming its exact `inputKeys` in the
ordinary result; it needs no separate acknowledgment tool or callback. The Host
validates that scope against unanswered admissions on the same Task and consumes
only the accepted contribution's notifications. Unselected requests remain pending.

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

A saved contribution is context for the receiving assignment, not an execution
decision that must be copied into the receiver's result. When a later attempt
has a rejected proposal and its error, the responsible agent must be able to
reconsider it. A workflow must not bypass that judgment by treating the restored
input as a fresh command to repeat the same rejected result. Preserve accepted
effects and exact input identity while using the existing retry path.

<a id="execution-evidence-candidate"></a>


## Execution evidence

Workflow runs retain step timing/status, input summaries, source errors and
bounded result evidence. Optional observations cannot veto a successful result;
required execution-state persistence remains required. The
[workflow tracing record](../proposals/workflow-tracing-and-health-metrics.md)
and [stability trials](../archive/reviews/workflow-stability-poc-20260912.md)
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
is needed. See [Task result admission](task-attempts.md#one-attempt-interface).

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
the outstanding waits or independently chosen Task review deadlines. Only accepted reconciliation
can retire a wait after establishing that it is satisfied, obsolete, or explicitly
cancelled. The Host retains unchanged accepted waits; the next result need not
redeclare them to keep their identities. A Task can therefore
wake to handle an unexpected review finding while retaining both a pipeline
wait and a separate external decision wait; no new subscription registry or
work lifecycle is needed.

Redeclaring an unchanged wait preserves its observation. Infra recovers missed
facts in code. An agent chooses an explicit Task `reviewAt` for deliberate
reconsideration; simply remaining pending does not renew that deadline.

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
not purchase repeated model work. Repeated provider observations and mechanical
recovery checks repair missed wake hints by rereading current state. An unchanged pending result invokes no
agent; a recovered result follows the normal exact return route.

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


## Same contract as content evolves

For content and result-schema changes, the default is no history migration and
no required reader for every old version. Code handles the formats it understands.
Otherwise the owning workflow or agent uses the
[ordinary recovery flow](system-boundary.md#retry-and-recovery-ownership) to
interpret the retained input and continue under the current contribution contract.
Preserve the original record and reference it from the new contribution.

For example, an older review can remain stored in its original format. If the
current reader cannot consume it, an agent reads it as evidence and supplies
the judgment the caller now needs. The current checks apply to newly proposed
structured output and actions from either code or agent. Missing evidence remains
missing; interpretation must not invent a field's meaning, rewrite a recorded
acceptance or replay an already published result. If the current requirement
cannot be met, return useful partial work or the blocker through the same contract.

This relies on readable original evidence and a working route to the responsible
agent. It does not replace a storage conversion needed to read records, repair
lost identity/effect guarantees, or install a capability the running Host lacks.
Such changes need their own concrete conversion or rollout plan. Routine semantic
format evolution needs neither a version registry nor a bulk rewrite. Repeated
interpretation cost can later justify a code path through the existing audit.

**Coverage:** ordinary agent calls and retained evidence support this approach;
individual App readers still need to route unresolved content through it. This
is a design rule, not a claim that every historical format is currently handled.
Input-schema evolution has an additional boundary: the current Host can reject
reload for incompatible pending inbox admission commands and rechecks saved
inbox input before Task attachment. Keep that protection until a trial preserves
those exact pending identities and reaches a valid interpretation route. Keeping
the message/goal envelope stable lets its content evolve without that change;
an incompatible envelope needs a specific rollout decision, not a blind bypass.

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

When a caller requires structured output, the App owns a TypeBox or equivalent
schema and pure checks for admission. Use those same checks for newly proposed
results from code and agents, including the reader that consumes `result.output`.
The model-facing schema comes from that definition; guidance explains its meaning.
Do not silently fill missing required data or discard invalid fields to make a
new proposal pass. This does not revalidate accepted historical records as new
proposals. Schema success enables that code path; the caller still judges the contribution's
meaning. Unfamiliar or invalid content remains evidence that an agent can
interpret, but cannot directly drive effects that require validated data.

**Normalization is part of acceptance.** New structured contributions are checked
without implicit type conversion by default. If an App needs normalization, make
that meaning-preserving rule explicit and shared by both methods, retaining the
original evidence. A model tool adapter must not quietly turn a number into a
string when the code path would reject it. Test the actual model tool validator,
the App reader and the supported relay representation; schema equality alone
does not establish equivalent acceptance. Ordinary tool arguments can keep their
own declared normalization rules.

Return correctable failures while the contributing agent can still act, sharing
the App's new-output checks with its consumer. A rejected completion can be
corrected within the same invocation and its existing allowance. If the method
does not fit, the responsible agent may use another supported method or report
the blocker. It need not keep formatting the same proposal forever. Final commit
still checks current authority and state; a concurrent change can reject a
previously valid proposal and must leave evidence for the next permitted attempt.

Completion of an invocation and fulfillment of the assignment are independent.
Use the [ordinary report schema](#a-valid-report-can-describe-incomplete-work)
to express missing information. An App defines the evidence needed to judge
fulfillment; requiring it in every report would prevent honest inability reports.
Supplied observations can support judgment without another tool call. Host must
not impose an extra mandatory evidence field only on agents or require optional
blocker details already explained in the summary. Host records execution and
enforces the declared report contract.

Consumers must preserve supplied output and facts even when execution is blocked,
failed or interrupted. Assess the contribution under normal admission rather
than discard it solely because its status is not `done`. Retention does not
commit its actions: cancellation, lost authority, failed persistence and settlement
fences still apply. Previously accepted effects remain accepted independently.

**Implementation coverage:** schema-valid incomplete reports already return
through the ordinary agent and workflow paths. Direct Task agents can return
`state: waiting` with useful work and `continue: true` independently of their
outer finish status. The October 17 Host candidate removes the hidden
`verification_facts` and `blockers` requirements and teaches optional information
as optional; declared deliverable-path checks remain. Actual execution failure
still preserves evidence through run references rather than automatically
settling a Task proposal. No status-specific schema bypass is introduced.

**Remaining gaps:** App readers can differ from their advertised schema in both
directions. Public workflow agent
calls expose a schema but not the direct Task agent's pure completion callback.
The pinned model tool validator can coerce values before App checks run, so even
one schema currently does not assure the same admission behavior. The
[implementation proposal](../proposals/host-contract-improvements-20261016.md#return-unresolved-work-to-agent-judgment)
specifies the remaining changes; callers must use installed contracts until
activation. Optional report fields are already supported by the schema surface.

For a direct Task agent, Host supplies the App's pure action/Condition admission
checks to `finish` alongside the shared result schema. A correctable shape or
policy error returns feedback before finish becomes terminal. The agent decides
how to correct its result; validators neither perform effects nor judge whether
its assignment is valuable or complete. Supplying `validateOutput` activates
structured finish handling even when no additional output schema is supplied. Final Task settlement repeats validation
and checks current authority and concurrency. Passing finish preflight is not a
promise of later settlement. Workflow output transformation and independent
verification retain their own boundaries.

**Availability:** App validation during direct-agent finish is implemented in
[Host `7b416af40`](https://github.com/hao1939/may-agent/commit/7b416af40); older Hosts validate it only after the invocation ends.
Source validation and App integration are recorded in the [repeat-pattern follow-up](../../../may.app/design/token-efficiency-proposal-20261002.md#october-3-source-follow-up).
Conversation uses the same callback for read-only Topic, Request and input checks
in the [Conversation feedback candidate](conversation-execution.md#correct-a-proposed-result-before-ending-the-turn).
That section owns its coverage and deployment status; #295 alone does not supply
those checks to the Conversation resolver.

The App/task boundary separately validates the workflow's terminal output,
generation, allowed actions, Conditions, and evidence. An execution status of
`done` is still only a claim until admitted.

For task-owned work:

- continue locally while bounded in-scope repair remains;
- return exact Conditions only after establishing the corresponding external
  dependency;
- call `ctx.agents.call` for exceptional same-App judgment the learned workflow
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
