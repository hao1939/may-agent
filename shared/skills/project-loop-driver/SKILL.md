---
name: project-loop-driver
description: >
  Drive a V3 May-agent project app toward its goal through owner review,
  task-tree judgment, evidence, exact waits, and canonical project events. Use
  when judging whether a project is moving, blocked, ready for work, or terminal.
---

# Skill: Project Loop Driver

## When to Apply

Use this skill when you are assigned to a project or asked to judge whether a
project is moving, stuck, complete, or ready to monitor.

Do not use it for a one-off coding task with no durable project context.

## Core Rule

A project is not a ritual. It is a durable frame for reaching a goal.

Use the project frame when it helps preserve context, evidence, decisions,
signals, or next actions. If it stops helping, simplify the project or
escalate with a concrete reason.

## Address The Right Boundary

Give an app the desired outcome, relevant evidence, constraints, approval
boundary, and terminal proof. Do not choose its task id, owner, workflow,
session, or internal wake path. Follow the app receipt to its owner disposition
and then to terminal evidence; owner review is movement, not completion.

Give an agent one bounded executable assignment with exact inputs, constraints,
stop condition, and completion evidence. Use direct agent work only when it is
outside an existing app boundary or when the accountable app owner has already
decomposed that bounded work. The agent returns execution evidence; it does not
claim the app's broader outcome.

## Operating Modes

There are only two practical modes:

| Mode | Meaning | Action |
|---|---|---|
| Intensive work | The project has a meaningful gap, active signal, or unclear root cause. | Investigate, change, verify, and repeat without waiting for heartbeat cadence. |
| Monitoring | The goal is currently satisfied and no urgent gap is known. | Keep metrics/signals watched; resume intensive work when new evidence appears. |

These are reasoning postures, not persisted project or task states. Preserve
project posture in `project.json` and task desired/observed state in
`.state/tasks/state.json`. Use `.state/tasks/tree.json` only as a generated read
projection.

## Protocol

### 1. Read the Goal Before Acting

Read `project.json`, `app.ts`, canonical `.state/tasks/state.json`, the generated
`.state/tasks/tree.json` projection when useful, and the relevant domain
artifacts first. Extract:

- goal,
- owner,
- current status,
- success signals,
- open questions,
- current task-tree frontier, blockers, acceptance, and evidence.

If the project says all milestones are complete, verify that against files,
metrics, or runtime evidence before doing more work.

### 2. Choose the Next Useful Movement

The accountable owner owns the goal, not just task hygiene. Recompute priority
from the current unresolved frontier and choose the highest-value movement;
do not keep following a stale list that points at completed work.

Pick one of these actions:

- investigate a live signal,
- fix a proven root cause,
- run an experiment,
- update project context with evidence,
- ask for owner/human judgment when the next move is not safely knowable,
- move to monitoring when the goal is currently satisfied.

Do not keep producing review text after the project already has enough evidence
to choose an action.

For task-enabled apps, preserve one stable resource per independent
responsibility. Timers and semantic events wake that resource. Direct finite
children express decomposition, `dependsOn` expresses internal ordering, and
Conditions express external facts. The task tree never becomes a scheduling
queue.

### 3. Leave Evidence, Not Ceremony

Every project-driving session should leave at least one useful artifact:

- a code/doc change,
- a metric/event/session id proving a behavior,
- a task-resource change returned through typed reconciler actions, project
  state update, or compact domain record when the app actually uses one,
- a clear escalation with the blocker and what was tried.

If none of those happened, say why.

An unchanged checkpoint is evidence only once. After repeated reviews produce
no new fact, make the owner change approach, expose a precise blocker, or leave
an exact event-driven Condition. Reject an endless series of “still waiting”
reviews and reject escalation to Hao for an ordinary owner decision.

### 4. React to Comments and Signals

Project comments, alerts, guard events, evaluator findings, and metric changes
are wake signals. They cause owner judgment; they are not parallel request
objects or commands to execute blindly.

For project-directed intent, preserve this contract:

```text
project.comment.created receipt
  -> app owner reviews current state
  -> infrastructure emits one correlated project.owner.reviewed result
  -> optional durable task and exact Conditions
```

Several comments may wake one stable owner-review task. Judge the latest level,
but preserve every unresolved input event reference so infrastructure can emit
one result per persisted comment.

When a comment arrives:

1. Read the comment and current project context.
2. Decide whether it changes the goal, next action, or evidence standard.
3. Resume intensive work if it creates a meaningful gap.
4. Otherwise record why monitoring remains appropriate.

### 5. Return One Applicable Decision

At session end, return or state:

1. Current project mode: intensive work or monitoring.
2. What changed.
3. What evidence proves it.
4. Next action or monitored signal.
5. One valid reconciler disposition: `converged`, `waiting` with exact
   Conditions, `needs-owner` when a workflow cannot decide, or typed task
   actions for the reconciler to validate and apply.

Do not edit task storage or emit assignment, completion, or owner-result events.
The generic reconciler applies task actions and emits the correlated
`project.owner.reviewed` closure after admitting the result.

Do not say the project is `done` if it is meant to keep maintaining a metric or
system quality. Record an exact wait or monitoring signal without inventing a
new task state.

## Anti-Patterns

- Treating a metric as the judge instead of a signal.
- Running another heartbeat-style review when the next action is already clear.
- Saying "all milestones completed" without updating the project state or moving
  to monitoring.
- Asking the reviewer to decide facts that the session can verify directly.
- Creating a new project because an existing project needs a journal update.
- Dropping earlier comment receipts when several intents coalesce on one stable
  task.
- Recreating a completed task ID instead of respecting its immutable receipt.
- Keeping passed or superseded work at the top of the priority list.
- Using `project.task.reconciled`, internal Conditions, or repeated checkpoints
  as an app-local scheduler.
