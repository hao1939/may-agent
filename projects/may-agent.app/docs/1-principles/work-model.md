# Work Model

**Design status:** Accepted.

May-agent uses one durable work model:

```text
project goal + signal
  -> current desired work
  -> bounded agent/workflow execution
  -> evidence and observed state
  -> completion, exact wait, attention, or next work
```

Apps organize work. Agents judge and act. Workflows preserve a repeatable
method after experience justifies one. Infrastructure schedules, delivers,
persists, reconciles, and recovers without deciding domain meaning.

## Roles

| Piece                    | Role                                                                   |
| ------------------------ | ---------------------------------------------------------------------- |
| Project                  | Durable goal, accountable owner, posture, strategy, and domain context |
| Event or schedule        | Signal that something changed or should be reconsidered                |
| Metric                   | Measurement that may need judgment; never a decision by itself         |
| Task resource            | Optional durable desired and observed work state                       |
| Condition                | Exact external fact required before a task can continue                |
| Agent                    | Independently runnable capability and judgment                         |
| Workflow                 | Agent-owned reusable ordered process                                   |
| Session/workflow attempt | Bounded execution that produces evidence                               |
| Controller               | Mechanical reconciliation of current canonical state                   |

These records answer different questions. Do not turn an event, workflow run,
or session result into a second task/project lifecycle.

## Default project loop

```text
semantic event, Condition observation, human comment, or resync
  -> app resolves zero or one stable task intent
  -> controller queues only the task ID
  -> worker claims the latest canonical generation
  -> explicitly bound workflow or resolved owner runs
  -> runtime validates and atomically applies one result
  -> achieve receipt, maintain convergence, exact Condition wait, or attention
```

The task attachment is optional. An app may only organize an owner, domain
context, schedules, events, or actions. Direct and Gym runs use the same agent
capability without task infrastructure.

## Owner and workflow

The owner is accountable for the outcome. A workflow is an optional execution
method delegated by that owner.

```text
no workflow binding     -> owner handles novel or one-off work
workflow binding        -> workflow performs the learned process
workflow needs-owner    -> owner judges the exception once
workflow unavailable    -> attention until the binding is repaired
```

Do not create a workflow merely because work uses an agent or repeats on a
schedule. Extract one when a stable sequence, branching rule, retry, safety
step, or verifier is worth preserving and testing.

## Project posture

Project posture is separate from task execution:

| Status           | Meaning                                            |
| ---------------- | -------------------------------------------------- |
| `active`         | Concrete owner work is actionable now              |
| `waiting`        | A recorded signal is required before the next push |
| `blocked`        | The whole owner loop lacks a safe autonomous path  |
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

| Need                                  | Mechanism                                |
| ------------------------------------- | ---------------------------------------- |
| Novel bounded judgment or action      | Direct owner/agent session               |
| Situational reusable guidance         | Skill                                    |
| Repeatable ordered process            | Workflow                                 |
| Durable goal and decomposition        | Project app plus optional task resources |
| Exact external wait                   | Condition plus watcher/event             |
| Time-based wake                       | Schedule/Cron event                      |
| Mechanical observation or translation | Handler, watcher, metric, or projection  |
| Cross-owner required action           | Explicit escalation                      |

More frequent work does not need a new controller. Loops, focus plans, and
one-off tasks use the same app controller when durable task state is useful.

## Evidence and learning

Every bounded run should leave enough evidence for the accountable owner to
understand what happened and why the result was accepted. A session ID is a
trace link, not a complete acceptance explanation.

Reusable experience belongs in workflows, skills, tests, design, and domain
evidence. Completed tasks leave the live graph; they do not form an archive
tree. Repetition may justify improving the task specification, extracting a
workflow, or creating a maintain task, but frequency alone does not justify
automation.

## Standalone agents

Standalone agents without an app may use heartbeat as a recurring wake for
self-maintenance. App-owned work uses app schedules, events, and task resources
instead of a second heartbeat-driven project loop.

## Invariants

1. Signals wake judgment; they do not decide project truth.
2. Task trees explain containment and dependency; they do not schedule work.
3. Queues carry stable IDs, never copied task specifications.
4. Owners remain accountable even when they delegate a workflow.
5. Workflows are learned processes, not mandatory wrappers around agent work.
6. Durable waits cross event boundaries rather than suspending workflows.
7. Infrastructure enforces mechanics; agents/apps own meaning.
8. Evidence precedes closure and later observations validate the judgment.
