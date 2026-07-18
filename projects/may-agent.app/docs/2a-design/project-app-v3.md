# Project App V3

**Design status:** Accepted.
**Implementation status:** Implemented and active.

## Purpose

A project app is a small event-driven May-agent control plane around a portable
domain workspace.

```text
portable domain workspace     May-agent control plane
projects/<id>/                projects/<id>.app/
  domain source/artifacts       app.ts
  domain-native commands        project.json
                                tasks/tree.json
                                workflows/
                                agents/
```

The domain workspace remains useful without May-agent. The sibling `.app`
owns May-agent schedules, routing, owner workflows, task-tree state, metrics,
and optional UI.

Read [system-model.md](system-model.md) first. Project/task behavior is governed
by [app-project-integrity.md](app-project-integrity.md) and
[task-tree-engine.md](task-tree-engine.md).

## Boundary

The project owner is the brain. The app and runtime provide mechanics.

| Layer | Owns | Must not own |
| --- | --- | --- |
| Domain workspace | Domain source, commands, artifacts, tests, evidence | May-agent runtime APIs |
| Project app | Runtime declaration, owner loop, task-tree control, domain adapters | Domain product truth |
| Runtime | Discovery, delivery, schedules, sessions, workflow execution, persistence | Project strategy or acceptance judgment |
| Owner | Decomposition, review, retry/wait/escalation judgment, closure | Generic infra mechanics |
| Worker | One assigned leaf and its evidence | Sibling planning or task acceptance |

## Required Layout

```text
projects/<id>.app/
  app.ts                 # runtime declaration
  project.json           # identity, owner, status, goal, workspace binding
  tasks/tree.json        # owner decomposition and accepted task state
  workflows/             # app-owned executable processes
  agents/                # optional app-local identities
  scripts/               # integrity/projection/domain adapter utilities
  ui/                    # optional independent domain UI
  .state/                # ignored runtime scratch and append-only local trails
```

Use TypeScript/JavaScript and Bun for app code and scripts unless an existing
required tool has no maintained equivalent.

## Project Manifest

`project.json` is structured state, not executable configuration. It owns:

- stable project id;
- accountable owner;
- project status and priority;
- high-level goal, signals, and validation expectations;
- domain workspace binding.

Example:

```json
{
  "id": "my-project",
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
    "path": "../my-project"
  },
  "goal": "What the project achieves.",
  "strategy": ["Durable operating choices and validation posture."]
}
```

`app.ts.workspace` is the runtime binding. `project.json.domainProject` is the
project-state description of that relationship; integrity checks keep them
aligned. Do not duplicate schedules, handler routes, or action code in
`project.json`.

## App Contract

The SDK type in `@may-agent/sdk` is the executable reference. `defineProjectApp`
is an identity helper: it returns the supplied object and does not generate
hidden behavior.

```ts
export type ProjectApp = {
  id: string;
  version: 1;
  owner?: string;
  description: string;
  workspace: {
    kind: "git" | "local";
    repo?: string;
    localPath: string;
    branch?: string;
  };
  budget: {
    sessionsPerDay: number;
    tokensPerDay: number;
    maxConcurrent: number;
  };
  schedules: Array<{
    id: string;
    enabled: boolean;
    intervalMs?: number;
    cron?: string;
    emits: ProjectAppEvent[];
  }>;
  ownerEntry?: ProjectAppTaskCapability;
  taskWorkflows?: Record<string, ProjectAppTaskCapability>;
  taskRoutes?: ProjectAppTaskRoute[];
  events?: EventSelector[];
  eventGraph?: ProjectEventGraphMetadata;
  actions: Record<string, ProjectAppAction>;
  onEvent?: ProjectAppOnEvent;
};
```

There are five behavior surfaces:

| Surface | Purpose |
| --- | --- |
| `schedules[].emits[]` | Timer source emits typed events |
| `taskRoutes[].accepts[]` | Declarative event-to-task correlation |
| `ownerEntry` / `taskWorkflows` | Accountable fallback and reusable execution capabilities |
| `actions` | Named read-only operation or async typed event |
| `events` / `onEvent` | Rare bounded deterministic translation |

The retired direct event-to-workflow handler path and implicit shared workflow
lookup are not accepted shapes. Events organize work through tasks; they do not
start workflows directly.

`events` has one meaning: selectors handled by `onEvent`. Task-triggering
selectors belong only in `taskRoutes[].accepts`; output-only events belong in
`eventGraph.externalEvents`.

## Event Authoring

App code may use the typed `ProjectAppEvent` authoring shape. Before
persistence, the app loader resolves source/owner, moves flat domain fields
into `data`, and keeps a typed `target` for routing.

```ts
type ProjectAppEvent = {
  type: string;
  target?: {
    project?: string;
    taskId?: string;
    owner?: string;
    sessionId?: string;
    human?: boolean;
  };
  source?: string;
  owner?: string;
  urgency?: "low" | "normal" | "high" | "immediate";
  ttlMs?: number;
  data?: Record<string, unknown>;
};
```

New HTTP/external producers emit the complete canonical envelope directly.
Routes and adapters consume event-specific fields from `event.data`.
Compatibility flattening belongs only at an ingress boundary.

## Task Reconciliation

Use `taskRoutes` to correlate an event with desired task state. Bind repeatable
execution policy through `taskWorkflows`; otherwise the task falls back to the
accountable `ownerEntry`:

```ts
ownerEntry: {
  workflow: "project-owner",
  agent: "project-owner",
  task: "Review the task and return a structured reconciliation result.",
  timeoutMs: 3_600_000,
  context: ["project.json", "tasks/tree.json"],
},
taskWorkflows: {
  "project-planner": {
    workflow: "project-planner",
    task: "Reconcile project planning state.",
    timeoutMs: 3_600_000,
    context: ["project.json", "tasks/tree.json"],
  },
},
taskRoutes: [
  {
    name: "my-project-planning",
    enabled: true,
    description: "Correlate owner wakes with the standing planning task.",
    accepts: [
      { type: "project.owner.requested", target: { project: "my-project" } },
    ],
    resolve: () => ({
      id: "project-planning",
      parentId: "my-project",
      outcome: "Keep project priorities and executable work aligned.",
      acceptance: ["The current frontier has accountable next actions."],
      mode: "maintain",
      workflow: "project-planner",
    }),
  },
],
```

`accepts` can contain an event type string or a typed selector. Prefer a typed
project target when several apps consume the same event family. The reconciler
claims the task, invokes its workflow capability or owner fallback, validates
the structured result, and applies task changes atomically.

## Imperative Event Adapter

Use `onEvent` only for small deterministic translations, such as persisting a
project comment and emitting an owner wake. It may inspect current state,
normalize an ingress event, emit a typed event, or return an explicit no-op.

It must not:

- plan or decompose project work;
- interpret worker quality;
- accept/reject tasks;
- encode retry or blocker policy;
- duplicate task execution already owned by `taskRoutes`.

## Canonical Project Loop

Use the small project event vocabulary:

```text
project.owner.requested
  -> owner workflow
  -> project.task.assigned
  -> worker workflow
  -> project.task.completed
  -> owner workflow
  -> project.owner.reviewed or another typed continuation
```

Problem investigation uses:

- `project.problem.investigation.requested`;
- `project.problem.resolved`;
- `project.problem.escalated`.

`project.owner.requested` is the sole current owner wake. Historical
`project.planning.requested`, `project.execution.requested`,
`project.task.dispatched`, and `project.task.finished` are read-only historical
names, not ingress aliases.

A worker completion is evidence for review. Only the owner updates task meaning
and accepts a final disposition.

## Workflows And Durable Waits

Project workflows follow [workflows.md](workflows.md): ordered synchronous
blocks ending in `done` or local `blocked`.

If work must wait for a human, timer, callback, restart, or external condition:

1. persist the project phase and exact resume condition;
2. emit the appropriate continuation/ask event;
3. end the current workflow;
4. let the later event start another workflow run.

The project owns the durable state machine. Workflow memory does not.

## Path Contract

App code uses explicit roots:

- `ctx.appPath(path)` for `.app` control-plane files;
- `ctx.workspacePath(path)` for domain files;
- `ctx.workspaceCwd()` for domain commands.

The runtime validates resolved paths against the declared app and workspace
roots. A project app cannot use path helpers to claim unrelated projects.

## Discovery And Reload

Runtime discovery scans sibling `projects/*.app/app.ts` modules, validates the
app id/layout/manifest, registers app-local agents, and builds schedule and
task-route entries.

Reload is atomic at the app boundary:

1. import and validate the replacement app;
2. build its schedules, routes, agents, actions, and diagnostics;
3. replace the active registration only after validation succeeds;
4. keep running workflow/session snapshots on the revision they started with.

Invalid apps remain inactive and emit diagnostics; the runtime must not install
a partially valid declaration.

## Task Tree

The canonical tree is `tasks/tree.json`. It records the owner's current
decomposition, evidence links, blockers, attempts, and accepted summaries.

Persist only five task states:

```text
backlog | active | review | blocked | done
```

Readiness, stale attempts, retries, waiting, cancellation, and supersession are
projections or metadata. Task tools and transitions are defined in
[task-tree-engine.md](task-tree-engine.md).

## Metrics And Watchdogs

Metrics and watchdogs detect drift and wake the owner. They may measure missing
work, stale attempts, review backlog, blocked frontier, capacity, delivery
health, or domain outcomes. They do not create domain strategy or silently
mutate task meaning.

A metric breach normally reaches the project owner through the existing event
and owner route. Add a metric-specific workflow only when the project has a
distinct, repeatable response process.

## UI

The shared platform UI owns generic project/task/event/session views. An app
may provide `ui/` for domain-specific evidence or actions. Project UI actions
emit typed events; they do not call hidden project functions or mutate the task
tree outside the owner-reviewed tool path.

The confirmation copy must distinguish “accepted” from “completed.”

## Safety And Versioning

- Scope writes and commits to the owning app/domain repository.
- Never use broad staging across unrelated dirty paths.
- Record the domain revision when app behavior depends on a domain layout.
- Keep mutation, budget, concurrency, approval, workspace, and conflict gates
  explicit.
- Make task resolvers, workflows, and continuation adapters idempotent where
  delivery or reconciliation can repeat.
- Keep credentials and runtime-local state outside committed app files.

## Compatibility

Legacy embedded `projects/<id>/.app/`, project-local
`projects/<id>/agents/`, `project.md` task lists, and retired event names are
read-only compatibility inputs. New projects use the sibling `.app` layout.

Compatibility code must normalize at the boundary and emit the canonical
shape internally. It must not appear in new examples, manifests, or app
workflows.

## Integrity Checklist

- App id, directory, project id, and workspace binding agree.
- Every schedule emits through `emits[]`.
- Every task route declares `accepts[]` and resolves a stable task identity.
- Every routed task has a valid workflow capability or `ownerEntry` fallback.
- No event responsibility is duplicated by `taskRoutes` and `onEvent`.
- Every emitted actionable event has a consumer or accountable owner inbox.
- Owner and worker workflows preserve their judgment boundary.
- Task-tree writes use canonical states and owner-reviewed transitions.
- Durable waits persist project state and cross an event boundary.
- App/domain paths and commits remain scoped.
- Compatibility is isolated at ingress and never written as new state.
