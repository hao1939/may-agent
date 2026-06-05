# Projects

## Overview

Projects are the unit of explicit multi-session work. A project holds the
durable goal and context; its `status` says whether the owner should push now
or wait for a resume signal.

Heartbeat is the implicit self-maintenance project for an agent. Do not create a
shared project for routine heartbeat behavior. Create a shared project when
there is a durable goal that needs explicit ownership, metrics, state, and a
journal.

## Location

All projects live at: `projects/<name>/project.md` under the app root
(`/app/projects/<name>/project.md` in the container).

Shared across agents — any agent can own/advance a project. A project may also carry its own local agents under `projects/<name>/agents/<agent>/`. Project-local agents are discovered like global agents but their coding/read/write root is the project directory, so the same runtime works whether `PROJECTS_ROOT` contains one project or many.

## Project Directory Layout

A minimal project is a single `project.md`. Larger standing projects may split
ancillary content into sibling files for readability:

```text
projects/<name>/
  project.md          # required — identity, metadata, goal, plan, tasks, journal
  discussion.md       # async comments between agents/humans
  journal.md          # optional split-out of ## Journal for large histories
  tasks.md            # optional split-out of ## Tasks for high-task-volume projects
  outputs/            # deliverables produced by the project
  proposals/          # design proposals awaiting review
  workflows/          # project-specific workflow scripts
  repos/              # links or checkouts of related code repositories
  agents/             # project-local agents (see below)
```

When a split-out file exists (e.g. `journal.md`), it is the canonical source
for that section. The corresponding `## Journal` heading in `project.md` may
remain as a pointer or recent-entries summary but must not contradict the
split-out file.

## Project File Format

Project metadata is machine-readable YAML frontmatter. Keep owner and status in
frontmatter so code and agents read the same source of truth. Do not put a
project-driver workflow in frontmatter; the project handler drives projects.

Project bodies should follow the same work-context convention as heartbeat:
goal, signals, current state, plan, evidence/journal, and validation. Keep the
sections compact; the project is memory for future sessions, not a transcript.

```markdown
---
id: my-project
owner: tech-lead
status: active
type: milestone
priority: P1
iteration: 0
---

# Project Name

## Goal
What this project achieves.

## Signals
- metric.id — what it means and how to interpret it
- relevant events, blockers, or user requests

## Current State
What is true now, including known constraints and current theory.

## Plan
- [x] Step 1
- [ ] Step 2
- [ ] Step 3

## Validation
What signals, tests, or user feedback will show the next judgment was right.

## Journal
### 2026-04-29
Completed step 1. Next: step 2.
```

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
legacy alias for `done`; do not write new project files with it.

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
| Task status | Can this be dispatched? | pending, ready, running, done |
| Task result | What accepted outcome satisfies dependents? | succeeded, failed, dropped, superseded |

A good task has a clear goal, is independently dispatchable, has observable
completion, and should normally fit in a 5-30 minute worker session. Longer work
should be split. Shorter work should usually be done inline by the owner.

Tasks live in `project.md` under `## Tasks`:

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

`run` is optional and defaults to `agent`. Use `run: workflow:<name>` only for a
bounded, reusable procedure that should run as a workflow.

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

Use policy to choose threshold, not mechanics. The handler still uses the same
event queue, task parser, owner singleflight, lifecycle events, and fallback
scan for every project.

### Task Dependencies

Tasks can depend on other task IDs. A task with unmet dependencies is
`pending`. When dependencies complete with `result: succeeded`, the task becomes
`ready`.

This is the only structural relationship. If two tasks have no dependency
relationship, they may run in parallel up to `max_concurrent`.

### Task Attempts And Judgment

The handler dispatches ready tasks and increments `attempts`. If a task succeeds,
the handler marks it `done` with `result: succeeded`. If it does not succeed, it
returns to `ready` until the task reaches `max_task_attempts`.

When a task reaches the attempt limit, the handler stops direct dispatch and
launches the owner with `source: project-owner`. The owner decides whether to
retry differently, split the task, add a dependency, drop/supersede it, or
escalate.

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

- Concrete next tasks exist (`ready`, `pending`, or `running`).
- Frontmatter status is changed to `waiting`, `blocked`, `pending-review`,
  `paused`, `done`, or `closed` with the reason represented in project state.
- The owner escalated because it cannot choose the next step autonomously.

When frontmatter remains `status: active` and every task is already done, the
next owner pass applies `project_policy`: `stable-watch` projects usually choose
waiting unless evidence supports a task; `aggressive-push` projects usually
create the next bounded task when a plausible frontier remains. The handler
emits `project.owner.incomplete` for this mismatch so the needed planning stays
visible.

## Project-Local Agents

A project-local agent lives inside the project it owns:

```text
projects/aks-rp-e2e/
  project.md
  agents/
    aks-explorer/
      agent.json
      AGENTS.md
      heartbeat.md
      workspace/
```

The agent name must still be globally unique after discovery. If a project is mounted alone at `/projects/<name>` in a container, the same discovery path works: the runtime scans `PROJECTS_ROOT/*/agents/*` and registers the local agent. No separate single-project mode is required.

For project-local agents:

- `agentDir`, workspace, knowledge, tools, and workflows resolve inside the project-local agent directory.
- `cron.json` and named `handlers/` resolve inside the project-local agent directory.
- Coding tools use the containing project directory as their root.
- Shared infra remains available through the runtime image, but project work should stay in the mounted project.

Project-local handlers are for automation that is meaningful only inside that
project. Shared project lifecycle behavior, such as reconciling all active
projects, remains a global May/platform handler.

## Project-as-App

Status: historical design context. For new implementation work, use
`project-app-v2.md`: `.app/app.ts` owns project behavior, activation happens
through canonical events, and there is no generic `/api/projects/action`
endpoint. The `app.yaml` design below is not the current target.

A project is both a **context container** (goal, scope, knowledge, state) and a
**capability surface** (functions it exposes, events it consumes and produces,
work it drives autonomously). The existing event bus, cron scheduler, and
reconciler form the runtime — the project-app declares what it plugs into that
runtime.

### Mental Model

```text
Project  = context container (goal, scope, knowledge, state)
App      = capability surface (cron jobs, event handlers, workflows, tools)
Infra    = existing event bus + cron + reconciler that chains everything together
```

The project-app does not run its own event loop. The existing infrastructure IS
the event loop. The project-app declares:

1. **What events I consume** — handlers fire, I do work
2. **What functions I expose** — other agents/projects can call my workflows
3. **What events I produce** — downstream projects/handlers react
4. **What I explore on schedule** — cron drives periodic deepening

Outputs are inputs to something else. The system stays alive because project-apps
chain through the shared event bus.

### Relationship to Project-Local Agents

Projects with a full local agent (like `aks-rp-e2e/agents/aks-explorer/`) already
have app behavior via their agent's `cron.json`, handlers, and workflows. That
pattern remains valid and is the canonical exemplar.

`app.yaml` provides the same capability surface for projects that do not need a
full agent identity — lighter-weight project-apps that run workflows under an
existing agent (typically `may` or the project owner agent) rather than requiring
their own agent directory.

### app.yaml

A project declares its app behavior in `projects/<name>/app.yaml`:

```yaml
# projects/<name>/app.yaml

# What this project-app provides and runs
functions:
  workflows:
    - name: explore-frontier
      description: "Discover new coverage gaps"
      agent: may                         # which agent runs it (default: project owner)
      schedule: "0 9 * * *"             # optional cron expression
      on: [coverage.gap.detected]       # optional event triggers
      context:                          # files loaded into session context
        - projects/<name>/project.md
        - projects/<name>/knowledge-map/README.md
      timeout_ms: 1800000
    - name: generate-report
      description: "Produce weekly coverage report"
      schedule: "0 8 * * 1"

  tools: []  # future: project-exposed tools discoverable by other agents

# Autonomous exploration configuration
exploration:
  push_policy: balanced   # explore-heavy | serve-heavy | balanced

# Resource constraints
budget:
  sessions_per_day: 10
  tokens_per_day: 500000
  max_concurrent: 2

# Safety boundaries
guardrails:
  scope_boundary: project.md            # cannot explore outside declared scope
  require_review_for:
    - shared state mutations
    - new tool registration
```

Fields:

| Field | Required | Description |
|-------|----------|-------------|
| `functions.workflows` | yes | Workflows this project-app runs, with schedule and/or event triggers |
| `functions.tools` | no | Tools exposed to the system (future) |
| `exploration.push_policy` | no | How aggressively the app explores (`explore-heavy`, `serve-heavy`, `balanced`) |
| `budget.sessions_per_day` | no | Max autonomous sessions per calendar day |
| `budget.tokens_per_day` | no | Max output tokens per calendar day |
| `budget.max_concurrent` | no | Max simultaneous sessions (default: from project frontmatter or 2) |
| `guardrails` | no | Constraints on autonomous behavior |

### Reconciler as App Supervisor

The project reconciler remains the single authority over project lifecycle. Its
role evolves from pure task dispatcher to app supervisor:

```text
Before: reconciler = read project.md → dispatch tasks → wait
After:  reconciler = read project.md + app.yaml → manage lifecycle of a running app
```

The reconciler:

| Concern | Reconciler's role |
|---------|-------------------|
| "Should this project-app be running?" | Owns the decision — only registers app when `status: active` |
| "What does it do when running?" | Reads `app.yaml`, registers cron entries + event subscriptions |
| "Has it exceeded its budget?" | Tracks sessions/tokens per day, enforces caps |
| "Does it need owner judgment?" | Same triggers as today (all tasks done, attempts exceeded, etc.) |
| "Should it stop?" | Unregisters everything when status flips to waiting/closed/paused |

Lifecycle flow:

```text
1. Reconciler pass reads projects/<name>/app.yaml
2. Project status is "active" → register cron jobs + event subscriptions
3. Cron fires → session dispatcher checks budget → launches session
4. Session runs declared workflow, produces events
5. Reconciler reacts to project.session.finished:
   - Budget remaining? Let app keep running
   - Budget exhausted? Flip to waiting, unregister cron
   - Owner judgment needed? Launch owner session
6. Status flipped to waiting/paused/closed → unregister all cron + subscriptions
```

New lifecycle events:

| Event | Meaning |
|-------|---------|
| `project.app.registered` | App cron/subscriptions wired into the runtime |
| `project.app.suspended` | Budget exhausted or status flipped — app stopped |
| `project.app.budget-exhausted` | Specific budget breach (sessions or tokens) |

### Budget Model

Per-project budget is tracked in the DB:

```sql
CREATE TABLE project_budget (
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,           -- YYYY-MM-DD
  sessions_used INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  PRIMARY KEY (project_id, date)
);
```

The session dispatcher increments counters before launching. When a counter
would exceed the declared budget, the dispatcher refuses the session and emits
`project.app.budget-exhausted`. The reconciler then flips the project to
`status: waiting` with `wait_reason: "budget exhausted, resets tomorrow"`.

Budget resets daily. No carryover — unused budget does not accumulate.

### Migration Path

Projects already using the project-local-agent pattern (full agent directory with
`cron.json`) do not need `app.yaml`. Their existing setup is the heavyweight
equivalent — `app.yaml` is for projects that want app behavior without the
overhead of a dedicated agent identity.

To migrate a project to project-as-app:

1. Add `app.yaml` declaring workflows, schedule, and budget.
2. Ensure workflows exist in `projects/<name>/workflows/`.
3. Set project status to `active` — the reconciler handles registration.

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

`projects/aks-rp-e2e/` is the canonical project-as-app, using the full
project-local-agent pattern:

```text
projects/aks-rp-e2e/
  project.md                              # context: goal, scope, plan
  agents/aks-explorer/
    agent.json                            # agent identity
    cron.json                             # 3 scheduled capabilities
    workflows/aks-rp-e2e-iteration.ts     # the work
  knowledge-map/                          # domain knowledge
  execution/                              # execution state
```

Its cron entries demonstrate the pattern: scheduled exploration (hourly learning),
periodic review (weekly replan), and event-triggered verification — all gated by
`enabled: true/false` and event triggers, with the reconciler managing the
project's overall lifecycle.

## Project Handler

`agents/may/handlers/project.ts` is an event-driven reconciler with a
30-minute timer fallback:
- Treats project events (`project.nudge`, `project.task.finished`,
  `project.completed`, `project.blocked`, etc.) as the primary wake-up path.
  The timer is a backup scan for missed events, direct file edits, and process
  recovery, not the expected latency for comments or task completion.
- Reconciles from current state (`project.md`, `discussion.md`, session/query
  state, metrics), not from the triggering event payload alone.
- Dispatches ready `## Tasks` items for `active` projects, subject to
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
- `project.health.checked` carries `projectPolicy`, status, task counts, and
  finding count for every scanned project.
- `project.health.finding` carries `projectPolicy` and finding evidence so
  policy-specific behavior can be inspected without splitting handlers.
- Project-health `metric.breach` / `metric.recovered` events remain normal
  metric events owned by `may`. May registers the project handler as the typed
  auto-handler for known project metrics, so the original metric event can wake
  project reconciliation with metric id/current/threshold context before generic
  metric-alert triage is considered.
- `project.reconcile.trigger-count` records each project reconciler pass with a
  note identifying event vs timer, event type, target project, action count, and
  launched count.
- `project.reconcile.launched-count` records how many task or owner sessions a
  reconciler pass launched.
- `project.reconcile.event-latency-ms` records milliseconds from event timestamp
  to reconciler handling. It alerts above 5 minutes because the normal
  event-driven path should not wait for the fallback scan.
- `project.owner-incomplete-count` counts active projects with no open work.
  This should normally be zero. A nonzero value means the owner loop needs to
  replan, set waiting/blocked/terminal state, or escalate.
- `project.owner-judgment-needed-count` counts projects needing owner judgment
  for deterministic reasons such as repeated task attempts, all tasks done, or
  no tasks.

Latency should be read from event timestamps: project event to
`project.owner.dispatched` or task dispatch should be seconds in the normal
event-driven path. The 30-minute timer is only a fallback for missed events,
direct file edits, and process recovery.

## E2E Behavior Contracts

Project e2e tests should prove the reconciler model, not just individual helper
functions. The core invariant is:

```text
project event -> mark project dirty -> reconcile current project state
```

Events are chances to reconcile. They are not commands to blindly execute the
payload. The reconciler reads current `project.md`, `discussion.md`, session
state, metrics, and events, then chooses dispatch, owner judgment, replan,
unblock, escalation, or no-op.

Recommended live-stack e2e cases:

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

Existing coverage:

- `e2-project-comment-roundtrip` covers comment intake and `project.nudge`
  emission.
- `e3a-task-driven-project-loop` covers task dispatch, dependency unblock, task
  lifecycle events, and repeated-attempt owner routing.
- `e3c-project-reconciler-events` covers queued generic nudges, task-finished
  dependency unblock, immediate final owner review, and owner singleflight.

Future reconciler-specific coverage should add comment-with-live-workers,
metric-signal wakeups, stale-event idempotency, and fallback scan behavior.

## DB Table

Effective query schema for the project cache. The canonical project source is
still `projects/<name>/project.md`; this table is a projection for UI, metrics,
and runtime queries.

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

- **Project handler:** `agents/may/handlers/project.ts`
- **Project steward:** `agents/may/handlers/project-steward.ts` scans project
  docs/tasks read-only and reports deterministic findings as
  `project.health.checked` / `project.health.finding` events plus project
  health metrics. It does not dispatch work or edit project files.
- **Project creative audit:** `agents/may/handlers/project-creative-audit.ts`
  and `agents/may/workflows/project-creative-audit.ts` provide the fallback for
  unknown issues. The handler selects one open project on a cooldown and runs a
  May workflow. The workflow may inspect broadly, but it only appends a
  proposal comment to `discussion.md` and emits `project.nudge`; the normal
  project owner loop reviews any suggested change before applying it.
- **Health lib:** `shared/lib/project-health.ts`
- **DB schema:** `src/lib/db/schema.ts` (projects table)
- **Project query/projection helpers:** `src/lib/query-service.ts` and project handler cache sync

## Current Gaps To Close

- Project cache schema should stay generated or checked against `schema.ts` so
  docs do not drift into non-existent columns.
- Project docs are the context map. Runtime projections should not become a
  second source of truth for project intent.
