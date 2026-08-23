# Escalation

**Design status:** Accepted.
**Implementation status:** Exact task/human Conditions and typed Runtime-managed
cross-App Task dependencies are implemented. Request dispositions are removed.
Historical event-pair and source-session records are read-only evidence, not
work authority.

## Purpose

Escalation is an explicit request across a real ownership boundary.

```text
source obligation
  -> current owner proves it cannot perform the required next action
  -> child request addressed to the owner who can decide or act
  -> source waits on that exact child result
  -> source task reconciles the result
```

Escalation is not a synonym for failure, waiting, retry, attention, or workflow
blocking. It does not create a special work authority. The destination task
owns the requested outcome; the source task remains the authority for the
original outcome. Runtime request records correlate the dependency and result.

## Boundary test

| Situation                                                   | Correct representation                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| Another useful repair remains inside the same owner's scope | Continue the bounded workflow or reconcile the same task      |
| Reusable workflow needs App-agent judgment                  | Return `needs-agent` for the same task                        |
| Bounded execution cannot continue safely                    | Return `blocked` evidence; owning boundary decides next state |
| Known external fact will change later                       | Persist an exact task Condition                               |
| Another App must decide or act                              | Create a typed cross-App task dependency                      |
| Human approval or private judgment is required              | Create a May task dependency or exact human Condition         |
| Agent attempt was incomplete                                | Honest execution result; not escalation by itself             |

The current owner, not the Host, decides that a blocker crosses an
ownership boundary.

## App-to-App escalation

When a task discovers that another App owns the next action, its reconciliation
result requests one typed Runtime-managed dependency:

```ts
return ctx.done("Waiting for release governance", {
  state: "waiting",
  dependencies: [
    {
      id: "release-governance-v4",
      appId: "release-governance",
      input: {
        kind: "approval-request",
        data: {
          requestedAction: "Approve, adjust, or reject the rollout.",
          reason: "Production policy requires an independent decision.",
          evidence: ["verification/report.json"],
          severity: "P1",
          correlationKey: "sample:production-rollout:v4",
        },
      },
    },
  ],
});
```

The Runtime resolves the destination task and records the parent dependency and
caller correlation before waking it. The destination task produces one
correlated result. The parent wakes, reviews the result, and decides how it
changes the original obligation.

Creating the child is progress, not resolution. The parent cannot complete
merely because another owner accepted the request.

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

Human escalation crosses into the May App because May owns conversation and
channel policy:

```text
domain App/task
  -> typed child request to May with question, evidence, choices, and urgency
  -> May decides whether/how to contact the human
  -> channel delivery and reply remain correlated to the May request
  -> May's task returns one accepted result
  -> source task resumes
```

Naming a human role does not grant a domain App direct access to Telegram or a
browser session. May may clarify, reject, deduplicate, or deliver according to
human preferences, but its task must return an accepted result to the source
task.

An actionable human ask includes:

- the exact decision or action requested;
- why the current owner cannot perform it;
- compact evidence or stable evidence references;
- safe choices and consequences where known;
- urgency/severity;
- a stable semantic correlation key; and
- what source obligation will resume after the answer.

Do not paste an entire transcript when exact artifacts, task IDs, or execution
IDs identify the evidence.

## Delivery, result, and completion

These states remain separate:

| State                  | Meaning                                             |
| ---------------------- | --------------------------------------------------- |
| Child admitted         | Destination task durably owns the requested outcome |
| Notification delivered | The human-facing message reached its channel        |
| Child result           | Destination task returned an accepted result        |
| Source resumed         | Original task observed and applied that result      |
| Source complete        | Original owner verified its own outcome             |

Events and traces may record all five transitions for audit. They do not own
the lifecycle or replace the parent/child inbox and task links.

## Deduplication and expiry

The child admission key combines the source obligation, destination App,
request kind, and stable semantic correlation key. Redelivery cannot create a
second child for the same source dependency. A genuinely revised decision uses
new source generation or explicitly changed semantic identity.

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
- stale child admission, handling, or delivery;
- human notifications without actionable context;
- child results not yet applied by their source obligation;
- duplicate suppression and conflicting correlation keys;
- repeated escalation without changed evidence; and
- historical escalation records that cannot be correlated to their canonical
  source obligation.

Historical escalation events and traces remain readable as evidence. New work
uses App request/task dependencies. Compatibility projections never admit new
legacy pairs or source-session resume ownership.

## Integrity checklist

- The escalation crosses a real ownership boundary.
- The destination is an App address, not an owner string fallback.
- The child request states one exact action/decision and compact evidence.
- Parent/child linkage is durable before the child is woken.
- Delivery, destination result, source resume, and source completion remain
  distinct.
- The source owner applies the child result before claiming completion.
- Local workflow blocking never escalates automatically.
- Deduplication preserves one child per source dependency and semantic key.
- No event pair, trace, or mutable session becomes escalation authority.
