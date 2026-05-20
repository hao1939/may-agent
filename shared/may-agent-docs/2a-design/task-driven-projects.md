# Task-Driven Project Lifecycle

**Status:** Draft  
**Date:** 2026-05-19

## How Projects Work Today

A project is a **durable goal**. It holds everything needed to make progress
across sessions: the goal, current state, signals, plan, and journal.

The project handler ticks every 5 minutes. For each active project, it launches
a workflow: one session does focused work, one session judges results and replans.
One session at a time per project — strictly serial.

---

## The Problem

Serial execution is slow. A project that needs to score 30 sessions, build a
scorer, and analyze patterns does them one at a time. Each session carries the
full project context — expensive, slow, fragile.

The owner replans every session. This is fine for exploration but wasteful when
the work is known: "do these 3 independent things, then combine results."

---

## What This Adds

Task-driven projects do not replace project status or the owner loop. They add
a small task layer inside active projects so independent concrete work can run
in parallel.

Three layers, each answering a different question:

| Layer | Question | Vocabulary |
|-------|----------|------------|
| **Project status** | Should the owner loop run? | active, waiting, blocked, pending-review, paused, done, closed |
| **Task status** | Can this be dispatched? | pending, ready, running, done |
| **Task attempt outcome** | What happened in this attempt? | success, partial, blocked, failure |

These don't overlap. Project status is the owner-loop posture. Task status is
mechanical dispatch state. Task attempt outcome is execution evidence from the
session finish.

---

## Project Status

Project status tells whether the owner loop should keep running. It's about
the whole project, not individual tasks.

| Status | Meaning |
|--------|---------|
| **active** | Owner loop should run: dispatch tasks, judge results, replan, escalate, process signals. |
| **waiting** | Next action depends on a known external condition (user reply, metric recovery, resume_after). Handler checks resume conditions on each tick; events (comments, metric signals) can also reactivate immediately. |
| **blocked** | No useful autonomous action remains and the blocker cannot be routed around. Use sparingly. |
| **pending-review** | Human/owner judgment required before more autonomous work is appropriate. |
| **paused** | Intentional manual hold. |
| **done** | Goal complete. |
| **closed** | Explicitly closed, abandoned, or no longer owned. |

**When to stay active:** if the owner can still create, retry, split, delegate,
verify, or escalate tasks — keep `active`. Most task failures keep the project
active because the owner can replan.

**When to leave active:** only when the *whole owner loop* should stop. Not
because one task attempt failed or blocked — because nothing autonomous remains.

---

## Tasks

A task is something that needs to get done within a project. You break a
project's plan into tasks when the work is concrete enough to parallelize.

A task is a goal, not a session. It might take one attempt or five. The handler
keeps dispatching sessions against it until it's resolved or the owner changes
course.

### What makes a good task

- **Has a clear goal.** "Score sessions 177900–177905" not "make progress on scoring."
- **Is independently dispatchable.** Can start without waiting for unrelated work.
- **Has observable completion.** You can tell when it's done (output exists, metric changed, owner confirms).
- **Takes 5–30 minutes.** Longer → split. Shorter → just do it inline.

### How tasks relate to the plan

The plan is strategy. Tasks are tactics.

```
## Plan
Phase 1: Score enough sessions to find patterns.
Phase 2: Cluster failures into categories.
Phase 3: Build automated scorer from patterns.

## Tasks
- Score sessions 177900–177905 (independent)
- Score sessions 177905–177910 (independent)
- Analyze patterns (needs both scoring tasks done first)
```

The plan tells you *why* and *where we're headed*. Tasks tell you *what to do
next, concretely*. The owner creates tasks from the plan. When all tasks in a
phase are done, the owner assesses results and creates the next phase's tasks.

### Dependencies

Tasks can depend on other tasks. A task with unmet dependencies won't be
dispatched. When its dependencies complete, it becomes ready.

```
score-batch-1 ──┐
                ├──→ analyze-patterns
score-batch-2 ──┘
```

This is the only structural relationship. No priority ordering, no sequencing
rules, no complex DAGs. If two tasks have no dep relationship, they run in
parallel.

### Task status

```
pending → ready → running → done
```

| Status | Meaning |
|--------|---------|
| **pending** | Waiting for dependencies. |
| **ready** | Dependencies met; eligible for dispatch. |
| **running** | One or more sessions are working on it. |
| **done** | Owner accepted a result for the task. |

Task statuses are mechanical. The handler computes them from dep graph + session
state. There's no "blocked" or "waiting" task status. A persisted `status` field
is a handler-owned projection; the source facts remain dependencies, sessions,
and owner-accepted task results.

Done tasks carry a result:

| Result | Meaning |
|--------|---------|
| **succeeded** | Dependency is satisfied and downstream tasks may run. |
| **failed** | Owner accepted that the task failed; downstream tasks do not run unless rewritten. |
| **dropped** | Owner removed the task as no longer needed. |
| **superseded** | Owner replaced it with another task or plan. |

Dependencies unblock on `result: succeeded` unless the owner explicitly rewrites
or accepts the downstream dependency.

If a session finishes with outcome `blocked`, the task stays running (or
reverts to ready). The owner sees the blocked evidence and decides: retry, split,
add a dependency task, escalate, drop, or move the project to waiting.

The handler allows a small number of direct attempts before owner judgment.
Default `max_task_attempts` is 2 and can be set in project frontmatter. When a
ready task has already reached that attempt count, the handler stops dispatching
that task directly and launches the project owner workflow so the owner can
retry with a different approach, split it, drop it, or escalate.

The project steward observes the same condition read-only. It reports
`owner_judgment_needed` as a project health finding and metric so heartbeat and
closed-loop review can see the stall even if the dispatcher is not currently
able to make progress. This is a signal, not a project status change.

### Blocked task example

```
project.status = active              (owner can still act)
task.status = running                (not resolved yet)
latest session outcome = blocked     (execution evidence)
→ owner sees evidence at next judgment
→ owner decides: retry with different approach / split into subtasks /
  add dependency / escalate / drop task / move project to waiting
```

Only move the project to `blocked` if every meaningful path is blocked and the
owner cannot handle it through retry, splitting, delegation, or escalation.

---

## Parallel Execution

Independent tasks run simultaneously:

```
Time →
  [score-batch-1] ████████ done
  [score-batch-2] ████████████ done        ← parallel
  [build-scorer]  ██████ done              ← parallel
                              [analyze] ████████ done  ← unblocked by deps
                                                  [review] ██
```

vs today (serial):
```
Time →
  [iter-1] ████ [review] █ [iter-2] ████ [review] █ [iter-3] ████ ...
```

Bounded by `max_concurrent` per project (default: 3) and system-wide session budget.

---

## How Sessions Work Within a Task

A task is a goal. It may take multiple sessions to achieve. Each session is one
attempt to make progress:

```
Task is running, no active session
  → handler dispatches session to task's assignee
  → assignee gets: task goal, prior attempt history, minimal project context
  → finishes with outcome: success / partial / blocked / failure
  → success → owner marks task done (succeeded)
  → partial → keep running, next tick dispatches again
  → blocked/failure → evidence for owner judgment
```

The assignee gets a focused scope: just this task's goal and what happened
before. Shorter context → cheaper, faster, higher success rate.

Stuck sessions, repeated failures, timeouts, and long-running sessions are health
conditions derived from session outcomes and runtime state. They are judgment
triggers, not separate session outcomes.

---

## Roles

In v1:
- Each task has an **assignee** — who does the work.
- The project **owner** judges — same `owner` field already in frontmatter.

The owner runs judgment sessions when triggered: assesses task outcomes, creates
next tasks, updates the plan, changes project status. This is what the owner
already does today — it just happens less frequently now (between phases, not
every session).

Different agents can work on different tasks within the same project. The owner
coordinates them through task creation, not direct interaction.

### Judgment triggers

The owner's judgment session runs when:
- All current tasks are done (phase complete)
- A task has failed repeatedly (owner judgment; may escalate if it crosses ownership)
- A human comments (immediate replan)
- Staleness detected (system health)

The owner sees: project goal, all task outcomes since last judgment, metric
values, human comments. It decides: create next tasks, modify existing ones,
update the plan, or change project status.

---

## Metrics as Signals

Metrics are signals. They signal what may need attention. The owning agent
must decide.

A metric crossing a threshold doesn't complete a task or change project status.
It produces a signal event. The owner observes signals and decides what they
mean in context.

**Why not mechanical?** "When `sessions.scored >= 10`, mark the task done" is
tempting but brittle. The count hit 10 — are they good scores? Did quality
degrade? Is the downstream task actually ready? Only the agent can judge.
Mechanical rules encode assumptions; signals preserve optionality.

Metrics serve three roles — all advisory:

1. **Attention** — "something changed, look here." Surfaced to owner at next
   judgment point.
2. **Context** — "here's the state of the world." Assignees and owner see
   current values to inform decisions.
3. **Wake-up** — "this project may need attention." Can trigger a judgment
   session for projects in waiting status.

Tasks can declare signal hints (`done_signal`, `watch_signal`) that help the
owner know when to pay attention. These are hints, not commands.

---

## The Project Handler

The existing project handler (`agents/may/handlers/project.ts`) ticks every
5 minutes. The handler should serialize dispatch per project and make dispatch
idempotent, so timer ticks, comments, and nudges do not duplicate task sessions.

**Task dispatch is timer-bounded.** The handler may also receive project
comments or nudges that reactivate projects, but task dispatch itself remains
idempotent and bounded by per-project concurrency rules.

Each tick for active projects with tasks:
- Resolve deps: pending tasks whose deps are all done → mark ready
- Dispatch: ready tasks with no running session → launch worker (up to max_concurrent)
- Complete: sessions that finished → record outcome, surface to owner
- Detect staleness: running too long, deps permanently unmet → trigger judgment

For active projects without tasks:
- Trigger judgment (project needs planning — owner creates tasks)

**Storage target:** v1 stores tasks in a structured `## Tasks` section in
`project.md`. Sessions and events provide execution evidence. No new task
service or separate database is required.

Implementation status: first slice live. Current runtime can parse `## Tasks`,
compute ready/running/pending from dependencies and live task sessions, and
dispatch ready tasks directly from `agents/may/handlers/project.ts`. Task
completion currently updates the task projection for `finish({ status:
"success" })` and emits task lifecycle events. Repeated direct attempts fall
back to the project owner workflow for judgment.

Optional project frontmatter:

```yaml
max_concurrent: 3
max_task_attempts: 2
```

Minimal task shape:

```markdown
## Tasks
- id: score-batch-1
  status: ready        # handler-owned projection; can be recomputed
  result: null         # set when status becomes done
  assignee: evaluator
  goal: Score sessions 177900-177905.
  depends_on: []
  attempts: 0
```

---

## The Full Loop

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  1. PLAN: owner breaks work into tasks                     │
│  2. DISPATCH: handler runs ready tasks in parallel         │
│  3. EXECUTE: assignees make progress, session by session   │
│  4. OBSERVE: metrics signal, deps resolve, work completes  │
│  5. JUDGE: owner sees outcomes + signals, decides next     │
│  6. → back to 2 (or change project status if appropriate)  │
│                                                            │
│  Human comment → skip to JUDGE immediately                 │
│  Metrics → inform judgment, never command                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Each cycle is one phase. Within a phase, tasks run in parallel. Between phases,
the owner assesses and replans. The project advances until the goal is met.

---

## Open Questions

1. **Cross-project dependencies** — not supported. Projects are independent.
