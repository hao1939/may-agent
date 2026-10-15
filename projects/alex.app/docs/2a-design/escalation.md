# Escalation

**Supports:** [System Model](system-model.md#improve-from-evidence-and-make-problems-actionable). Returns an unresolved need to someone with the authority to decide or help.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#one-authority-for-each-resource).

**Design status:** Accepted.
**Implementation status:** Exact human Conditions, typed Task dependencies and
caller feedback use the shared Task path. Retained legacy escalation feedback
resolves saved provenance to an exact Task address; missing ownership is recorded
as unresolved. It does not resume a session or infer a supervisor. See
`src/lib/escalation-feedback.ts` and `src/lib/db-writer.ts` in the Host.

## Purpose

**Helper → Task owner agent → App owner agent, when applicable → May → Hao.**
Skip roles already filled by the same agent. A bounded helper returns its blocker
to the caller. The Task owner tries useful authorized recovery, then asks the
App's owner agent for help within that scope. That agent coordinates its App's
capabilities and, if still blocked, asks May. May acts or asks Hao. An agent
without an App has no App step; durable standalone admission remains a
[follow-up](../proposals/standalone-agent-tasks.md).

The App is an extension of its owner agent, not another decision-maker or a
mandatory escalation Task. Its address selects shared scope and routes the ask
to that agent under declared input policy. A separate specialist Task retains
its own owner and original work. May does not recursively delegate the same
unresolved gap to another May Task.

Escalation requests help; it is not a new resource or the response to every
failed operation. Useful authorized recovery can proceed locally. Once the
owner cannot resolve the blocker, another retry does not replace the duty to
ask for help. The [caller-feedback contract](../archive/reviews/caller-feedback-and-waiting.md)
owns reporting during waits and unsuccessful attempts.

Escalation is not a synonym for failure, waiting, retry, attention, or workflow
blocking. It does not create a special work authority. The destination task
owns the requested outcome; the source task remains the authority for the
original outcome. Runtime request records correlate the dependency and result.

## Boundary test

| Situation                                                   | Correct representation                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| Another useful repair remains inside the same App's scope   | Continue the bounded workflow or reconcile the same Task      |
| Reusable workflow needs App-agent judgment                  | Call `ctx.agents.call` within the procedure                        |
| Bounded execution cannot continue safely                    | Return `blocked` evidence; owning boundary decides next state |
| Known external fact will change later                       | Persist an exact task Condition                               |
| Another App must decide or act                              | Create a typed cross-App task dependency                      |
| Task owner needs its App's help                             | Request the App owner agent through the declared App input     |
| App owner agent cannot resolve the blocker                  | Task request to May with a return Condition                    |
| May cannot resolve the blocker                              | May asks Hao through a human Condition/Conversation            |
| Agent attempt was incomplete                                | Honest execution result; not escalation by itself             |

The responsible agent decides when local recovery is insufficient and asks the next
owner in this chain. The Host does not make that judgment.

The agent judges whether recovery can make progress and what help is missing.
Infra admits and delivers the request, preserves its exact return route and
retains the original work. Neither a retry timer nor delegation to a worker with
the same unresolved capability gap replaces that request. Continue useful
independent work while help is pending, and reuse an unchanged ask rather than
repeatedly notifying the human. The [Task execution guide](../2b-manual/task-execution-guide/SKILL.md#escalate-an-unresolved-blocker)
owns the practical procedure and example. This is an agent responsibility;
automatic supervisor fallback remains an [implementation limit](system-boundary.md#ownership-and-intervention),
not a guarantee that every blocked result reaches a human.

## App-to-App escalation

When the App owner agent cannot resolve a blocker, request help from the installed May App
using the existing Task dependency path. The checked
[`dependencyResult`](../examples/app.ts) names `release-governance`, a stable
dependency ID, and the destination's illustrative `approval-request` input.
It illustrates dependency mechanics; use May's actual installed input schema
for blocker escalation. A workflow returns a dependency result as:

```ts
return ctx.done(dependencyResult.summary, dependencyResult);
```

The Task result itself must contain `summary` and `facts`; the outer workflow
summary does not populate its output. `bun run check:may-design` validates the
linked result through production Task result admission.

The Host saves the destination input and attempts synchronous Task attachment
through the destination App's mapping. A failed attachment remains recorded for
admission recovery. The source Task retains the exact input dependency. Its accepted result wakes the parent, which reviews it
and decides how it changes the original obligation. If admission succeeds but
the source attempt is interrupted, recovery reuses the correlated request.

Creating the child is progress, not resolution. The parent cannot complete
merely because another App accepted the request.

## Task-owned escalation

A task-bound workflow cannot publish an event and assume somebody will act. It
returns evidence and either:

- an exact Condition for a known external fact or approval;
- a contribution from an ordinary `ctx.agents.call` when local judgment suffices; or
- a typed dependency in the reconciliation result that establishes a child App
  request.

The host links the child request or approval operation back to the exact task
generation. Its completion publishes/wakes the corresponding exact Condition
or task target. The task reconciler then observes current state and decides its
own result; it does not infer task completion from the child result.

The implementation must not hide this relationship in a workflow prompt,
source-session resume record, or generic event owner field.

## Human attention

May owns the human-facing step of blocker escalation. If she cannot resolve
the App's request, she asks Hao using an exact human-owned Condition and the
supported Conversation path. Existing May work uses its current Task. The shared
human adapters present the ask and return the reply as evidence; agents do not
choose Telegram or browser delivery details.

May applies the human answer and returns the contribution to the source Task.
The source owner judges what remains and continues the original work. Request
admission, human presentation, returned help and source completion remain
separate facts. Ordinary approval Conditions already owned by another Task
keep their existing contract; this chain governs unresolved-blocker escalation.

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
uses caller reports and exact Task dependencies. Legacy resolution facts retain
a resolved Task target or an explicit unresolved route. They do not grant
permission to start an unrelated agent or resume historical execution.

## Integrity checklist

- An unresolved blocker follows helper → Task owner → App owner when applicable
  → May → Hao, skipping the same agent; the original Task keeps its work.
- Current durable requests use a declared App address and input; discovering
  its owner agent does not create a new routing or permission fallback.
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
