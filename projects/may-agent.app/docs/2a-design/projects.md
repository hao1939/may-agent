# Projects

**Design status:** Accepted.
**Implementation status:** Implemented through sibling V3 project apps.
Historical Markdown project files are evidence only and are not a runtime
compatibility path.

## Purpose

A project is the durable context for a goal that spans multiple bounded
executions. It answers:

- what outcome is being maintained or changed;
- who owns the judgment;
- what is true now;
- what work and evidence exist;
- what should wake the owner next.

Projects do not replace events, sessions, workflows, or task trees. The project
holds durable intent and posture; those other records represent signals,
execution, orchestration, and decomposition.

See [system-model.md](system-model.md) for the whole-system model and
[project-app-v3.md](project-app-v3.md) for the executable app contract.

## Canonical Layout

Standing projects use a sibling `.app` control plane:

```text
projects/<id>/              # optional portable domain workspace
projects/<id>.app/
  app.ts                    # schedules, one task resolver, observations, actions
  project.json              # identity, owner, posture, goal, domain binding
  tasks/seed.json           # one-time initialization for an empty runtime
  agents/                   # app-local identities and their learned workflows
  scripts/                  # integrity/projection/domain utilities
  ui/                       # optional domain-specific UI
  .state/tasks/state.json   # sole mutable task-resource authority
  .state/tasks/tree.json    # generated tree/Kanban read projection
```

The `.app` folder is the May-agent control plane. Domain product source and
artifacts stay in the portable workspace.

## Project Manifest

`project.json` owns structured project state. Current apps use:

```json
{
  "id": "my-project.app",
  "owner": "project-owner",
  "status": "active",
  "type": "project-app",
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

## Project Status

Project status answers one question: should the owner loop push now, wait for a
known signal, request judgment, pause, or stop?

| Status | Meaning |
| --- | --- |
| `active` | Concrete autonomous owner work remains now |
| `waiting` | Current push reached a useful stop; a recorded signal resumes it |
| `blocked` | The whole owner loop has no safe autonomous path because of an external dependency |
| `pending-review` | Owner or human judgment is required before more work |
| `paused` | Explicit intentional hold |
| `done` | Goal completed |
| `closed` | Ownership loop intentionally ended |

Do not keep a project `active` merely for monitoring. Use events, schedules,
Conditions, bounded resync, or owner review to wake it when facts
change.

## Project And Task State Are Separate

Project posture is not task execution state:

| Layer | Vocabulary |
| --- | --- |
| Project posture | `active`, `waiting`, `blocked`, `pending-review`, `paused`, `done`, `closed` |
| Task resource phase | `pending`, `running`, `waiting`, `attention`, `converged` |
| Readiness projection | runnable, dependency-blocked, conflict-blocked, stale, needs-decomposition |
| Worker/session claim | success, partial, blocked, failure plus evidence |

A blocked worker is evidence, not proof that the task or project must become
blocked. The owner may retry, split, repair, replace, verify, wait, or escalate.

The task-tree contract lives in [task-tree-engine.md](task-tree-engine.md); do
not duplicate its node schema or transition rules in project documents.

## Owner Loop

The normal project loop is:

```text
signal/comment/metric/completion
  -> app resolves zero or one desired task
  -> deduplicating app queue receives the task key
  -> controller reads current task, dependencies, and Conditions
  -> resolved owner runs directly or applies an owner-owned workflow
  -> structured result says converged, waiting, or needs owner
  -> runtime atomically applies actions and observed status
  -> completion receipt closes finite work and wakes dependents
```

An owner pass must leave a machine-readable disposition:

- open task-tree work exists;
- project posture records an exact wait/review/pause/terminal reason;
- or an external escalation records the requested action and resume context.

An `active` project with no open work is an integrity failure, not implicit
completion.

## Policy

Policy changes owner posture, not runtime mechanics:

| Mode | Posture |
| --- | --- |
| `standard` | Act on clear work; wait when no actionable signal remains |
| `aggressive-push` | Inspect for the next bounded frontier while credible paths remain |
| `stable-watch` | Prefer evidence-backed work and exact waits over speculative churn |
| `maintenance` | React to incoming signals without continuously seeking new scope |

Concurrency and attempt limits bound execution. They do not authorize automatic
acceptance, retries without judgment, or task synthesis by infra.

## App-Local Agents And Workflows

App-local identities live under `projects/<id>.app/agents/`. Their learned
workflows live under `projects/<id>.app/agents/<agent>/workflows/`, next to the
agent that owns the process. Their runtime artifacts remain with the app.

Use an agent-owned workflow when a repeatable process has been learned for that project.
Use shared TypeScript helper modules for deterministic mechanics. An explicitly
bound workflow is discovered under the resolved agent as
`workflows/<name>.ts`; an unbound task invokes that owner directly. No workflow
registry or owner-entry wrapper is required.

## Metrics And Monitoring

Events, Conditions, and bounded resync wake the app controller. Metrics may
provide observations, but they do not mutate task meaning or encode project
strategy.

Project cache rows and UI read models are projections. `project.json`, runtime
task resources, domain artifacts, completion receipts, and typed project
events remain the authoritative sources for project intent and current
judgment.

## Human Steering

Human comments and structured UI actions enter through typed events. The app
may observe them directly or correlate them to desired task state. Human input
does not bypass the resolved owner to mutate task meaning.

The UI should confirm that steering was accepted, then show the later owner,
task, escalation, or no-op disposition.

## Historical Material

Historical `projects/<id>/project.md`, embedded task lists, sibling
`discussion.md`/`journal.md`, embedded `.app/`, and old project-local layouts
may remain as archived evidence. The autonomous host does not load, mirror, or
write them as task state. Migrated apps use only the sibling app manifest,
agent-owned workflows, and `.state/tasks/tree.json`.

## Integrity Checklist

- Project id, app id, domain id, owner, and workspace binding agree.
- `active` projects have open work or an immediate owner judgment path.
- Non-active projects record an exact reason and resume/closure condition.
- Task state changes come through one app reconciler and atomic result application.
- Every project event has a handler or accountable owner-inbox route.
- Events, Conditions, metrics, and resync may wake judgment; none decides project meaning.
- Runtime projections never become a second source of project truth.
- Migrated apps keep no compatibility writer, scheduler, or mirrored task tree.
