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

## Operating Modes

There are only two practical modes:

| Mode | Meaning | Action |
|---|---|---|
| Intensive work | The project has a meaningful gap, active signal, or unclear root cause. | Investigate, change, verify, and repeat without waiting for heartbeat cadence. |
| Monitoring | The goal is currently satisfied and no urgent gap is known. | Keep metrics/signals watched; resume intensive work when new evidence appears. |

These are reasoning postures, not persisted project or task states. Preserve
the canonical vocabularies in `project.json` and `tasks/tree.json`.

## Protocol

### 1. Read the Goal Before Acting

Read `project.json`, `app.ts`, `tasks/tree.json`, and the relevant domain
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

Pick one of these actions:

- investigate a live signal,
- fix a proven root cause,
- run an experiment,
- update project context with evidence,
- ask for owner/human judgment when the next move is not safely knowable,
- move to monitoring when the goal is currently satisfied.

Do not keep producing review text after the project already has enough evidence
to choose an action.

### 3. Leave Evidence, Not Ceremony

Every project-driving session should leave at least one useful artifact:

- a code/doc change,
- a metric/event/session id proving a behavior,
- a task-tree update through the task tools, project state update, or compact
  journal/discussion record when the app actually uses one,
- a clear escalation with the blocker and what was tried.

If none of those happened, say why.

### 4. React to Comments and Signals

Project comments, alerts, guard events, evaluator findings, and metric changes
are wake signals. They cause owner judgment; they are not parallel request
objects or commands to execute blindly.

When a comment arrives:

1. Read the comment and current project context.
2. Decide whether it changes the goal, next action, or evidence standard.
3. Resume intensive work if it creates a meaningful gap.
4. Otherwise record why monitoring remains appropriate.

### 5. Finish the Owner Turn Cleanly

At session end, state:

1. Current project mode: intensive work or monitoring.
2. What changed.
3. What evidence proves it.
4. Next action or monitored signal.

Close `project.owner.requested` with `project.owner.reviewed` or the explicit
terminal result defined by the owning app. Assign workers only through
`project.task.assigned`; workers return through `project.task.completed` for
owner review.

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
