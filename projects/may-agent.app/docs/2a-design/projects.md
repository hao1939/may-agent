# Projects

> **Status (2026-06-18):** The project model has two tiers:
>
> 1. **Project-apps** (`*.app/app.ts`) — the primary model. App declares owner,
>    schedules, workflow handlers, events, task tree. The legacy project handler
>    is disabled for `.app` projects. See [project-app-v3.md](project-app-v3.md).
>
> 2. **Legacy projects** (`projects/<name>/project.md`) — still valid for simple
>    one-off work, but no active legacy projects remain. The project handler
>    (`agents/may/handlers/project.ts`) is disabled as of 2026-06-15.
>
> New projects should use the `.app` model. This doc describes the shared
> conventions that both tiers use (status lifecycle, frontmatter, project.json).

## Overview

Projects are the unit of explicit multi-session work. A project holds the
durable goal and context; its `status` says whether the owner should push now
or wait for a resume signal.

## Location

Current standing projects use the V3 app layout:

```text
projects/<id>.app/
  app.ts
  project.json
  tasks/tree.json
```

The `.app` folder is the May-agent control plane. Its `project.json` declares
the app/project identity and the domain workspace it drives. The domain
workspace may be another folder under `projects/`, a sibling repo, or another
local checkout; it must remain useful without May-agent.

Legacy projects may still exist as `projects/<name>/project.md`, but the
global legacy project handler is disabled and no active project should be
started in that format.

## Project Directory Layout

A minimal V3 project app is:

```text
projects/<id>.app/
  app.ts              # required app declaration, schedules, routes, actions
  project.json        # required identity, owner, workspace binding, status
  tasks/tree.json     # owner thinking map and task state
  package.json        # optional but recommended command surface
  workflows/          # app-local owner/worker/problem workflows
  agents/             # optional app-local agent identities
  scripts/            # app integrity, projections, utilities
  ui/                 # project-specific UI assets
  docs/               # app/project docs when docs are part of the app purpose
  .state/             # ignored runtime scratch, discussion/journal JSONL, cache
```

Domain deliverables such as features, specs, evidence, replays, model files,
and test runners belong in the domain workspace, not in the `.app` folder. The
app may read, edit, test, and commit the domain workspace when that is part of
the project owner's accepted workflow.

Legacy `project.md` projects used sibling files such as `discussion.md`,
`journal.md`, and `tasks.md`. That split-out convention is historical
compatibility material. V3 apps should use `project.json`, `tasks/tree.json`,
domain files, infra traces, and optional `.state/*.jsonl` runtime scratch
instead.

## Project Manifest Format

For V3 apps, `project.json` is the structured source for identity, owner,
status, workspace binding, and high-level goal context. `app.ts` declares
runtime behavior: schedules, event subscriptions, workflow handlers, actions,
and owner routing.

```json
{
  "id": "my-project",
  "owner": "tech-lead",
  "status": "active",
  "type": "milestone",
  "priority": "P1",
  "workspace": {
    "kind": "local",
    "localPath": "../my-project"
  },
  "goal": "What this project achieves.",
  "signals": [
    "metric.id — what it means and how to interpret it",
    "relevant events, blockers, or user requests"
  ],
  "validation": [
    "What signals, tests, or user feedback prove the next judgment was right."
  ]
}
```

The task tree records the active decomposition, milestones, done summaries, and
review state. Runtime event/session/workflow tables record attempts and traces.
Optional `.state/journal.jsonl` or `.state/discussion.jsonl` may keep compact
runtime notes, but they are not required as a control path.

Legacy `project.md` files used YAML frontmatter plus Markdown sections for
goal, signals, state, plan, validation, and journal. That format remains useful
for reading old projects but should not be used for new standing projects.

## Lifecycle

```
signal/comment/metric/event
  -> active
  -> intensive work while a concrete next autonomous action exists
  -> waiting | blocked | pending-review | paused | done | closed
  -> resume signal can make it active again
```

**Key rule:** `active` means push now. Completion of milestones is a judgment
point, not a stop command. If `Next Action`, unresolved plan work, failed
evidence, or new signals remain, re-plan and continue. Use `waiting` only for a
real external precondition, `blocked` for a dependency the worker cannot resolve,
`paused` for an intentional hold, and `closed` only after explicit human/May
closure or a goal that truly no longer needs ownership. Treat `complete` as a
legacy alias for `done`; do not write new project files with it. Treat
`archived` as a legacy alias for `closed`; it appears on 3 pre-existing DB rows
(workspace-era projects from retired agents) but is not recognized by any
runtime handler and should not be used in new projects.

Do not keep a project `active` only to monitor it. Monitoring belongs in
`resume_condition`, `resume_after`, metrics, events, cron/steward checks, and
heartbeat context.

## Status Transitions

| From | To | Who |
|------|----|-----|
| active | active | Agent keeps pushing because concrete work remains |
| active | waiting | Agent reached a useful stop point; watch for a resume signal |
| active | blocked | Agent found an external dependency |
| active | pending-review | Agent needs owner/human judgment |
| active | paused | Owner intentionally holds the work until an explicit resume signal |
| active | done/closed | Goal complete; no current ownership loop needed |
| waiting/blocked/pending-review/paused | active | Comment, `resume_after`, event, metric signal, or owner judgment makes work actionable |

## Tasks

Tasks are bounded units of work inside an active project. They let independent
work run in parallel without making the owner replan after every worker session.
Project status remains the owner-loop posture; task status is mechanical
dispatch state.

Three layers stay separate:

| Layer | Question | Vocabulary |
|-------|----------|------------|
| Project status | Should the owner loop run? | active, waiting, blocked, pending-review, paused, done, closed |
| V3 task state | What does the task tree say about this node? | backlog, active, review, done, blocked |
| Derived readiness | Can this leaf be assigned now? | runnable, dependency-blocked, conflict-blocked, stale, needs-decomposition |
| Worker claim/result | What did the worker report for owner review? | done, partial, blocked, failed, rejected, plus project-specific fields |

A good task has a clear goal, is independently dispatchable, has observable
completion, and should normally fit in a 5-30 minute worker session. Longer work
should be split. Shorter work should usually be done inline by the owner.

Current `.app` projects store the task tree in `tasks/tree.json` and mutate it
through task-tree tools. The five-state model is defined in
[task-tree-engine.md](task-tree-engine.md). `ready` is not a persisted state or
lane; it is a derived readiness projection from a `backlog` leaf with satisfied
dependencies and no active conflict.

Example V3 task node:

```json
{
  "id": "score-batch-1",
  "parent_id": "project",
  "state": "backlog",
  "goal": "Score sessions 177900-177905.",
  "depends_on": [],
  "acceptance": ["Evidence links are recorded.", "Owner can review the claim."],
  "children": []
}
```

Legacy `project.md` projects stored tasks under `## Tasks`:

```markdown
## Tasks

- id: score-batch-1
  status: ready
  result: null
  assignee: evaluator
  goal: Score sessions 177900-177905.
  run: agent
  depends_on: []
  attempts: 0
```

That embedded list is historical compatibility material. Do not use it for new
`.app` projects.

Optional project frontmatter:

```yaml
max_concurrent: 3
max_task_attempts: 2
project_policy: standard
```

### Project Policy

`project_policy` controls project posture while keeping the same reconciler
mechanics for every project.

Supported policies:

| Policy | Owner posture | Good fit |
|--------|---------------|----------|
| `stable-watch` | Create new tasks from solid evidence. When actionable signals are absent, set `status: waiting` with the current wait reason. | Shared infrastructure and projects where churn is costly, such as `platform`. |
| `aggressive-push` | Actively inspect current evidence for the next frontier. When a plausible path remains, create bounded next tasks and keep the project active. | Discovery or execution projects that should keep advancing, such as `aks-rp-e2e`. |
| `maintenance` | React to incoming signals (regressions, comments, health findings) but do not proactively seek new frontiers. Keep `waiting` unless a signal makes work necessary. | Mature infrastructure or closed-scope projects that should not accumulate speculative tasks. |
| `standard` | Create tasks for actionable work; wait when actionable signals are absent. | Default posture for ordinary projects. |

Use policy to choose threshold, not mechanics. V3 apps express their owner loop,
worker loop, schedules, event subscriptions, and metrics in `app.ts`; legacy
`project.md` projects used the disabled global project handler described later
in this document.

### Task Dependencies

Tasks can depend on other task IDs. In V3, a task with unmet dependencies stays
`backlog` and its readiness projection is `dependency-blocked`. When
dependencies are `done`, the leaf may become `runnable` if no conflict blocks
it.

This is the only structural relationship. If two tasks have no dependency
relationship, they may run in parallel up to `max_concurrent`.

### Task Attempts And Judgment

V3 project owners assign runnable `backlog` leaves. The assignment tool moves a
leaf to `active` with a current attempt id; the worker returns
`project.task.completed`; the app event layer wakes the owner. The owner reviews
the claim and updates the task tree: `review -> done`, `review -> backlog` for
rework, or `review -> blocked` for a confirmed external blocker.

Attempt counts and retry policy are project-app behavior, not task-tree state.
The important invariant is that a worker failure becomes evidence for owner
judgment; it should not loop through automatic retries forever.

Blocked worker sessions are evidence, not task status. The project should stay
`active` if the owner can still retry, split, delegate, verify, or escalate.
Only move the project to `blocked` when the whole owner loop has no meaningful
autonomous path left.

### Owner Judgment Triggers

The owner judgment session runs when:

- All current tasks are done and the next phase needs planning.
- A task reaches `max_task_attempts`.
- A human comment or project signal requires replanning.
- Staleness or health checks indicate the project needs review.
- An active project has no tasks and needs planning.

The owner sees the project goal, recent task outcomes, metric signals, and human
comments. It decides whether to create next tasks, modify existing tasks, update
the plan, change project status, or do nothing.

For an `active` project, "no open tasks" is a policy-driven planning trigger,
not a successful terminal state. A successful owner loop must leave one of these
machine-readable states:

- Concrete next task-tree work exists (`backlog`, `active`, or `review`).
- Frontmatter status is changed to `waiting`, `blocked`, `pending-review`,
  `paused`, `done`, or `closed` with the reason represented in project state.
- The owner escalated because it cannot choose the next step autonomously.

When frontmatter remains `status: active` and every task is already done, the
next owner pass applies `project_policy`: `stable-watch` projects usually choose
waiting unless evidence supports a task; `aggressive-push` projects usually
create the next bounded task when a plausible frontier remains. The handler
emits `project.owner.incomplete` for this mismatch so the needed planning stays
visible.

## Project-App Agents And Workflows

V3 app-local agents live inside the app, not inside the domain workspace:

```text
projects/aks-rp-e2e.app/
  app.ts
  agents/
    aks-explorer/
      agent.json
      AGENTS.md
      workspace/
  workflows/
    project-planner.ts
    task-worker.ts
```

The app manifest owns schedules, event subscriptions, workflow handlers,
actions, and budget/concurrency limits. Workflow files stay app-local when they
contain project-specific prompts, planning packets, task assignment rules, or
domain repair logic. The runtime supplies the event bus, scheduler, session
execution, persistence, and default owner fallback; it does not supervise the
task tree or decide project strategy.

For workflow handlers owned by an app-local agent, the workflow runtime uses the
app-local `agents/` directory as `ctx.agentsRoot`. This keeps runtime artifacts
such as `workspace/`, `last-session.md`, and workflow-produced handoff files
with the app that owns the agent. Code should not hard-code global
`agents/<agent>/...` paths for app-owned workers.

Legacy project-local agents under `projects/<project>/agents/<agent>/` and
legacy embedded apps under `projects/<project>/.app/` are compatibility paths.
Do not use them for new projects.

The retired `app.yaml` design was replaced by `*.app/app.ts`. If old notes refer
to `app.yaml`, translate the intent into `defineProjectApp({ schedules,
workflowHandlers, actions, ... })` in the sibling app.

### Project UI Requests

Project UIs should not call a generic project action API. A browser request that
starts project work is just another event:

```json
{
  "type": "project.action.requested",
  "source": "web-ui",
  "owner": "agent:aks-explorer",
  "data": {
    "projectPath": "projects/aks-rp-e2e",
    "action": "replan",
    "params": {
      "selectedPathIds": ["path.managedsystem.rest-add-existing.minimal-rest"]
    }
  }
}
```

The HTTP adapter accepts the event, the project app or project handler decides
what it means, and runtime intent validation decides what can actually run.
Read-only project state should come from artifacts or explicit view endpoints,
not hidden HTTP function calls in the runtime adapter.

### Existing Exemplar

`aks-rp-e2e` is the canonical project-as-app. It uses the V3 layout
(`project-app-v3.md`): a sibling `*.app/` directory alongside the domain
project, with `project.json` (not `project.md`) as the app manifest:

```text
projects/aks-rp-e2e/                      # domain project (portable, no May-agent deps)
  features/                               # domain knowledge
  specs/                                  # test specs
  replays/                                # replay scripts
  runner/                                 # domain runner
  model/                                  # knowledge model
projects/aks-rp-e2e.app/                  # May-agent control plane (sibling)
  project.json                            # app manifest (id, owner, status, policy, strategy)
  app.ts                                  # event handler / app definition
  agents/aks-explorer/                    # app-local project agent
    agent.json
    AGENTS.md
    heartbeat.md
    workspace/
  workflows/                              # owner workflow, task-worker, problem-solver, watchdog, etc.
  tasks/tree.json                         # five-state task tree: backlog/active/review/done/blocked
  scripts/                                # utility scripts (metrics, integrity checks)
  ui/                                     # project-specific UI components
```

The app drives the domain project through events: `project.owner.requested`
wakes the project owner workflow, which reviews the task tree and explicitly
assigns runnable backlog leaves by emitting `project.task.assigned`. Workers
return `project.task.completed`; blocked task workflows also return through
`project.task.completed` so the owner can repair the task branch.
`project.planning.requested` is accepted only as a legacy compatibility alias.
The domain project remains portable and runnable without May-agent.

> **Note:** The legacy paths `projects/<name>/agents/<agent>/` and embedded
> `projects/<name>/.app/` layouts are historical. `aks-rp-e2e` migrated to
> V3 (`projects/<name>.app/`) in the May 2026 timeframe. V3 project-apps
> use `project.json` and are driven by their own `app.ts` event handler,
> not by the project-health scanner (which only discovers `project.md` files).
> See `project-app-v3.md` for the full design.

## Legacy Project Handler

> **Status (2026-06-15):** The legacy project cron handler (`project` entry in
> `agents/may/cron.json`) was **disabled** on 2026-06-15 — all active projects
> have migrated to `.app` layout and own their schedules via `app.ts`. The
> handler code still exists for reference and possible future re-enablement,
> but it does not run. The project steward and project creative audit handlers
> remain active. See also KE-2011 (orphaned metrics from this handler).

`agents/may/handlers/project.ts` was an event-driven reconciler with a
30-minute timer fallback. The following list is retained as historical behavior
for legacy `project.md` projects, not as the current `.app` project-app loop:
- Treats project events (`project.nudge`, `project.task.finished`,
  `project.completed`, `project.blocked`, etc.) as the primary wake-up path.
  The timer is a backup scan for missed events, direct file edits, and process
  recovery, not the expected latency for comments or task completion.
- Reconciles from current state (`project.md`, `discussion.md`, session/query
  state, metrics), not from the triggering event payload alone.
- Dispatches ready `## Tasks` items for `active` legacy projects, subject to
  task-level concurrency, dependency, attempt, and active-task checks.
- Launches the owner agent with `source: project-owner` when the project needs
  planning or judgment. Only owner loops are singleflight; parallel
  `project-task:*` sessions must not block project-level replanning.
- Resumes waiting-like projects when unread comments or due `resume_after`
  make work actionable.
- Emits project health findings when a waiting project's own contract watch
  metrics are disabled, missing, or stale, because the wait condition is then
  not observable. Contract metrics are read from `resume_condition`,
  `wait_reason`, and `## Watch Conditions`, not every metric mentioned in
  background notes.
- Reruns after `project.owner.finished` so project-health metrics recover as
  soon as an owner replans, waits, closes, or escalates. The timer remains only
  a fallback for missed events and direct file edits.
- Wakes the system-operations lane for unjudged or stale P0/P1 alert chains;
  fresh metric-owner judgment and validation stay in the metric owner path.
  Project-health metric alerts are excluded here because the project reconciler
  is their typed owner handler.
- Escalates true blockers after cooldown.
- Syncs project files into the DB cache for metrics and UI.

## Reconciler Observability

We know the project loop is working by measuring outcomes, not just handler
activity:

- `project.owner.dispatched` proves an event or fallback scan reached owner
  judgment.
- `project.owner.finished` records the owner session result.
- `project.owner.incomplete` records the specific design breach where an owner
  finished successfully but the project still has `status: active` with no open
  tasks.
- `project.health.checked` ~~carries `projectPolicy`, status, task counts, and
  finding count for every scanned project.~~ **Emission removed** (commit
  73d989fdb, 2026-06-10). Was a periodic snapshot at ~2,931/day with zero
  consumers. See ruflo-learning-loop iter-13.
- `project.health.finding` carries `projectPolicy` and finding evidence so
  policy-specific behavior can be inspected without splitting handlers.
- Project-health `metric.breach` / `metric.recovered` events remain normal
  metric events owned by `may`. May registers the project handler as the typed
  auto-handler for known project metrics, so the original metric event can wake
  project reconciliation with metric id/current/threshold context before generic
  metric-alert triage is considered.
- `project.reconcile.trigger-count` ~~records each project reconciler pass with a
  note identifying event vs timer, event type, target project, action count, and
  launched count.~~ **Orphaned** — handler disabled 2026-06-15; metrics left
  `status='active'` with no snapshotter. These are the entire source of
  `capability.status-reality-mismatch-count=3`. Proposed deactivation in
  KE-2011.
- `project.reconcile.launched-count` ~~records how many task or owner sessions a
  reconciler pass launched.~~ **Orphaned** — same as above.
- `project.reconcile.event-latency-ms` ~~records milliseconds from event timestamp
  to reconciler handling. It alerts above 5 minutes because the normal
  event-driven path should not wait for the fallback scan.~~ **Orphaned** — same
  as above.
- `project.owner-incomplete-count` counts active projects with no open work.
  This should normally be zero. A nonzero value means the owner loop needs to
  replan, set waiting/blocked/terminal state, or escalate.
- `project.owner-judgment-needed-count` counts projects needing owner judgment
  for deterministic reasons such as repeated task attempts, all tasks done, or
  no tasks.

For current `.app` projects, latency should be read from event timestamps:
project event to `project.owner.requested` acceptance, `project.task.assigned`,
or `project.task.completed` should be seconds in the normal event-driven path.
Timer schedules are fallback or periodic review mechanisms, not the expected
latency for comments or task completion.

## Legacy E2E Behavior Contracts

These contracts describe the disabled legacy reconciler. Current `.app` project
contract tests should instead prove the V3 app event contract described in
[project-app-v3.md](project-app-v3.md): owner wake, explicit assignment,
worker completion, problem-solver return, metric feedback, and task-tree
integrity.

Legacy project e2e tests proved the reconciler model, not just individual helper
functions. Its core invariant was:

```text
project event -> mark project dirty -> reconcile current project state
```

Events were chances to reconcile. They were not commands to blindly execute the
payload. The reconciler read current `project.md`, `discussion.md`, session
state, metrics, and events, then chose dispatch, owner judgment, replan,
unblock, escalation, or no-op.

Historical live-stack e2e cases:

| Case | Setup | Event | Expected assertions |
|------|-------|-------|---------------------|
| Comment wakes waiting project | Project is `waiting`; no live sessions. | `project.comment.created` or `project.nudge`. | `discussion.md` is updated, project becomes actionable, one owner judgment starts without waiting for the timer. |
| Explicit nudge reconciles current state | Project state changed on disk, or a human/operator wants the project reconsidered now. | `project.nudge` with `projectPath`. | Handler targets only that project, reads current files/session state, and chooses dispatch, owner judgment, replan, escalation, or no-op without waiting for the timer. |
| Nudge does not require a comment | Project is `active` with ready tasks or no tasks. | `project.nudge` with `comment: false` or no `comment` field. | Reconciler runs for the target project; it must not require unread discussion text to act. |
| Comment while workers run | Project is `active`; one or more `project-task:*` sessions are running. | `project.nudge` with comment text. | Live task sessions do not block project-level reconciliation; owner judgment starts or the live session is explicitly steered according to current state, with no project-wide live-session skip. |
| Last task done replans immediately | Active project has one running final task. | `project.task.finished` after task success. | Task is marked `done/succeeded`; owner judgment starts immediately to plan the next phase or move project to waiting. |
| Dependency unblocks immediately | Task B depends on task A. | `project.task.finished` for A. | A is `done/succeeded`; B becomes dispatchable and is launched without waiting for the timer. |
| Parallel capacity dispatch | Project has several independent ready tasks and `max_concurrent: 3`. | `project.nudge` or timer fallback. | Up to `max_concurrent` tasks dispatch; no duplicate task session for the same task ID. |
| Repeated task attempts route to owner | Task is ready with `attempts >= max_task_attempts`. | Reconcile event. | No direct task dispatch; exactly one `project-owner` judgment session starts. |
| Event burst serializes | Several project events arrive close together. | Multiple `project.nudge` / `project.task.finished` events. | Event-triggered handler runs are queued and processed one by one; each pass reconciles current state and owner singleflight prevents duplicate owner loops. |
| Owner singleflight | A `project-owner` session is already running. | Comment/task/metric events for same project. | No second owner session starts; project remains dirty or is revisited after the owner finishes. |
| Fallback scan catches missed event | Direct file edit changes `discussion.md` or `project.md` without emitting an event. | Short-interval test cron tick. | Timer fallback detects changed mtime and reconciles; this is backup behavior, not normal latency. |
| Stale event reads current state | Event payload is duplicated, delayed, or older than `project.md`. | Duplicate `project.task.finished` or nudge. | Reconciler uses current files/session state and does not regress task status or duplicate work. |
| Metric signal wakes project | Project is waiting on a metric/resume signal. | Metric breach/recovery event routed to project. | Project owner sees the metric context and decides replan, task creation, waiting, or no-op. |

Legacy coverage:

- `e2-project-comment-roundtrip` covers legacy comment intake and
  `project.nudge` emission.
- `e3a-task-driven-project-loop` covers task dispatch, dependency unblock, task
  lifecycle events, and repeated-attempt owner routing.
- `e3c-project-reconciler-events` covers queued generic nudges, task-finished
  dependency unblock, immediate final owner review, and owner singleflight.

Future reconciler-specific coverage should add comment-with-live-workers,
metric-signal wakeups, stale-event idempotency, and fallback scan behavior.

## DB Table

Effective query schema for the project cache. Canonical project intent lives in
the V3 app's `project.json` and `tasks/tree.json`, or in legacy
`projects/<name>/project.md` for old projects. This table is only a projection
for UI, metrics, and runtime queries.

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  owner TEXT,
  status TEXT DEFAULT 'active',
  type TEXT DEFAULT 'milestone',
  workflow TEXT DEFAULT 'project',
  iteration INTEGER DEFAULT 0,
  priority TEXT,
  milestones_done INTEGER DEFAULT 0,
  milestones_total INTEGER DEFAULT 0,
  updated_at INTEGER
);
```

## Implementation

- **Project handler:** `agents/may/handlers/project.ts` — **disabled
  2026-06-15** (cron entry `enabled: false`). All active projects now use `.app`
  layout with their own `app.ts` handler. Code retained for reference.
- **Project steward:** `agents/may/handlers/project-steward.ts` scans project
  docs/tasks read-only and reports deterministic findings as
  `project.health.finding` events plus project health metrics. (The former
  `project.health.checked` periodic snapshot was removed in commit 73d989fdb,
  2026-06-10.) It does not dispatch work or edit project files.
- **Project creative audit:** `agents/may/handlers/project-creative-audit.ts`
  and `agents/may/workflows/project-creative-audit.ts` are a legacy semantic
  fallback for unknown project issues. They still use the old
  `discussion.md`/`project.nudge` proposal path and should be migrated or
  retired behind `may-agent.app` owner review. The V3-preferred path is a
  context-rich owner event such as `project.owner.requested` or
  `project.feedback.created`, with the project app deciding how to apply or
  reject the suggestion.
- **Health lib:** `shared/lib/project-health.ts`
- **DB schema:** `projects/may-agent/src/lib/db/schema.ts` (projects table)
- **Project query/projection helpers:** `projects/may-agent/src/lib/query-service.ts` and project handler cache sync

## Current Gaps To Close

- ~~**Orphaned project.reconcile.* metrics (KE-2011):**~~ **Resolved.** The 3
  metrics (`project.reconcile.trigger-count`, `.launched-count`,
  `.event-latency-ms`) have been set to `status='retired'` and
  `capability.status-reality-mismatch-count` is now 0. (Verified 2026-06-18.)
- Project cache schema should stay generated or checked against `schema.ts` so
  docs do not drift into non-existent columns.
- Project docs are the context map. Runtime projections should not become a
  second source of truth for project intent.
