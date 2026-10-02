# Error handling, metrics and responsive conversation

**Historical context:** [Metrics And Alerts](../../2a-design/metrics.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Archived discussion, paused at the user's request on 2026-09-10.
App placement, consolidation and default metric architecture remain open.
This is a discussion summary, not a new accepted subsystem contract.

> “let's archive our discussion, we need more time. now let's focus keep the core simple and robust”

Current work follows the [simple and robust core focus](../../proposals/task-runtime-organization.md#current-focus-simple-and-robust-core).
The [design philosophy](../../1-principles/design-philosophy.md) remains the guide:
what value does a choice provide, what does it cost, and is it worthwhile over
its expected lifetime and risk? More recovery machinery is not automatically
more robust; safe affordable redo can be the simpler choice.

## What the user wanted

- Useful error handling by default, natural to App execution and easy to add.
- Code executes predictable actions and records facts; the LLM judges uncertain
  causes, alternatives and whether further work is worthwhile.
- Metrics retain evidence for later investigation and improvement, including
  failures that eventually recover.
- Conversation stays responsive while Tasks take time to execute. Both abilities
  matter; separating personal assistance from task execution is not a goal in itself.
- Keep the solution simple. Architecture should earn its complexity through
  concrete value, not through more layers or elaborate ownership machinery.

## How the discussion changed

Initially, default error handling and baseline metric collection/aggregation
were classified together as core. The [earlier draft](default-error-handling-and-metrics-draft-20260909.md)
and [live PoC](default-error-metrics-poc-20260909.md) explored that direction.

The user then questioned whether an ordinary App could provide those default
capabilities. This separated two decisions: whether users receive a capability
by default, and whether its implementation must be in core. The earlier core
classification was reopened; the PoC did not settle it.

After a more elaborate split was suggested, the user proposed the smaller idea:

```text
App execution error
    -> onError(error, context)
    -> event on the existing bus
    -> ordinary App subscriber
        -> record observation and metrics
        -> investigate and handle the error
```

This was the preferred direction to explore. Record the observation before
investigation so investigation failure does not lose the original evidence.
Failure in the hook or subscriber must not prevent the runtime from handling
the original execution failure. Existing events, workflows and metric services
should be reused. No generic recovery framework or new service was requested.
The hook and subscriber were discussed, not implemented by the earlier PoC.

## App placement and user experience

Reusing `may-agent.app`, reusing `may.app`, creating a dedicated App, and merging
the two existing Apps were discussed. The assistant alternated recommendations;
the user did not settle on an App merger or a new App.

Conversation and Task execution are capabilities an App can both support. The
critical user experience is that a long Task must not hold the conversation
busy. One App can have separate conversational and background executions:

```text
human message -> short conversational turn -> reply
                           |
                           +-> start / steer / cancel a background Task
                                                       |
                                              progress or result
                                                       v
                                                  Conversation
```

The conversation can return after work is admitted; the Task executes in its
own session and later exposes meaningful progress or a result. Background error
investigation should follow the same pattern. Host foreground capacity is an
existing starting point, not end-to-end responsiveness proof.

The suggested next UX experiment was to start a slow Task, send another message,
verify a reply before that Task finishes, then steer it and receive its result.
That experiment was proposed but not run. Whether one or two App identities
best support the experience remains open.

## Evidence retained and its limits

The isolated PoC ran real Host/worker processes, SQLite, events and a controlled
HTTP provider. It observed retry, attention, metric failure containment, an
explicit scope revision and restart. A separate real model judged a synthetic
cost packet; the fixture owner applied its conditional recommendation.

It demonstrated that measurements can be derived from retained attempt evidence
and that a collector failure can be contained. It did not prove that collection
belongs in core, implement the later error hook, or establish responsive chat
while Tasks run. The unpublished [patch and evidence](default-error-metrics-poc-20260909.md#scope-and-artifacts)
remain available for review. No PoC code was promoted into the shared Host, and
no App was merged or deployed by this work.

## When to reopen

Reopen with a concrete user need or reproduced gap. Use the smallest experiment
that answers it: the hook/subscriber path for default handling, or the slow-Task
conversation test for responsiveness. Choose App placement only when it changes
complexity or behavior in a useful way. The archive creates no obligation to
implement every explored feature.
