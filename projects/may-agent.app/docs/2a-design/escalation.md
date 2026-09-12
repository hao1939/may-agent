# Escalation

**Design status:** Accepted.
**Implementation status:** Exact task/human Conditions and typed Runtime-managed
cross-App Task dependencies are implemented. Request dispositions are removed.
New caller feedback uses the shared Task path merged in #169. Historical
event-pair and source-session records should be evidence only, but the reviewed
Host `649d801c` still registers a legacy resolution-to-resume subscriber and
emits legacy recovery escalations. Its retirement requires the consumer and
unfinished-obligation checks in the [boundary cleanup](../proposals/app-policy-and-host-boundary-cleanup.md).

## Purpose

Return problems to the exact caller, who can decide what to do next.
"Escalation" describes asking someone with different authority to decide or
act; it is not a resource or a required response to failure. Different authority
can exist within one App. Ordinary cross-App delegation is not automatically
an escalation. The [caller-feedback contract](../proposals/caller-feedback-and-waiting.md)
owns reporting during waits and unsuccessful attempts.

```text
source assignment
  -> do safe in-scope work; report facts and any needed decision to the caller
  -> caller decides whether to continue, revise, wait or seek other authority
  -> any required delegation uses an ordinary exact Task dependency
  -> the source keeps its identity and applies the returned result
```

Escalation is not a synonym for failure, waiting, retry, attention, or workflow
blocking. It does not create a special work authority. The destination task
owns the requested outcome; the source task remains the authority for the
original outcome. Runtime request records correlate the dependency and result.

## Boundary test

| Situation                                                   | Correct representation                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| Another useful repair remains inside the same App's scope   | Continue the bounded workflow or reconcile the same Task      |
| Reusable workflow needs App-agent judgment                  | Return `needs-agent` for the same task                        |
| Bounded execution cannot continue safely                    | Return `blocked` evidence; owning boundary decides next state |
| Known external fact will change later                       | Persist an exact task Condition                               |
| Another App must decide or act                              | Create a typed cross-App task dependency                      |
| Human approval or private judgment is required              | Exact human Condition or May conversational request           |
| Agent attempt was incomplete                                | Honest execution result; not escalation by itself             |

The current App, not the Host, decides that a blocker crosses an
ownership boundary.

## App-to-App escalation

When a task discovers that another App owns the next action, its reconciliation
result requests one typed Runtime-managed dependency. The checked
[`dependencyResult`](../examples/app.ts) names `release-governance`, a stable
dependency ID, and the destination's illustrative `approval-request` input.
Use the actual installed App's input schema. A workflow returns that result as:

```ts
return ctx.done(dependencyResult.summary, dependencyResult);
```

The Task result itself must contain `summary` and `evidence`; the outer workflow
summary does not populate its output. `bun run check:may-design` validates the
linked result through production Task result admission.

The Runtime durably admits the destination request, then retains its exact
dependency on the source Task. Request coordination attaches the destination
Task asynchronously. Its accepted result wakes the parent, which reviews it
and decides how it changes the original obligation. If admission succeeds but
the source attempt is interrupted, recovery reuses the correlated request.

Creating the child is progress, not resolution. The parent cannot complete
merely because another App accepted the request.

## Task-owned escalation

A task-bound workflow cannot publish an event and assume somebody will act. It
returns evidence and either:

- an exact Condition for a known external fact or approval;
- `needs-agent` when the same App needs one bounded agent judgment; or
- a typed dependency in the reconciliation result that establishes a child App
  request.

The host links the child request or approval operation back to the exact task
generation. Its completion publishes/wakes the corresponding exact Condition
or task target. The task reconciler then observes current state and decides its
own result; it does not infer task completion from the child result.

The implementation must not hide this relationship in a workflow prompt,
source-session resume record, or generic event owner field.

## Human attention

Straightforward human judgment stays on the source Task as one exact
human-owned Condition. The shared human adapters derive `/todo` from that
Condition and return the reply as evidence. The App never calls Telegram or a
browser directly, and adapter delivery never becomes Task state.

Use a typed child request to the May App only when clarification, sensitive
channel policy, deduplication, or a multi-turn human conversation is itself a
separate outcome:

```text
domain App/task
  -> direct human Condition, or typed child request to May
  -> Console/Telegram present the same Task identity
  -> exact human reply becomes evidence
  -> source task reconciles and resumes
```

Naming a human role grants neither transport access nor automatic completion.
May may clarify, reject, deduplicate, or deliver according to human preferences
when it owns a child request, but the source still applies the exact result.

An actionable human ask includes:

- the exact decision or action requested;
- why the current owner cannot perform it;
- compact evidence or stable evidence references;
- safe choices and consequences where known;
- urgency/severity;
- a stable semantic correlation key; and
- what source obligation will resume after the answer.

Put the short plain-language ask in `Condition.requestedAction`; keep detailed
reasoning and evidence on the Task. This makes `/todo` decision-ready without a
parallel inbox or a model-generated list.

Do not paste an entire transcript when exact artifacts, task IDs, or execution
IDs identify the evidence.

## Admission, result, and completion

These states remain separate:

| State                  | Meaning                                             |
| ---------------------- | --------------------------------------------------- |
| Child request admitted | Destination request is durable; Task attachment may still be pending |
| Destination attached   | Exact destination Task owns the requested outcome |
| Adapter observation    | Optional evidence about a presentation attempt       |
| Child result           | Destination task returned an accepted result        |
| Source resumed         | Original task observed and applied that result      |
| Source complete        | Original owner verified its own outcome             |

Events and traces may record these transitions for audit. Adapter observation
is optional and never gates the work. None replaces the parent/child request
and Task links.

## Deduplication and expiry

For a new dependency, the Host derives request identity from the source App,
Task and generation, dependency `id`, destination App/optional Task, and full
input. `input.data.correlationKey` is ordinary domain data, not a special Host
deduplication field.

Across attempts, retain the dependency ID, destination and input for unchanged
work. When continuing an existing open request, reuse its durable request ID
or the exact linked dependency; the Runtime checks that destination identity
still agrees. It can also match an unchanged open request by destination and
input, but rejects ambiguous matches or an unexplained replacement. Changing
incidental input text is not a safe way to retry the same obligation.

A revised source generation or changed input does not justify abandoning an
open request. Preserve or explicitly resolve existing dependencies before
declaring distinct work. See [Task dependencies](task-resource-engine.md#parents-and-dependencies).

Age alone never resolves an escalation. A deadline may wake the source owner,
which may keep waiting, choose a safe fallback, revise the ask, cancel the
dependency, or complete with an evidence-backed rejection. Expiry is an
explicit source policy, not a generic event-pair terminal state.

## Workflow blocking

Workflows use only bounded execution results:

```ts
return ctx.done("phase completed", output);
return ctx.blocked("cannot continue locally", evidence);
```

`ctx.blocked` is local and synchronous. It does not escalate, start a new owner
session, or keep the workflow open. The task reconciler decides whether to
retry, wait, request same-owner judgment, create a cross-App dependency, or
stop.

## Health and audit

Health readouts surface:

- parent requests/tasks waiting on child App results;
- stale child admission or handling;
- human notifications without actionable context;
- child results not yet applied by their source obligation;
- duplicate suppression and conflicting correlation keys;
- repeated escalation without changed evidence; and
- historical escalation records that cannot be correlated to their canonical
  source obligation.

Historical escalation events and traces remain readable as evidence. New work
uses caller reports and App request/task dependencies. The still-active legacy
runtime path noted above is an implementation gap; it must not be advertised
as read-only until its actions have actually been retired.

## Integrity checklist

- The escalation crosses a real ownership boundary.
- The destination is an App address, not an owner string fallback.
- The child request states one exact action/decision and compact evidence.
- A source wait names a durably admitted destination request; interrupted
  linkage can recover that same request.
- Admission, destination result, source resume, and source completion remain
  distinct; adapter presentation remains outside Task state.
- The source owner applies the child result before claiming completion.
- Local workflow blocking never escalates automatically.
- Repeating an unchanged dependency reuses its request; ambiguous replacement
  is rejected.
- No event pair, trace, or mutable session becomes escalation authority.
