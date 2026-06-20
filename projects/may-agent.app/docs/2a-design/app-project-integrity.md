# App/Project Integrity Design

## Status

Accepted. This is the compact integrity model for May-agent project apps.

Detailed mechanics live in:

- `project-app-v3.md` for app shape, event graph, schedules, workflows, UI, and
  project/domain boundary
- `task-tree-engine.md` for task-tree schema, state transitions, rollup, and
  hygiene
- `events.md` for event envelope, routing, owner fallback, inbox, and pair
  closure
- `metrics.md` for metric ownership, breach routing, and runtime health
- `escalation.md` for ownership-boundary handoff

This document ties those pieces together so implementation and project apps
share one mental model.

## Thesis

A project app is a small event-driven control plane around a portable domain
project.

```text
event -> owner wake -> owner judgment -> task/evidence update -> follow-up event
```

The runtime delivers, observes, reminds, and records. The project owner judges.
The task tree records the owner's current understanding. Workers execute one
assigned leaf. Metrics and watchdogs wake the owner when the loop drifts.

## Ownership Boundary

Every project has an owner. The owner is the brain for project meaning:

- decomposes work
- accepts or rejects results
- assigns worker leaves
- rolls up completed branches
- decides whether a blocker is local, external, stale, terminal, or wrong
- decides when to escalate across an ownership boundary

Infra and app code should not encode project strategy, domain truth, retry
policy, task decomposition, or acceptance policy. They should wake the owner
with compact context and provide tools that make the owner effective.

## Core Pieces

| Piece | Responsibility | Must not do |
| --- | --- | --- |
| Runtime | Persist events, route handlers, run sessions/workflows, observe liveness. | Decide project strategy or mutate task meaning. |
| Project app | Declare event graph, schedules, workflows, actions, UI links, and domain workspace. | Make the domain repo depend on May-agent. |
| Owner workflow | Wake the owner, pass compact context, drain explicit assignments, emit follow-up events. | Become a decision tree for project strategy. |
| Task tree | Store decomposition, current state, durable summaries, evidence links, and human steering. | Act as a scheduler, retry log, or source of domain truth. |
| Worker workflow | Run exactly one owner-assigned task and return evidence. | Reshape siblings, mark done, or create planning/control branches. |
| Problem solver | Investigate one visible local failure/root cause and return evidence. | Replace owner judgment or directly accept affected tasks. |
| Metrics/watchdogs | Detect drift and wake the owner with context. | Decide fixes or silently mutate the task tree. |
| Escalation | Cross an ownership boundary with requested action and resume context. | Hide local retries or routine project work. |

## Event Contract

Use a small project event vocabulary:

- `project.owner.requested`: wake the owner to review context and move the
  project forward
- `project.task.assigned`: owner-selected worker leaf is ready to execute
- `project.task.completed`: worker returned a claim and evidence for owner
  review
- `project.problem.requested`: investigate one visible problem/root cause
- `project.problem.resolved`: problem solver returned a local resolution
- `project.problem.escalated`: problem solver found an ownership-boundary wait

Legacy names such as `project.planning.requested`,
`project.task.dispatched`, and `project.task.finished` are compatibility
aliases, not design examples.

Every event should have one clear outcome:

- a handler/workflow accepts it,
- a targeted owner inbox accepts it,
- a follow-up event is emitted,
- or an explicit no-op with reason is recorded.

An event exists because something can react. Pure facts that nobody consumes
belong in state, logs, traces, metrics, or knowledge instead.

## Owner Loop

`project.owner.requested` is the normal project heartbeat.

```text
project.owner.requested
  -> event review: understand trigger, recent human steering, related task
  -> owner update: review tree, roll up, repair, create leaves, assign work
  -> drain assignment outbox
  -> project.task.assigned events
  -> optional checkpoint/commit of coherent done slices
  -> project.owner.reviewed or explicit result event
```

The owner wake should include a compact packet:

- state counts
- runnable backlog
- active tasks
- review tasks
- blocked tasks
- dependency-waiting backlog
- recent task completions and problem results
- relevant metric breach context
- recent high-priority human steering

The packet is a starting point. The owner may inspect deeper details with
project tools.

## Task State Integrity

Only five persisted task states exist:

- `backlog`
- `active`
- `review`
- `blocked`
- `done`

Readiness, decomposition, accepted, failed, cancelled, superseded, proposed,
and waiting are not states. They are projections, metadata, structure, or
`done` resolutions.

Only `done` is final. Every other state must have a driver:

| State | Driver |
| --- | --- |
| `backlog` | Owner assigns if runnable. If not runnable, owner repairs dependency, splits, asks, or records terminal `done`. |
| `active` | Worker emits `project.task.completed`; stale-active watchdog wakes owner for retry, fresh session, replacement, split, problem work, or block. |
| `review` | Owner accepts to `done`, rejects to `backlog`, creates follow-up/problem work, or records a precise blocker. |
| `blocked` | Owner rechecks resume conditions, unblocks, creates problem-solving work, sends/escalates an ask, or records terminal `done`. |
| `done` | Final project knowledge; may be rolled up or compacted. |

Every non-done task must either:

1. be actively executing,
2. be owner-reviewable now,
3. have a concrete event or resume condition that will wake the owner later, or
4. be invalid and repaired by owner review.

## Blocked Work

`blocked` is temporary. It means the owner confirmed a real blocker and recorded
how progress can resume.

A valid blocked task records:

- exact blocker condition
- unblock owner
- resume condition
- next review trigger
- current action path: local fix, external ask, escalation, retry condition, or
  terminal disposition

The owner should not retry a blocked task unchanged. Something must change:
dependency satisfied, environment fixed, task split, external answer received,
product decision recorded, or clearer bounded follow-up created.

Blocked-frontier review is normal owner work. It is not a separate controller.
Metrics, schedules, human steering, or focus reviews may wake the owner to
sample blocked and dependency-waiting tasks, but the owner decides the repair.

## Review Work

`review` is owner backlog. It means a worker claim exists and must be judged.

Valid owner outcomes:

- accept evidence and mark `done`
- reject weak evidence and return to `backlog`
- create a concrete follow-up leaf
- link one shared problem-solving task
- record a precise blocker only when external evidence justifies it

Stale review should wake owner. Review tasks do not count as active project
execution.

## Dependency-waiting Backlog

Dependency-waiting backlog is not invisible. It is owner-visible work when it
becomes stale or suspicious.

Valid owner outcomes:

- dependency is done: repair dependency metadata and make the task runnable
- dependency is stale or wrong: replace/remove it
- dependency is locally fixable: create/link one visible problem task
- dependency is a true external wait: record exact blocker/resume condition on
  the dependency and make sure owner review will revisit it

## Problem Solving

Problems are made visible when work fails or blocks for a shared local reason.

```text
task completion shows failure/blocker
  -> app emits project.problem.requested
  -> problem solver investigates one root cause
  -> project.problem.resolved or project.problem.escalated
  -> owner reconciles affected task branches
```

The problem solver may diagnose and fix local tooling, replay, runner, app, or
environment issues. It does not accept task results, roll up branches, or decide
project strategy.

Shared root causes should share one problem task/key. Do not create one
duplicate blocker task per affected feature when the root cause is the same.

## Metrics And Watchdogs

Metrics are signals, not decisions.

Default project health signals should include:

- no runnable/active work while project gaps remain
- capacity underfilled while project gaps remain
- stale active task
- stale review task
- stale blocked task
- dependency-waiting backlog with stale/missing/done dependencies
- repeated shared blocker across tasks
- live execution idle despite runnable work
- duplicate artifact growth

Metric breach handling should wake the project owner first:

```text
metric.breach
  -> project app adapter
  -> project.owner.requested with metric context
  -> owner repairs task tree, creates work, or escalates
```

Human notification is for ownership-boundary blockers or repeated owner-loop
failure, not for routine project state.

## Human And UI Interaction

Human steering is also owner input. Project UIs should send
`project.owner.requested` with context such as selected task, comment, action,
metric, or feature/spec target.

The task tree UI should show:

- the owner's current decomposition and milestones
- backlog, active, review, blocked, and done states
- readiness projection for backlog
- blocker owner/resume/next-review details
- metric trends and recent breaches
- clear actions that send owner-context events

The UI should not mutate task meaning directly unless it is using the same
task-tree tools and owner-reviewed event path.

## Integrity Checklist

A project app is healthy when:

- `app.ts` reads as an event graph: schedules/actions/events to handlers
- each subscribed event has a handler, owner fallback, or explicit no-op
- project workflows are app-local
- the owner workflow receives compact context and can inspect deeper details
- workers only execute owner-assigned leaves
- every non-done state has a driver or exact next wake condition
- blockers carry owner, condition, resume condition, and next review trigger
- problem-solving results return to owner before task-tree reconciliation
- metrics wake owner with context instead of deciding fixes
- human feedback enters as owner-context events
- domain project remains runnable without May-agent

If any item fails, fix the app/project mechanism rather than adding new task
states or hidden workflow branches.
