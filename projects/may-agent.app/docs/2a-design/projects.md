# Projects

**Design status:** Accepted.
**Implementation status:** Canonical Apps own current work. Historical Markdown
is intended to be read-only evidence. The command router in reviewed Host
`649d801c` still mutates it; the [boundary cleanup](../proposals/app-policy-and-host-boundary-cleanup.md)
tracks removal of that path and its socket/browser regression evidence.

## Purpose

A project is the durable context for a goal that spans multiple bounded
executions. It answers:

- what outcome is being maintained or changed;
- which App owns the outcome and which human is accountable;
- what is true now;
- what work and evidence exist;
- what should wake the App next.

Use [Define the goal first](../1-principles/design-philosophy.md#define-the-goal-first)
to make the intended outcome, sufficient evidence, scope, and acceptable cost
clear. A standing goal needs bounded milestones so useful work can finish or
wait. Keep the concise goal in `project.json` and supporting rationale in the
existing project documentation.

Projects do not replace events, sessions, workflows, or tasks. The project
holds durable intent and posture; tasks own all App work, while the other
records represent signals and bounded execution. A UI may render
parent/dependency relationships hierarchically, but that view is not another
record.

See [system-model.md](system-model.md) for the whole-system model and
[agent-app.md](agent-app.md) for the executable app contract.

## Canonical Layout

Standing projects keep their App definition and policy in a sibling `.app` directory:

```text
projects/<id>/              # optional portable domain workspace
projects/<id>.app/
  app.ts                    # one defineApp declaration and domain policy
  project.json              # identity, owner, posture, goal, domain binding
  tasks/seed.json           # one-time initialization for an empty runtime
  agents/                   # app-local identities and their learned workflows
  observers/                # optional bounded external-state adapters
  scripts/                  # explicit offline maintenance utilities
  ui/                       # optional domain-specific UI
  .state/                   # host-managed runtime state
```

The `.app` folder contains an App's durable policy, not a separate service. Domain
product source and artifacts stay in the portable workspace.

## Project Manifest

`project.json` owns structured project state. Current apps use:

```json
{
  "id": "my-project.app",
  "owner": "project-owner",
  "status": "active",
  "type": "agent-app",
  "priority": "P1",
  "policy": {
    "mode": "standard",
    "maxConcurrent": 3,
    "maxTaskAttempts": 2
  },
  "domainProject": {
    "id": "my-project",
    "path": "../my-project",
    "repo": "optional remote",
    "branch": "optional expected branch"
  },
  "goal": "What this project achieves.",
  "strategy": ["Durable operating choices and validation posture."]
}
```

`app.ts.workspace` is the runtime binding used by path helpers and commands.
`project.json.domainProject` is the human/project-state description of the same
domain relationship. App integrity checks keep them aligned.

`project.json.id` is also the stable project read-model key. New projects
normally use the sibling directory name (`my-project.app`), but retained
projects such as `gym`, `evaluation`, and `may` keep their established
non-suffixed IDs. Routing normalizes an optional `.app` suffix; do not rename a
live project solely for visual consistency because project rows, links, and
history are keyed by this value.

## Project Status

Project status answers one question: should the App loop push now, wait for a
known signal, request judgment, pause, or stop?

| Status           | Meaning                                                                            |
| ---------------- | ---------------------------------------------------------------------------------- |
| `active`         | Concrete autonomous App work remains now                                           |
| `waiting`        | Current push reached a useful stop; a recorded signal resumes it                   |
| `blocked`        | The whole App loop has no safe autonomous path because of an external dependency   |
| `pending-review` | Owner or human judgment is required before more work                               |
| `paused`         | Explicit intentional hold                                                          |
| `done`           | Goal completed                                                                     |
| `closed`         | Ownership loop intentionally ended                                                 |

Do not keep a project `active` merely for monitoring. Use events, schedules,
Conditions, bounded resync, or a review task to wake it when facts
change.

In catalog views, label this as **saved project status**. It describes authored
intent, not which Apps are loaded or which Tasks are running. An installation's
`.disabled` marker prevents App loading without rewriting project posture or
removing saved context. Use loaded-App and Task reads for current execution;
do not change project status merely to make it resemble installation state.

## Project And Task State Are Separate

Project posture is not task execution state:

| Layer                | Vocabulary                                                                             |
| -------------------- | -------------------------------------------------------------------------------------- |
| Project posture      | `active`, `waiting`, `blocked`, `pending-review`, `paused`, `done`, `closed`           |
| Task resource phase  | `pending`, `running`, `waiting`, `attention`, `converged`                              |
| Readiness projection | ready, dependency-blocked, condition-blocked, capacity-blocked, paused, not-applicable |
| Worker/session claim | success, partial, blocked, failure plus evidence                                       |

A blocked worker is evidence, not proof that the task or project must become
blocked. The App may retry, split, repair, replace, verify, wait, or escalate.

The task contract lives in [task-resource-engine.md](task-resource-engine.md); do
not duplicate its node schema or transition rules in project documents.

## Task loop

The normal project loop is:

```text
input/fact/schedule
  -> App policy resolves or wakes exactly one desired task
  -> deduplicating app queue receives the task key
  -> controller reads current task, dependencies, and Conditions
  -> selected agent runs directly or applies one of its workflows
  -> structured result says converged, waiting, or needs agent
  -> runtime atomically applies task changes and observed status
  -> accepted result wakes exact callers; the owner separately decides closure
```

Each bounded attempt leaves its result and supporting evidence on the Task.
Waiting names an exact Condition or dependency. A failed attempt reports the
problem to its caller; it does not rewrite project posture or automatically
start a separate escalation lifecycle. A converged outcome may leave the Task
open until its owner closes it.

An `active` project without work or a useful wake deserves a consistency review,
not an inferred completion or automatically invented work.

## Policy

Policy changes project posture, not runtime mechanics:

| Mode              | Posture                                                            |
| ----------------- | ------------------------------------------------------------------ |
| `standard`        | Act on clear work; wait when no actionable signal remains          |
| `aggressive-push` | Inspect for the next bounded frontier while credible paths remain  |
| `stable-watch`    | Prefer evidence-backed work and exact waits over speculative churn |
| `maintenance`     | React to incoming signals without continuously seeking new scope   |

Concurrency and attempt limits bound execution. They do not authorize automatic
acceptance, retries without judgment, or task synthesis by infra.

## App-Local Agents And Workflows

App-local identities live under `projects/<id>.app/agents/`. Their learned
workflows live under `projects/<id>.app/agents/<agent>/workflows/`, next to the
agent whose bounded context the process uses. Their runtime artifacts remain
with the app.

Use an App-owned workflow when a repeatable process has been learned for that project.
Use shared TypeScript helper modules for deterministic mechanics. An explicitly
bound workflow is discovered under the resolved agent as
`workflows/<name>.ts`; an unbound task invokes that agent directly. No workflow
registry or agent-entry wrapper is required.

## Metrics And Monitoring

Events, Conditions, event schedules, and bounded resync may wake the App task
controller. Metrics provide observations, but they do not mutate task meaning
or encode project strategy.

Project cache rows and UI read models are projections. `project.json`, runtime
task resources, domain artifacts, completion receipts, and typed project
events remain the authoritative sources for project intent and current
judgment.

## Human Steering

Human comments that require a distinct response enter through a declared App
subscription and become correlated App inputs. Structured UI actions validate
their schema and translate directly to App input. Both use the same
input-to-task resolver; human input never bypasses the resolved App task to mutate
task meaning.

The caller supplies project intent, not an execution plan. It may name the
desired outcome, current evidence, constraints, and proof, but it does not
choose the App's task id, agent, workflow, session, or wake path. Free-form
intent first becomes App-owned Task work. Only an explicit typed action whose
mapping is already declared by the app may wake domain work directly. This is
an app/runtime contract; May does not need to know how the app implements the
choice.

The UI should confirm that steering was accepted, then show the linked task and
its later result or exact wait reason.

## Historical Material

Historical `projects/<id>/project.md`, embedded task lists, sibling
`discussion.md`/`journal.md`, embedded `.app/`, and old project-local layouts
may remain as archived evidence. The autonomous host does not load, mirror, or
write them as task state. Migrated Apps use only the sibling `defineApp`
manifest, agent-owned workflows, and host-managed inbox/task state and
projections.

## Integrity Checklist

- Project id, App id, domain id, accountable owner, and workspace binding agree.
- `active` projects have open work or an immediate App reconciliation path.
- Non-active projects record an exact reason and resume/closure condition.
- Task state changes come through one app reconciler and atomic result application.
- Every actionable project fact has one explicit App subscription, task
  subscription, or exact task target; observation-only facts create no work.
- Events, Conditions, metrics, and resync may wake judgment; none decides project meaning.
- Runtime projections never become a second source of project truth.
- Migrated Apps keep no compatibility writer, scheduler, or mirrored Task
  authority.
