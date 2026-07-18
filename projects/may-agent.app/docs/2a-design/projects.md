# Projects

**Design status:** Accepted.
**Implementation status:** Implemented through sibling V3 project apps. Legacy
Markdown projects are read-only compatibility material.

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
  app.ts                    # schedules, task routes/capabilities, actions
  project.json              # identity, owner, posture, goal, domain binding
  tasks/tree.json           # owner decomposition and accepted task state
  workflows/                # app-owned ordered processes
  agents/                   # optional app-local identities
  scripts/                  # integrity/projection/domain utilities
  ui/                       # optional domain-specific UI
  .state/                   # ignored runtime scratch
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

`complete` and `archived` are historical read aliases only.

Do not keep a project `active` merely for monitoring. Use events, schedules,
metrics, resume conditions, or owner heartbeat review to wake it when facts
change.

## Project And Task State Are Separate

Project posture is not task execution state:

| Layer | Vocabulary |
| --- | --- |
| Project posture | `active`, `waiting`, `blocked`, `pending-review`, `paused`, `done`, `closed` |
| Task-tree state | `backlog`, `active`, `review`, `blocked`, `done` |
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
  -> project.owner.requested
  -> owner reviews current project and task-tree state
  -> owner updates decomposition/judgment
  -> project.task.assigned for selected runnable leaves
  -> project.task.completed with worker evidence
  -> owner accepts, rejects, repairs, waits, or escalates
  -> project.owner.reviewed or another typed continuation
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

App-owned identities live under `projects/<id>.app/agents/`. App-owned workflows
live under `projects/<id>.app/workflows/`. Their runtime artifacts remain with
the app that owns them.

Use a project workflow when policy or prompts are specific to that project.
Use shared TypeScript helper modules for deterministic mechanics. Shared
workflow discovery is intentionally unsupported because workflow policy must
have one explicit owner.

## Metrics And Monitoring

Metrics, schedules, and watchdogs wake owner judgment. They may detect stale
attempts, missing work, review backlog, blocked frontier, capacity gaps, or
domain outcome changes. They must not mutate task meaning or encode project
strategy.

Project cache rows and UI read models are projections. `project.json`,
`tasks/tree.json`, domain artifacts, and typed project events remain the
authoritative sources for project intent and current judgment.

## Human Steering

Human comments and structured UI actions enter through typed events. The
project app persists relevant discussion context and emits
`project.owner.requested`. Human input does not directly bypass owner review to
change task meaning.

The UI should confirm that steering was accepted, then show the later owner,
task, escalation, or no-op disposition.

## Compatibility

Historical `projects/<id>/project.md`, embedded task lists, sibling
`discussion.md`/`journal.md`, embedded `.app/`, and project-local agent layouts
may be read by explicit compatibility tools. The disabled legacy reconciler is
not part of the current project model.

New projects must not emit historical project event names or write legacy
project/task formats. Compatibility normalizes at ingress and never becomes a
second live lifecycle.

## Integrity Checklist

- Project id, app id, domain id, owner, and workspace binding agree.
- `active` projects have open work or an immediate owner judgment path.
- Non-active projects record an exact reason and resume/closure condition.
- Task state changes come through owner-reviewed task-tree transitions.
- Every project event has a handler or accountable owner-inbox route.
- Metrics/watchdogs wake judgment instead of deciding project meaning.
- Runtime projections never become a second source of project truth.
- Legacy formats remain read-only and absent from new examples.
