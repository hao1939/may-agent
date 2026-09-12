# Work Model

**Design status:** Accepted.

The May system uses one durable work model:

```text
project goal + signal
  -> current desired work
  -> bounded agent/workflow execution
  -> evidence and observed state
  -> completion, exact wait, attention, or next work
```

Apps reconcile tasks. Agents judge and act. Workflows preserve a repeatable
method after experience justifies one. Infra and Runtime schedule, deliver,
persist, execute, and recover without deciding domain meaning.

May owns conversation; the accountable App owns each durable Task. May may
investigate, edit, verify, and answer directly within an authorized bounded
turn. Discussion and joint problem-solving remain in Conversation across turns.
A Task represents work that can advance independently; discussion length,
later conversation, and tool use alone do not require one. Background research
can support a discussion without taking it out of the human's hands.
May can own that Task; another App is useful when it already owns the work,
requires its specific authority, or supplies relevant expertise or a workflow.

A conversational Request is an accepted ask that May must close the loop on.
May recognizes or refines the ask, explains the intended action, and returns
its outcome. A turn can finish while the Request and its linked Task remain
open. Request tracking references work without owning another execution loop.
Host input rows track admission/caller correlation; separate accepted-Request
records preserve scope, exact Task links and closure. Their storage does not
by itself prove correct conversational judgment.
[Message Lifecycle](../2a-design/message-lifecycle.md#requests-acceptance-and-closure)
owns the policy and implementation gap; [System Model](../2a-design/system-model.md)
defines the shared vocabulary.

## Roles

| Piece                    | Role                                                                   |
| ------------------------ | ---------------------------------------------------------------------- |
| Project                  | Durable goal, accountable owner, posture, strategy, and domain context |
| Event or schedule        | Signal that something changed or should be reconsidered                |
| Metric                   | Measurement that may need judgment; never a decision by itself         |
| Task resource            | Durable desired and observed App work state                            |
| Condition                | Exact external fact required before a task can continue                |
| Agent                    | Named profile for one bounded reasoning/action attempt                  |
| Workflow                 | App-owned reusable bounded procedure                                   |
| Session/workflow attempt | Bounded execution that produces evidence                               |
| Controller               | Mechanical reconciliation of current canonical state                   |

These records answer different questions. Do not turn an event, workflow run,
or session result into a second task/project lifecycle.

## The task loop

An App maps durable input to one Task. The Host persists its events, schedules
one fenced attempt, and admits a result against current state. Completion
requires evidence; an external wait names the exact fact needed; attention
states why safe progress stopped.

A Task owns continuation across attempts. Workflows and sessions are bounded
execution evidence. New input remains durable until accepted; its effect on an
in-flight result follows the [Task Resource Engine](../2a-design/task-resource-engine.md),
not a second rule in project policy.

Every maintained outcome needs an observation route. Use provider events or an
observer, adding a scheduled check only where needed. Runtime recovery repairs
lost scheduling from durable state; it does not replace domain observation.

## App, agent, and workflow

The App owns the durable outcome. An agent or workflow works on it within one
fenced execution. Neither executor owns the Task or its recovery.

```text
no workflow binding     -> selected agent handles novel or one-off work
workflow binding        -> workflow performs the learned process
workflow needs-agent    -> selected agent judges the exception once
workflow unavailable    -> attention until the binding is repaired
```

When that agent judgment changes the desired work, the attempt may return one
`update-task` change for the task currently being reconciled. The update must
change the task generation. That result completes only the current attempt:
the task remains live and the controller immediately reconciles its new
generation through the resolved workflow. It is not task completion and does
not bypass the workflow's final acceptance verifier.

The task, not one workflow run, owns the durable reconciliation loop:

```text
same task
  -> workflow reads current facts
  -> agent judges and performs the next in-scope move
  -> workflow verifies the result
  -> local failure feeds the next bounded repair iteration
  -> exact external wait ends this run with a Condition
  -> the observed fact wakes the same task and workflow again
  -> accepted proof converges the task
```

A workflow run is a bounded iteration of this loop. It may perform several
immediate repair-and-verify steps, but it does not remain alive across a
pipeline, pull request, timer, human reply, or other durable wait.

Expected domain difficulty is not `needs-agent`, `attention`, or escalation.
The workflow should use its selected agent to handle merge conflicts, failed
tests, rejected hypotheses, and similar in-scope work. `needs-agent` is the
exception path when the reusable process has exhausted its safe in-scope moves
and the App needs one bounded agent judgment on the same task. Return problems
to the exact caller; that owner decides whether different authority is needed.
A cross-App call alone does not make the work an escalation.

Do not create a workflow merely because work uses an agent or repeats on a
schedule. Extract one when a stable sequence, branching rule, retry, safety
step, or verifier is worth preserving and testing.

## Project posture

Project posture is separate from task execution:

| Status           | Meaning                                            |
| ---------------- | -------------------------------------------------- |
| `active`         | Concrete App work is actionable now                |
| `waiting`        | A recorded signal is required before the next push |
| `blocked`        | The whole App loop lacks a safe autonomous path    |
| `pending-review` | Owner or human judgment is required                |
| `paused`         | Explicit intentional hold                          |
| `done`           | Goal completed                                     |
| `closed`         | Ownership loop intentionally ended                 |

Do not keep a project active merely for monitoring. Cron emits time signals,
watchers observe providers, metrics measure health, and Conditions represent
exact waits. A relevant observation wakes work later.

Task phases are `pending`, `running`, `waiting`, `attention`, and `converged`.
An achieve task leaves the live graph with a receipt when accepted. A maintain
task remains live and sleeps after convergence until a real wake arrives.

## Choosing the mechanism

Use the smallest mechanism that matches the need:

| Need                                  | Mechanism                               |
| ------------------------------------- | --------------------------------------- |
| Novel bounded judgment or action      | Direct agent/agent session              |
| Situational reusable guidance         | Skill                                   |
| Repeatable ordered process            | Workflow                                |
| Durable App outcome and decomposition | App task resource                       |
| Exact external wait                   | Condition plus watcher/event            |
| Time-based wake                       | Schedule/Cron event                     |
| Mechanical observation or translation | Handler, watcher, metric, or projection |
| Cross-App or human required action     | Explicit escalation                     |

More frequent work does not need a new controller. Loops, focus plans, and
one-off tasks use the same app controller when durable task state is useful.

## Evidence and learning

Every bounded run should leave enough evidence for the App or accountable
human to understand what happened and why the result was accepted. A session ID is a
trace link, not a complete acceptance explanation.

Reusable experience belongs in workflows, skills, tests, design, and domain
evidence. Completed tasks leave the live graph; they do not form an archive
tree. Repetition may justify improving the task specification, extracting a
workflow, or creating a maintain task, but frequency alone does not justify
automation.

## Standalone agents

Direct agent execution remains available for bounded calls and experiments.
Recurring responsibility uses ordinary App schedules, events and Tasks, not an
automatically discovered standalone heartbeat workflow. See
[Heartbeat terminology](../2a-design/heartbeat.md).

## Invariants

1. Signals wake judgment; they do not decide project truth.
2. A hierarchical Task view is only an optional layout of containment and
   dependency; it is not a resource or scheduler.
3. Queues carry stable IDs, never copied task specifications.
4. Owners remain accountable even when they delegate a workflow.
5. Workflows are learned processes, not mandatory wrappers around agent work.
6. Durable waits cross event boundaries rather than suspending workflows.
7. Infrastructure enforces mechanics; agents/apps own meaning.
8. Evidence precedes closure and later observations validate the judgment.
