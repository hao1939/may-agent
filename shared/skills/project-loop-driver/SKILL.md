---
name: project-loop-driver
description: >
  Drive a durable may-agent project toward its goal, then keep it in monitoring
  mode so regressions or new signals wake focused work again.
version: 1.0.0
owner: may
tools: [read, query_db, workflow, message, finish]
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

Avoid inventing extra run-mode terminology. State the current mode in plain
language in the project journal or session summary.

## Protocol

### 1. Read the Goal Before Acting

Read the project file first. Extract:

- goal,
- owner,
- current status,
- success signals,
- open questions,
- latest journal/discussion entries.

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
- a journal note with evidence and next action,
- a clear escalation with the blocker and what was tried.

If none of those happened, say why.

### 4. React to Comments and Signals

Project comments, alerts, guard events, evaluator findings, and metric changes
are wake signals. Treat them as requests to re-check the project state.

When a comment arrives:

1. Read the comment and current project context.
2. Decide whether it changes the goal, next action, or evidence standard.
3. Resume intensive work if it creates a meaningful gap.
4. Otherwise record why monitoring remains appropriate.

### 5. Finish the Session Cleanly

At session end, state:

1. Current project mode: intensive work or monitoring.
2. What changed.
3. What evidence proves it.
4. Next action or monitored signal.

Do not say the project is "done" if it is meant to keep maintaining a metric or
system quality. Say "goal currently satisfied; monitoring continues."

## Anti-Patterns

- Treating a metric as the judge instead of a signal.
- Running another heartbeat-style review when the next action is already clear.
- Saying "all milestones completed" without updating the project state or moving
  to monitoring.
- Asking the reviewer to decide facts that the session can verify directly.
- Creating a new project because an existing project needs a journal update.
