# App/Project Integrity Design

**Design status:** Accepted.
**Implementation status:** Implemented across project apps, task trees, events, metrics, and owner loops.

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

| Piece             | Responsibility                                                                             | Must not do                                                       |
| ----------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Runtime           | Persist events, route handlers, run sessions/workflows, observe liveness.                  | Decide project strategy or mutate task meaning.                   |
| Project app       | Declare event graph, schedules, workflows, actions, UI links, and domain workspace.        | Make the domain repo depend on May-agent.                         |
| Owner workflow    | Wake the owner, pass compact context, drain explicit assignments, emit follow-up events.   | Become a decision tree for project strategy.                      |
| Task tree         | Store decomposition, current state, durable summaries, evidence links, and human steering. | Act as a scheduler, retry log, or source of domain truth.         |
| Worker workflow   | Run exactly one owner-assigned task and return evidence.                                   | Reshape siblings, mark done, or create planning/control branches. |
| Problem solver    | Investigate one visible local failure/root cause and return evidence.                      | Replace owner judgment or directly accept affected tasks.         |
| Metrics/watchdogs | Detect drift and wake the owner with context.                                              | Decide fixes or silently mutate the task tree.                    |
| Escalation        | Cross an ownership boundary with requested action and resume context.                      | Hide local retries or routine project work.                       |

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

`project.owner.requested` is the normal owner wake event.

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

Routine dispatch may fill worker capacity from already-clear backlog leaves the
owner previously wrote. That is mechanical scheduling. Workflow code must not
synthesize domain tasks, requeue stale active work, accept/reject review work,
or mark blockers resolved. Those are owner judgments.

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

| State     | Driver                                                                                                                                         |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `backlog` | Owner assigns if runnable. If not runnable, owner repairs dependency, splits, asks, or records terminal `done`.                                |
| `active`  | Worker emits `project.task.completed`; stale-active watchdog wakes owner for retry, fresh session, replacement, split, problem work, or block. |
| `review`  | Owner accepts to `done`, rejects to `backlog`, creates follow-up/problem work, or records a precise blocker.                                   |
| `blocked` | Owner rechecks resume conditions, unblocks, creates problem-solving work, sends/escalates an ask, or records terminal `done`.                  |
| `done`    | Final project knowledge; may be rolled up or compacted.                                                                                        |

Fresh session means a fresh worker attempt, not a new task concept. If an
attempt ended in an error review or the runtime session went stale, the owner
can retry the same task while the assignment tool gives it a new worker session
id and keeps the old id in `session_history`.

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

Watchdogs are the same pattern. They observe the task/session frontier and wake
the owner with sampled context; they do not repair project meaning themselves.
For `active` work, silence means no recent recorded session activity, even if
the session already performed tool calls earlier in the attempt.
Default wake priority is:

1. stale `active` work whose worker session is missing, errored, or silent
2. pending `review` work, even when worker capacity is full
3. runnable `backlog` work
4. blocked or dependency-waiting backlog when capacity is underfilled
5. generic capacity/open-work reconciliation

The wake payload should name sampled tasks and the reason they need owner
judgment. For dependency-waiting backlog, include the missing, stale, non-done,
or conflicting dependency reason so the owner can repair the tree without
rediscovering the blocker from scratch.

Human notification is for ownership-boundary blockers or repeated owner-loop
failure, not for routine project state.

## Owner Heartbeat

The owner heartbeat is a low-frequency creative fallback. It may be triggered
by a timer, but it is not a schedule in the project-meaning sense: schedules
execute known work, while heartbeat wakes the owner to look around freely and
notice what no fixed procedure or metric would trigger.

Three owner wake mechanisms, each with a different purpose:

| Mechanism          | Purpose                                                     | Frequency                   |
| ------------------ | ----------------------------------------------------------- | --------------------------- |
| Schedule           | Execute known work on a cadence                             | Per-task (minutes to hours) |
| Owner wake (event) | React to completions, problems, metrics                     | On demand                   |
| Owner heartbeat    | Discover unknown issues, drive stuck work, creative insight | Low (every 2-4h)            |

All three write to the same task tree. None create standalone projects.

App manifest contract:

- declare heartbeat as a low-frequency schedule that emits
  `project.owner.requested`
- set `reason: "owner-heartbeat"` and include a compact intent packet
- route it through the normal owner workflow; do not add a heartbeat-specific
  controller
- let the owner inspect deeper context through project tools
- record explicit no-op when nothing useful is found

Runtime read-model contract:

- project app installation refreshes the `projects` table from
  `project.json` when present, otherwise from `app.ts`
- `app.ts` remains the routing manifest; `project.json` is the durable project
  identity/status/priority read by UI and owner-review packets
- owner/status drift between `project.json` and the runtime read model is a
  platform sync issue, not a project strategy decision

What the heartbeat does:

- Notices stuck work that no metric caught
- Finds cross-domain connections (e.g., "HN and XHS converge this week")
- Discovers gaps the planner didn't see
- Challenges stale assumptions in the task tree
- Proposes creative next steps the schedule wouldn't trigger

What it does NOT do:

- Execute fixed procedures (that's a schedule)
- Create standalone projects (findings go into the task tree)
- Run at high frequency (every few hours, not every few minutes)
- Replace the planner or owner-wake workflow

Bounded output contract:

1. Read task tree + recent activity + metrics
2. Look for: stale work, missed gaps, creative opportunities, stuck patterns
3. Check recent heartbeat findings/tasks before creating new work
4. If something found: create a backlog task, update context, or record finding
5. If nothing found: no-op — don't force output
6. Limit output to one to three task-tree actions unless severe liveness risk
   requires more
7. Never create standalone projects
8. Never execute multi-step domain work (create a task for that)

For `aks-rp-e2e`, heartbeat should especially look for stale source or
environment assumptions, VM prerelease coverage/spec/replay gaps, underfilled
worker capacity, blocked families that no metric sampled, task tree bloat that
needs owner rollup, and repeated owner-loop/planner failures.

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

## Execution Plans

### Problem: Always-On Pipeline vs Goal-Directed Execution

The always-on pipeline pattern — watchdog ticks every 5min, planner wakes on
every event, workers grab whatever's next — is good for sustained exploration
but has structural costs:

- **No completion target.** The pipeline runs forever. There is no "done" for
  the pipeline, only for individual tasks. The planner cannot say "we're
  finished" because it has no definition of finished.
- **Reactive sequencing.** Workers run in whatever order the planner assigns.
  There is no strategic ordering — drafts don't run before blocked retries,
  quick wins don't run before deep investigations.
- **Planner churn.** 500+ planner sessions/day just to keep assigning work.
  Most wake, see nothing new, and exit. The planner is a refill loop, not a
  strategist.
- **No progress tracking against a goal.** "3 active tasks" is not the same as
  "17/41 remaining paths to resolve." The pipeline has throughput but no
  measured progress toward an end state.

The pipeline is the right shape for open-ended ongoing work (scout's knowledge
exploration, evaluation's session aftermath). It is the wrong shape when the
work has a known end state and a finite set of items to resolve.

### Execution Plan: Goal-Directed Run

An execution plan is a bounded, goal-directed alternative to the always-on
pipeline. It declares what "done" means, sequences work strategically, and
tracks progress against the target.

```text
execution plan = {
  goal:       "resolve all 41 actionable paths"
  target:     [ list of specific items to resolve ]
  sequence:   [ ordered phases or priority bands ]
  completion: "all target items are pass or terminal"
  timeout:    "48h from start"
}
```

The execution plan is **owner-created, not infra-created.** The owner reviews
the current model/coverage/tree state, decides what's achievable, writes the
plan, and hands it to the execution runtime. The runtime executes the plan
mechanically — assigning items in sequence, tracking progress, and stopping
when the completion criteria are met or the timeout is reached.

### Plan Lifecycle

```text
1. Owner creates plan
   - reviews model gaps, blocked frontier, environment state
   - selects target items (paths, tasks, domains)
   - orders them into phases or priority bands
   - sets completion criteria and timeout

2. Runtime executes plan
   - assigns items from the current phase to workers
   - tracks item outcomes (pass, blocked, terminal, needs-retry)
   - advances to next phase when current phase items are resolved
   - reports progress: "phase 2/3, 12/17 items resolved"

3. Plan completes or times out
   - completion: all target items resolved → report to owner
   - timeout: deadline reached → report remaining items to owner
   - blocked: no items can make progress → wake owner for replan
   - human interrupt: owner or human adjusts/cancels the plan

4. Owner reviews results
   - accepts done items
   - creates new plan for remaining items if needed
   - decides whether to re-enter pipeline mode or plan another run
```

### Plan vs Pipeline

| Aspect              | Pipeline (always-on)                        | Execution plan (bounded run)                      |
| ------------------- | ------------------------------------------- | ------------------------------------------------- |
| Goal                | Keep moving                                 | Resolve specific items                            |
| Sequencing          | Whatever's runnable                         | Strategic: quick wins first, then deep work       |
| Progress tracking   | Task counts                                 | Items resolved / items targeted                   |
| Completion          | Never                                       | When criteria met or timeout                      |
| Planner involvement | Every event (500+/day)                      | Plan creation + replan on block                   |
| Owner wake          | Every completion, metric, watchdog tick      | Plan creation, blocked replan, completion report  |
| Right for           | Open-ended exploration, ongoing evaluation  | Finite coverage gaps, release pushes, audits      |

### Coexistence

Execution plans and the pipeline are not mutually exclusive. A project may:

- Run a plan to clear a coverage push, then return to pipeline for ongoing work
- Run the pipeline for discovery, then create a plan for the found gaps
- Run multiple sequential plans: "clear drafts" → "retry env-blocked" → "push
  blocked frontier"

The pipeline schedules (watchdog, learning tick, heartbeat) may remain active
during a plan run. The watchdog should be plan-aware: instead of waking the
owner to "refill capacity," it tracks plan progress and wakes the owner only
when the plan is stuck or complete.

### Implementation Shape

The execution plan lives in the task tree as a special node or as a separate
plan file (`tasks/plan.json`). It is not a workflow or a schedule — it is
owner-written data that the execution runtime reads.

```json
{
  "id": "push-actionable-paths-20260620",
  "goal": "Resolve all 41 actionable model paths to pass or terminal",
  "created_by": "owner",
  "created_at": "2026-06-20T...",
  "timeout_at": "2026-06-22T...",
  "phases": [
    {
      "id": "promote-drafts",
      "items": ["path.vm.capacity-based-surge", "..."],
      "strategy": "batch-promote with evidence"
    },
    {
      "id": "retry-env-blocked",
      "items": ["path.machines.preview-registration", "..."],
      "strategy": "retry with westus2 auth, record precise blocker if still blocked"
    },
    {
      "id": "push-blocked-frontier",
      "items": ["path.kms.trusted-service", "..."],
      "strategy": "challenge each blocker, resolve or record terminal"
    }
  ],
  "completion": {
    "criteria": "all items in pass, terminal, or product-gap",
    "progress": { "resolved": 0, "total": 41 }
  },
  "status": "active"
}
```

The planner workflow reads the active plan and assigns items from the current
phase instead of scanning the full backlog. The watchdog reports plan progress
instead of generic capacity metrics. The owner is woken only for plan-level
decisions (phase complete, stuck, replan needed).

### What Changes in the App

- `app.ts`: add `project.plan.created` and `project.plan.completed` events
- Planner workflow: if active plan exists, assign from plan phases; otherwise
  fall back to pipeline behavior
- Watchdog: report plan progress, wake owner when plan is stuck or complete
- Task tree tools: plan-aware progress reporting
- UI: show plan progress bar, phase status, remaining items

The always-on pipeline remains as the fallback when no plan is active. The
plan is the owner's tool for saying "push these specific things to completion."

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
