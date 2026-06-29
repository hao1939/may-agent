# Project App V3

## Status

Accepted. This is the canonical project-app design.

For the compact end-to-end control-loop model that ties project apps, task
trees, events, metrics, blockers, and owner review together, see
`app-project-integrity.md`.

Earlier project-app designs are retired. The embedded-app iteration proved the
control-plane split by putting May-agent runtime files under an embedded
`.app/` folder. V3 keeps the split but moves the app out of the domain project
entirely and uses owner-first language.

## Thesis

A domain project should be portable and runnable without May-agent.

A project app is how May-agent drives that domain project.

```text
aks-rp-e2e/        # domain repo
aks-rp-e2e.app/    # May-agent app/control-plane repo folder
```

May-agent should discover project apps, not infer app behavior from every
project directory. The simplest discovery rule is:

```text
**/*.app/app.ts
```

The app then declares the domain workspace it drives.

## Mental Model

```text
Event   = delivery envelope
Source  = who says the event happened
Target  = the concrete object the event is about
Owner   = who is accountable if the target does not handle it
Context = what the owner needs to understand the request/result
Result  = event/state update that closes the loop
```

Infra serves this loop. It delivers events, resolves owners, starts sessions,
tracks workflow/event traces, reminds on missing closure, and surfaces
unhandled/stale work. Infra must not decide project strategy, task-tree shape,
retry policy, acceptance, or domain truth. Those are owner decisions.

There is one event model. There are not separate "platform events" and "app
events"; events differ by scope and owner. A runtime metric breach, a project
task completion, and a human approval request all use the same envelope shape:

```json
{
  "type": "project.task.completed",
  "source": "agent:aks-explorer",
  "owner": "project:aks-rp-e2e",
  "target": {
    "project": "aks-rp-e2e",
    "taskId": "verify-spec-node-http-proxy-update"
  },
  "data": {}
}
```

- `source` answers: who emitted this?
- `target` answers: what did it happen to, and where should delivery start?
- `owner` answers: who is accountable if the target does not handle it?
- `data` carries the handoff payload for the selected handler.

An owner is any durable routable subject that can be accountable for closing or
escalating an event. It is not the same thing as a handler. A handler is code
that may process an event; an owner is the responsibility boundary used when the
target does not fully handle it.

Good owner identities have:

- stable identity;
- durable state or authority;
- clear close/escalate responsibility;
- a default handler or delegate path.

Examples:

- `project:aks-rp-e2e` owns project policy, task-tree judgment, acceptance, and
  escalation.
- `human:operator` owns approval and direction decisions.
- `agent:aks-explorer` owns agent-private/runtime work.
- `task:aks-rp-e2e/aks-spec-verification-loop` can own a long-lived controller
  task if that task has durable state and a clear completion/escalation rule.

Most task ids should be targets, not owners. Most workflows are handlers, not
owners, because they are implementation units and usually have no durable
authority outside the owner that invoked them.

This is intentionally close to browser event common sense: an event starts at a
concrete target, then falls back through ownership boundaries. For project apps,
the project is a first-class owner. The configured project-owner agent is the
project's delegate/executor, not the owner identity for project events.

Owner inference should be automatic and deterministic:

```text
owner = explicit owner
     ?? owner inferred from target
     ?? owner inferred from project/workflow context
     ?? owner inferred from source agent
     ?? agent:may
```

Recommended inference:

- `target.project` -> `owner: "project:<project>"`
- workflow context `projectId` -> `owner: "project:<projectId>"`
- `target.human` or `to: "human"` on human-message/approval events ->
  `owner: "human:operator"`
- otherwise source agent -> `owner: "agent:<agent>"`

Explicit owner always wins. App code should usually set `target` and let the
runtime infer `owner`. `target.taskId` by itself does not infer
`owner: "task:..."`; most task ids are concrete delivery targets. Use an
explicit task owner only for durable controller tasks that meet the owner rules
above.

Use a small event vocabulary. Prefer context-rich `project.owner.requested`
events over many narrow event names. The event type describes what happened; the
target and owner decide where it goes; the data explains intent, subject,
evidence, and expected closure.

Task-targeted events start at the task and roll up. A completion event targeted
at `{ project, taskId }` first offers exact task handlers, then parent/loop task
handlers when available, then the project owner:

```text
task:verify-spec-node-http-proxy-update
  -> task:aks-spec-verification-loop
  -> project:aks-rp-e2e
  -> project-owner delegate agent
```

Target matching is containment-based. A selector for `{ project: "aks-rp-e2e" }`
matches an event targeted at `{ project: "aks-rp-e2e", taskId: "..." }`; a
selector with `taskId` only matches that task.

## Goals

- Keep domain projects clean, cloneable, and runnable without May-agent.
- Move May-agent task trees, workflows, runtime UI, discussion streams, and app
  code into `*.app/`.
- Let `*.app/` folders live in the agents/platform repo, not in the domain repo.
- Make project discovery simple and explicit: a folder ending in `.app` is a
  May-agent project app.
- Allow more than one app to drive the same domain project when useful.
- Keep all activation event-based: timer, human input, UI action, run
  completion, and workflow completion are events.

## Non-Goals

- Designing new behavior around legacy embedded `projects/<name>/.app/`.
- Making domain projects depend on May-agent packages.
- Making the runtime understand AKS, evaluator, platform, or other domain
  semantics.
- Turning app state into a replacement for infra event/session/workflow
  observability.
- Requiring every project to have a sibling app.

## Core Boundary

```text
Domain project = product knowledge + project-native tools
Project app    = May-agent control plane that drives the domain project
Runtime        = event delivery + schedules + sessions + workflow execution
```

The dependency direction is one-way:

```text
project.app -> domain project
domain project -/-> project.app
```

The domain project must remain useful without the app. For `aks-rp-e2e`, a user
must be able to clone the repo, run `bun install`, run `bun run check`, resolve
specs, and execute specs without May-agent.

The app may clone, mount, inspect, test, edit, and commit the domain project,
but those behaviors are May-agent behaviors.

Domain commits are owner checkpoints. They do not need a dedicated event when
the project owner already owns review, rollup, and project-state decisions. The
worker produces files and evidence, then emits completion; the owner verifies
the task, runs project checks, commits a coherent done slice when safe, and
records the commit hash in the task tree or project state. Do not let workers
commit directly, and do not commit active/review work just because files are
dirty.

## Repository Ownership

Recommended ownership:

```text
aks-rp-e2e repo
  README.md
  features/
  runner/
  model/
  runs/
  design/

agents repo
  projects/
    aks-rp-e2e.app/
      app.ts
      package.json
      tsconfig.json
      project.json
      tasks/
      workflows/
      agents/
      scripts/
      types/
      docs/                 # app-owned project docs when docs are part of the app's purpose
      ui/
      .state/
```

The agents/platform repo owns app logic because that logic is May-agent
integration. The domain repo owns the project product.

## App Layout

```text
aks-rp-e2e.app/
  app.ts                 # required app declaration and event handler
  package.json           # app-local command surface
  tsconfig.json          # app TypeScript check boundary
  project.json           # structured app/project state and workspace binding
  tasks/
    tree.json            # current task decomposition and review state
    README.md
  workflows/             # project-specific workflows
  agents/                # optional app-local agent identities
  scripts/               # app package tooling, not domain runner logic
  types/                 # small app-local ambient declarations
  ui/                    # project app UI assets
  e2e/                   # app/UI cross-surface tests
  .state/                # ignored app sandbox/runtime scratch
    discussion.jsonl     # optional append-only human/app exchange
    journal.jsonl        # optional compact app-local trace
    planner-runs.jsonl   # optional compact planner attempt trace
    tmp/
    cache/
  archive/               # retired app-control files
```

No active `runner/`, domain test `scripts/`, `events/`, `runs/`, `evidence/`,
`specs/`, `replays/`, `features/`, or `model/` folder belongs inside the app.
The domain project owns those domain tools and artifacts. The app may have a
small `scripts/` folder for package tooling such as integrity checks, bundle
helpers, and task-tree inspection. App-owned `docs/` is appropriate when those
docs describe the app/project itself, such as May-agent principles and platform
design in `may-agent.app/docs/`; product/domain docs still belong in the domain
workspace. May-agent infrastructure owns durable event, session, workflow, and
intent history. The app may keep compact JSONL traces in `.state/` only when
they help the app reason during local operation.

## Shared SDK Boundary

Keep workflow entrypoints local to the app. A workflow is where the app's
project-specific judgment, prompts, domain commands, and side effects live, so
it should be reviewed with the app that owns it.

Prefer app-local workflows over global May handlers for project behavior. Global
handlers may discover apps, deliver events, provide generic compatibility, and
surface missing closure, but they should not become the place where a specific
project's owner packet, planning loop, task assignment policy, or domain repair
logic lives. When behavior is specific to `may-agent.app`, `aks-rp-e2e.app`,
`evaluation.app`, or another app, put that behavior under that app's
`workflows/` directory and route to it from `app.ts`.

For `.app` projects, the legacy global project handler is only a backstop. If it
detects that a project app needs owner attention, it should emit a targeted
`project.owner.requested` event for the app's domain project id. It should not
read `tasks/tree.json`, compute runnable leaves, dispatch task workers, or fork a
generic owner session for that app. The app-local owner workflow owns those
decisions because it has the right project packet, task-tree rules, and domain
context.

Move reusable mechanics into `@may-agent/sdk` when they are domain-neutral:

- project-app manifest types and `defineProjectApp`
- event normalization helpers such as `eventData`, `eventString`, and
  `eventDetails`
- JSON task-tree read/write, summaries, kanban projection, assignment, and
  completion helpers
- workflow trigger-input parsing helpers

Do not move domain policy into the SDK. AKS model-gap seeding, evaluator
criteria, Scout knowledge-library rules, platform repair policy, and app
prompts stay local. App-specific event constructors also stay local unless they
are a genuinely typed, shared platform contract. The SDK should make those
workflows easier to write and check; it should not decide what the project
should do.

## App Package

Each project app should have a `package.json`. Treat it like the app's command
surface, similar to a mobile app project: code and durable state are checked in,
while `.state/` remains disposable runtime scratch.

Recommended scripts:

- `bundle` - bundle `app.ts` and workflow entrypoints to an ignored
  `.state/bundle/` folder.
- `check` - stable default gate for app integrity, syntax/bundle, typecheck,
  format check, and stable tests.
- `integrity` - validate app declarations against actual files: owner
  inference, workflow handlers, schedule events, task tree references, and
  domain workspace binding.
- `syntax` - fast bundle/parse check for app and workflow entrypoints.
- `typecheck` - app TypeScript boundary.
- `test` - stable app tests that should not depend on live UI/domain state.
- `test:ui` - broader state-sensitive UI e2e tests.
- `format` and `format:check` - app package/tooling formatting. If an existing
  app does not have a Prettier baseline, do not silently rewrite every workflow
  and UI file as part of introducing `package.json`; baseline that separately.
- `tasks:summary` or equivalent tools - read-only app inspection helpers.
- Project-specific read-only checkpoint helpers may exist when they support
  owner judgment. For example, `domain:checkpoint` can inspect dirty domain
  files, relate them to done/review/active task branches, and tell the
  owner which slices are candidates for a domain commit. It should not commit
  by itself.

`package.json` is not a replacement for `app.ts`. `app.ts` is the runtime
declaration loaded by May-agent; `package.json` is the human/CI command surface
for building and checking that declaration.

Deleting `.state/` must not lose project understanding. Durable project intent
belongs in `project.json`, task thinking in `tasks/tree.json`, and domain
knowledge/evidence in the domain workspace. Human comments may enter through
`.state/discussion.jsonl`, but durable steering decisions must be folded into
the task tree, `project.json`, app docs, or domain artifacts. If the app cannot
recover its purpose after deleting `.state/`, the data was stored in the wrong
place.

## Domain Workspace Binding

Every app declares the project it drives.

```ts
export default defineProjectApp({
  id: "aks-rp-e2e",
  owner: "aks-explorer",
  workspace: {
    kind: "git",
    repo: "git@github.com:hao1939/aks-rp-e2e.git",
    localPath: "../aks-rp-e2e",
    branch: "main",
  },
  onEvent: workflowHandlers([
    {
      name: "aks-rp-e2e-project-planner",
      enabled: true,
      accepts: [
        { type: "project.owner.requested", target: { project: "aks-rp-e2e" } },
      ],
      handler: {
        workflow: "project-planner",
        includeEvent: true,
        task: "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e",
        timeoutMs: 3600000,
      },
      context: ["projects/aks-rp-e2e.app/tasks/tree.json"],
    },
  ]),
});
```

The binding has two roles:

- `repo` and `branch` describe the expected source of the domain project.
- `localPath` tells the runtime where commands should run on this host.

The owner may be an existing global agent or an app-local agent. If `owner` is
omitted, the runtime infers it from `agents/` inside the app. Use an explicit
owner when extracting a project from an existing agent-owned workspace. For
example, `scout-knowledge-lib.app` declares `owner: "scout"` and drives
`../scout-knowledge-lib/` without creating a second Scout agent.

For a project extracted from an agent-private folder, prefer moving the domain
workspace under `projects/<name>/` and leaving a short-lived compatibility
symlink at the old agent path. The project path then becomes canonical and the
agent path remains only a migration bridge.

`onEvent` is the project app's event surface. `workflowHandlers(...)` is syntax
sugar for generated event handlers backed by workflows, and replaces
project-local `agents/*/cron.json`. The app owns which events wake which
workflows; infra owns delivery, scheduling, sessions, dedup, and workflow-run
audit.

A generated workflow handler must run the named workflow module through the
workflow runtime. It is not a raw owner-agent session with a
`source=workflow:<name>` label. The runtime adapter may append the trigger event
to the workflow task packet, but it still must create a workflow run, load
`workflows/<name>.ts`, apply guards, persist the result, and let the workflow
emit follow-up events. A handler that only starts an agent session with a
workflow-looking label bypasses app-local policy and makes capacity/session
metrics misleading.

## Event Handler Manifest

The main shape is the design: `app.ts` is a manifest. It is the readable map of
identity, workspace binding, schedules, actions, event subscriptions, and
non-derivable event-graph metadata. It is not the project brain, not a hidden
router, and not a place to encode task planning, task completion judgment,
retry policy, domain verification, or worker-result interpretation.

Keep the responsibility split explicit:

- `app.ts` declares what events exist at the app boundary.
- `schedules` produce typed events through `emits[]`.
- `actions` produce events.
- `onEvent: workflowHandlers([...])` declares which workflows consume typed
  event selectors through `accepts[]`.
- `eventGraph` documents only audit metadata that cannot be derived from the
  handler declarations.
- `workflows/*` implement behavior and emit structured result events.
- infra delivers events, starts workflow runs, enforces capacity, persists
  traces, and applies target-first routing.

In other words, `app.ts` should read primarily as an event-handler manifest:

```text
onEvent -> generated workflow handlers
actions -> typed events
schedules -> typed events
```

The normal case is declarative handler generation:

```ts
onEvent: workflowHandlers([
  {
    name: "aks-rp-e2e-project-planner",
    accepts: [
      { type: "project.owner.requested", target: { project: "aks-rp-e2e" } },
    ],
    handler: { workflow: "project-planner", ... },
  },
  {
    name: "aks-rp-e2e-task-execution-worker",
    accepts: [
      { type: "project.task.assigned", target: { project: "aks-rp-e2e" } },
    ],
    handler: { workflow: "task-worker", ... },
  },
])
```

Events at the manifest boundary use one small shape:

```ts
type AppEvent = {
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

Selectors use the same target-first idea:

```ts
type AppEventSelector =
  | "project.owner.requested"
  | {
      type: "project.task.assigned";
      target?: { project?: string; taskId?: string };
      owner?: string;
      urgency?: "low" | "normal" | "high" | "immediate";
      actions?: string[];
      metricIds?: string[];
    };
```

The runtime lowers selectors to cron's event-type subscription list, but the
manifest keeps the target visible. For compatibility during migration,
`on: ["event.type"]` means `accepts: ["event.type"]`, and schedule
`event: {...}` means `emits: [{...}]`. New app manifests should use
`accepts[]` and `emits[]`.

There is one event-handling model: an event is accepted through `onEvent`.
`workflowHandlers(...)` is a helper that returns generated event handlers whose
implementation is "run this workflow with this task/context." App code should
not also implement an imperative router for the same events.

A custom `async onEvent(ctx, event) { ... }` function is a lower-level escape
hatch for truly deterministic event translation that cannot be expressed as a
generated handler. It must stay rare, bounded, and free of planning/task/problem
judgment. If the behavior is `event A -> workflow B`, use
`onEvent: workflowHandlers([...])`.

Recommended app structure:

```text
app.ts
  identity
  workspace
  schedules with emits[]
  onEvent: workflowHandlers(...)
  eventGraph audit metadata
  actions
  no custom imperative onEvent unless small deterministic translation is genuinely needed

workflows/*
  real behavior
```

The app should also declare an `eventGraph` audit section. This is not a second
runtime router; it is the machine-readable map used by integrity checks and UI
visualization:

```ts
eventGraph: {
  externalEvents: ["message.created", "escalation.created"],
  intentionalCycles: [
    {
      id: "owner-worker-review-loop",
      events: [
        "project.owner.requested",
        "project.task.assigned",
        "project.task.completed",
      ],
      reason: "The owner is the review boundary before assigning more work.",
    },
  ],
  limits: {
    maxHandlersPerEvent: 1,
  },
}
```

This lets the app be reviewed as a state machine:

- produced events from schedules, actions, and workflows
- consumed events through generated handlers
- external events intentionally handed outside this app
- declared cycles that are expected control loops
- undeclared cycles that are likely tight loops
- conflicts such as multiple generated handlers for one event

The movement invariant is intentionally strict:

1. **Every generated handler declares the event selectors it consumes in
   `accepts`.**
2. **Every generated handler declares the event types it may emit in `emits`.**
3. **Every schedule/action output is handled by a generated handler or marked as
   an external event owned outside this app.**
4. **Every generated handler output is handled by a generated handler or marked
   as an external event owned outside this app.**

This avoids dead ends where a project appears active but no next event is
created. A handler may decide at runtime that no domain mutation is appropriate,
but it should still emit a state/event outcome such as completion, planning,
resolved, escalated, or a notification targeted outside the app. If an event
truly leaves the app, declare it in `externalEvents`.

Do not add a top-level app `events` list for generated handlers. That creates a
second place to name the same event and makes review harder. Event names such as
`escalation.resolved` or `metric.breach` are normal when they appear in a
handler's `accepts` list: they are ordinary events from outside the app that
target this project owner. They are not a separate event registry.

Do not put handler edges under `eventGraph.handlers` or
`eventGraph.adapters`. Those fields duplicate derivable information. A generated
handler's `accepts` and `emits` fields are the source of truth for event flow.

Integrity checks should fail on:

- a schedule, action, or handler producing an event nobody consumes or exports
- more than one generated handler for an event unless explicitly allowed
- a generated handler without `emits`
- an event cycle not covered by an `intentionalCycles` entry

This is how we keep the event-native design simple: events are the state-machine
edges, handlers are the state-machine actors, and `app.ts` is the readable map.
The project owner is the brain, whether the app calls the implementation
workflow `project-planner`, `owner-review`, or something domain-specific. The
app manifest must make the event loop visible enough for humans, LLMs, and
tooling to audit.

If a future change makes `app.ts` harder to review as a manifest, move that
behavior into a workflow or SDK/runtime primitive. The app manifest may create a
small local event builder for readability, but it should not hide routing,
state-machine transitions, or project judgment behind helper code.

## Convention Defaults

Project apps use convention over configuration. `app.ts` should declare
exceptions, not restate obvious ownership.

The runtime infers the project owner from the app folder:

1. If `agents/` contains exactly one local agent, that agent is the project
   owner.
2. If multiple local agents exist, `agents/owner/` wins, then
   `agents/project-owner/`.
3. If the owner is still ambiguous, app discovery fails loudly. The app should
   not add an `owner` field to work around an unclear folder shape.

Owner-based defaults:

- A workflow handler without `handler.agent` runs as the inferred project owner.
- A workflow handler without `handler.projectId` uses the app id/folder.
- A task without `owner` is owned by the inferred project owner.
- A task without a dedicated worker runs with the project owner.
- A review/verifier without an explicit assignee uses the project owner.
- A blocker/escalation without a clearly classified external owner returns to
  the project owner for judgment.
- A project-scoped event that has no generated handler and is not intentionally
  suppressed by a custom `onEvent` function is dispatched to the project owner.

Dedicated handlers are still useful for deterministic paths such as owner
wakes, assigned-task execution, native spec execution, watchdog observation,
and synchronous read-only UI actions. Unknown project events should not disappear:
they either match a handler, are intentionally ignored with a reason, or reach
the project owner.

The app should record workspace binding and the observed domain revision in
`project.json` when task decisions or evidence depend on a specific layout:

```json
{
  "domainProject": {
    "id": "aks-rp-e2e",
    "path": "../aks-rp-e2e",
    "repo": "git@github.com:hao1939/aks-rp-e2e.git",
    "branch": "main",
    "observedRevision": "dca46cc",
    "lastSyncedAt": "2026-06-09T09:30:00Z"
  }
}
```

This state is app control-plane state, not domain product state.

## Runtime Discovery

V3 discovery:

1. Scan configured app roots for `*.app/app.ts`.
2. Import each `app.ts` side-effect free.
3. Infer and validate the project owner from the app-local `agents/` folder.
4. Validate app id, workspace binding, schedules, generated handlers, event
   subscriptions, and resource limits.
5. Resolve the domain workspace path.
6. Expand convention defaults such as handler agent, handler project id, task
   owner, reviewer, and fallback event owner.
7. Register generated app event handlers and schedules.
8. Serve app UI and shared project task views.

Discovery should support legacy embedded apps during migration:

```text
V3: agents-repo/projects/aks-rp-e2e.app/app.ts
legacy: projects/aks-rp-e2e/.app/app.ts
```

If both exist for the same app id, V3 wins unless the runtime is configured to
prefer the embedded app. Duplicate active app ids should be rejected by default.

## Reload Contract

Project app runtime reload has three main surfaces:

- Workflow files in `workflows/*.ts` are resolved and imported when a
  workflow-backed handler dispatches a workflow run. Editing workflow code is
  picked up by the next dispatch.
- Project app manifests (`projects/*.app/app.ts`) declare `onEvent`,
  schedules, event selectors, and actions. The normal `onEvent` value is
  `workflowHandlers([...])`, which generates workflow-backed handlers. Manifests
  are re-installed by explicit runtime reload and by the project-app manifest
  watcher. Adding, deleting, or changing a generated handler entry, schedule,
  action, or event selector is therefore a manifest reload, not a plain handler
  hot-reload.

The manifest watcher performs a content-hash scan of discovered `*.app/app.ts`
or `*.app/app.js` files. On change, it calls the same `installProjectApps()`
path as explicit reload. Existing scheduler state is updated in place: changed
synthetic entries are replaced, removed workflow handlers and schedules are
removed, and event router descriptors are replaced without restarting the
daemon or cancelling running sessions.

The safe operator path remains `runtime.reload.requested` or the `/reload`
command. Use it when an app manifest change should take effect immediately or
when validating a broken manifest after a failed automatic reload.

## Path Helpers

App code should not use ad hoc relative paths.

```ts
ctx.appPath("tasks/tree.json"); // aks-rp-e2e.app/tasks/tree.json
ctx.workspacePath(
  "features/managedsystem-pool/specs/managedsystem-rest-add-existing.json",
);
ctx.workspaceCwd(); // aks-rp-e2e/
```

The naming should make the boundary obvious:

- `appPath` means May-agent app/control-plane files.
- `workspacePath` means domain project files.

## Event Flow

The event shape stays similar to the embedded-app iteration. The important
differences are path ownership and the execution responsibility split.

```text
human / timer / metric / UI action
  -> event
  -> aks-rp-e2e.app/app.ts
  -> intents or workflows
  -> commands run in aks-rp-e2e/
  -> domain artifacts update
  -> app task tree and UI update
  -> follow-up events
```

## Regular Focus Plans

Long-running project apps should not rely on humans repeatedly opening the
Kanban board to discover whether the project is still pointed in the right
direction. Keep the fast owner/worker loop for task execution, and add a
slower focus-plan cadence for mid-term direction.

```text
regular focus-plan proposal
  -> project.focus.plan.requested
  -> focus-plan workflow
  -> task tree focus branch + project.json currentFocus update
  -> escalation.created when approval is needed
  -> project.owner.requested

regular progress review
  -> project.focus.review.requested
  -> focus-plan workflow
  -> on-track/off-track/completed/stale judgment
  -> escalation.created when the plan needs approval or human steering
  -> project.owner.requested
```

The focus-plan workflow is not the project brain and does not execute domain
work. It wakes the project owner to review metrics, task-tree state, model
coverage, recent evidence, and blocker patterns. Durable conclusions are folded
into `tasks/tree.json` and `project.json`; `.state/focus-plan-runs.jsonl` is
only a compact scratch/audit stream.

The focus plan should be visible as a normal task-tree branch, usually
`kind: "focus_plan"`, with:

- horizon, for example the next 12-24 hours or until the branch completes
- success criteria expressed as measurable project outcomes
- approved risk envelope such as live execution parallelism or environment
  scope
- concrete child work under the existing project lanes
- latest progress review: on track, off track, completed, stale, or blocked

Approval is for direction and risk, not every leaf task. Once a focus plan is
approved, the normal owner loop should keep creating and assigning concrete work
inside that focus until the plan completes, goes stale, blocks externally, or a
later progress review proposes a material change.

For human notification, prefer the platform escalation channel:

```json
{
  "type": "escalation.created",
  "owner": "human:operator",
  "project": "aks-rp-e2e",
  "data": {
    "reason": "AKS RP E2E focus plan needs approval",
    "requestedAction": "Reply approve, adjust, or hold.",
    "dedupKey": "aks-rp-e2e:focus-plan:needs_approval",
    "resume": {
      "kind": "project-owner",
      "instruction": "Fold the human decision into tasks/tree.json and continue owner review."
    }
  }
}
```

Progress review should run more often than proposal. A typical cadence is:

- proposal: every 24 hours, or when the previous focus completes
- review: every 6 hours, or when progress metrics breach

The exact cadence is app-specific. The invariant is that each focus review
records whether the project is on track and wakes normal owner review with that
judgment.

Example:

```text
feature page "trigger test"
  -> project.test.requested
  -> aks-rp-e2e.app validates gate and spec id
  -> runs `bun run spec <spec-id> --target=staging-rest` in aks-rp-e2e/
  -> reads runs/executions/<run-id>/result.json
  -> updates app task/evidence projection
  -> emits project.test.completed
```

The domain test runner remains project-native. The app orchestrates it; it does
not replace it.

For long-running project work, the app should use two simple event loops:

```text
project.owner.requested
  -> thin owner workflow
  -> deterministic quick refill assigns clear runnable backlog leaves up to capacity
  -> project-owner event-review step with compact planning packet
  -> project-owner task-tree update step with event-review output
  -> task-tree tools / direct reviewed tree edits / explicit assignment
  -> owner workflow emits project.task.assigned for explicit assignments

project.task.assigned
  -> thin worker workflow verifies assignment attempt
  -> task-owned agent session
  -> domain work
  -> worker workflow emits project.task.completed
  -> owner workflow accepts project.task.completed and reviews the result
```

Failure/blocking uses the same event shape, but makes the problem large and
auditable instead of letting blocked tasks silently accumulate:

```text
project.task.completed with blocked/failed/error claim
  -> owner workflow accepts the task result and requests problem solving when needed
  -> problem-solver workflow investigates one stable problemKey
  -> solver fixes/verifies local runner or replay defects, or escalates with
     exact external resume conditions
  -> solver emits project.problem.resolved or project.problem.escalated
  -> owner workflow accepts the solver result
  -> owner reconciles affected task branches in tasks/tree.json
```

The problem solver is not a second owner. It may diagnose and fix local
problems, but it does not accept tasks, roll up parents, reshape branches, or
assign work. The owner creates or links the visible problem-solving task in
the tree, merges duplicate blockers by stable `problemKey`, and decides whether
affected work should retry, be marked replaced, remain blocked, or escalate to
a human/external owner.

Solver result events are evidence, not policy. If a solver emits an escalation
event but the summary clearly says a local cause was fixed and verified, the
owner should treat that as a misclassified resolved problem, record that fact on
the affected branch, and create retry work. If the summary says external input
is still required, the owner records the exact resume condition and moves to
unrelated available work.

Shared root causes should share one problem key. For example, several staging
replays blocked by missing ARM credentials should route to one problem such as
`aks-rp-e2e:staging-arm-auth-unavailable`, not one isolated blocker for each
feature. This keeps failure handling visible without flooding the tree.

`project.execution.requested` and `project.planning.requested` are legacy
terminology. `project.owner.requested` is the durable owner wake event. The
runtime may keep accepting `project.planning.requested` as a compatibility
alias, but new app code should emit `project.owner.requested`.

Human task-tree steering should use `project.owner.requested` directly. If
the user gives explicit owner context from a project UI, the UI posts the
typed event through `/api/events`. The HTTP envelope carries `type`, `source`,
`target`, and either an explicit `owner` or enough target/project context for
the runtime to infer the owner. The event payload that handlers consume lives
under `data`:

```json
{
  "type": "project.owner.requested",
  "source": "web-ui",
  "owner": "project:aks-rp-e2e",
  "target": {
    "project": "aks-rp-e2e"
  },
  "urgency": "high",
  "data": {
    "project": "aks-rp-e2e",
    "reason": "human-steering",
    "action": "task-feedback",
    "params": {
      "task_id": "project",
      "comment": "Reflect on this branch and add missing Go-test discovery work."
    }
  }
}
```

For in-process app code, the same payload may be emitted as the event object.
For HTTP ingress, do not rely on top-level `project`, `reason`, or `params`
alone; the runtime stores and dispatches the durable payload from `data`.
Explicit human steering should use `urgency: "high"` so it is not buried behind
routine watchdog/refill wakes.

During migration, owner-scoped agent events such as
`owner: "agent:aks-explorer"` may still be accepted for metrics, escalation
lifecycle events, and older clients. Treat them as compatibility input. New
project-scoped events should prefer `target: { project }` and inferred
`owner: "project:<project>"`.

Owner workflows should also query/surface recent high-priority human steering
when building the planning packet. The current trigger may be a watchdog or
completion event, but pending human steering is still owner input and should
be reviewed before routine refill decisions.

Owner workflows may use a deterministic quick-refill fast path before the
owner-agent judgment session. Quick refill only assigns backlog leaves whose
readiness projection is runnable: dependency-satisfied, non-conflicting, and
clear. It is a scheduling primitive, not an owner decision. This keeps workers
busy while preserving the owner as the brain for task-tree shape and project
judgment.

`project.comment.created` is for general discussion. `project.task.steer` is at
most a compatibility alias. Neither should be required before waking the owner.

The canonical task event contract is intentionally small:

- `project.owner.requested` is handled by the project owner workflow. It reviews,
  repairs, refills, and explicitly assigns runnable backlog leaves.
- Top-level workflows that return `ctx.blocked(...)` are persisted as
  `workflow_runs.status = "blocked"` and route back to the most specific owner
  of context. A workflow triggered by `project.task.assigned` emits blocked
  `project.task.completed` with task id, attempt id, workflow run id, blocker
  reason, and compact context; the project owner repairs the task tree.
  Project workflows without task context use `project.owner.requested` with
  `reason: "workflow-blocked"`. Non-project workflows use
  `workflow.owner.requested`, which follows the default owner route for
  `*.requested` events. Nested workflow blockers return to their parent workflow
  synchronously.
- `project.task.assigned` is handled by the worker workflow. It carries the
  owner-selected task id, attempt id, session id, and worker. The worker
  does not pick from the tree.
- `project.task.completed` is handled by the app event layer and wakes the owner.
  It should carry the final task snapshot, worker result, summary, evidence, and
  blocker/verification fields. The owner reads the completion event and
  decides how to update the tree.
- `project.problem.requested` is handled by a focused problem-solver workflow.
  It carries a stable `problemKey`, affected task ids, source task/event, summary,
  and evidence. It exists to investigate/fix blockers loudly, not to mutate the
  tree.
- `project.problem.resolved` and `project.problem.escalated` are handled by the
  app event layer and wake the owner. The owner reconciles the solver result
  into the task tree and affected task branches.
- Legacy `project.task.execution.requested` events should be translated to
  owner review, not routed directly to a worker, because assignment is an owner
  decision.

Every subscribed event should have one clear outcome: a workflow trigger, an
explicit app no-op with a reason, a follow-up event, or the convention-inferred
project-owner fallback. Silent subscribed events are a bug.

The project owner agent is the brain. The task tree is the owner's workspace and
context container; it serves the owner, it is not the controller. Workflow
code must not contain project strategy, domain judgment, replan policy, or
branch-repair decision trees. Workflow code only wakes the right session,
passes compact event context, and emits events that the owner explicitly
requested. Task-tree processing code should be tools for the LLM, not workflow
policy.

The owner workflow is sequential and serialized. It wakes the project-owner
agent in two steps during the same owner wake:

1. Event review: react to the trigger, inspect related task/context when
   needed, and produce a short current-state interpretation. This step should
   not edit the task tree or assign work. It should be bounded and prefer the
   compact packet over rediscovery.
2. Owner update: use the event review plus the latest compact task-tree
   packet to review completed task results, repair or mark bad branches
   replaced, roll up parents, create concrete next leaves, assign runnable
   backlog leaves, and classify exact blockers.

The owner workflow is also the non-final-state driver. The app should not let
`backlog`, `active`, `review`, or `blocked` become passive holding lanes. Each
owner wake should push sampled non-final tasks toward `done` or toward an exact
next wake condition:

| State     | App/project driver                                                                                                                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backlog` | Owner assigns runnable leaves. Dependency-waiting backlog is still owner-visible; stale, missing, done, or locally fixable dependencies should be repaired instead of left invisible.                                |
| `active`  | Worker completion emits `project.task.completed`; stale active attempts wake owner for requeue, fresh session, replacement, or problem-solving work.                                                                 |
| `review`  | Owner accepts, rejects, follows up, or records a precise blocker. Stale review is owner backlog and should wake owner.                                                                                               |
| `blocked` | Blocked-frontier review wakes owner to recheck resume conditions, create/link one problem task for local root causes, send/escalate external asks, unblock/retry changed work, or mark terminal dispositions `done`. |

The app mechanism is simple: signals and events wake the owner; the owner uses
task-tree tools and domain evidence to decide. Metrics, watchdogs, and schedule
ticks should not encode project strategy or mutate task meaning directly.

A project-owner pass should be bounded by capacity and clarity, not by one edit.
When domain gaps remain and runnable backlog plus active work is below the app
parallelism target, the project-owner agent should keep rolling up completed
results, creating concrete leaves, and assigning runnable backlog leaves until
available capacity is filled, or until the task tree records exact blockers
explaining why it cannot be filled. Creating one leaf is not enough if the
project is still underfilled.

The app may provide a bounded frontier-seeding tool for liveness. This is not a
second owner: it may only translate explicit, already-modeled project gaps
into a small number of concrete backlog leaves under existing durable lanes,
avoid duplicate open work, and record the seed reason in the owner journal.
Normal owner judgment runs first. The fallback is used when the owner wake
times out or leaves capacity underfilled with no assignable backlog while domain
gaps remain.

For slow verification projects, backlog depth matters even when worker capacity
is full. If all active slots are occupied by long live execution and the
backlog is empty, the app may seed non-dispatched source/spec/test-building
leaves so execution latency does not stall learning. These leaves should favor
source exploration, feature packets, spec authoring, test generation, and
model-gap preparation; they are assigned only when capacity opens.

When runnable backlog plus active work is zero and `review`, `blocked`, or
backlog work with unresolved approval/dependency context exists, the wake is a
reconciliation incident. Owner review should make durable tree decisions first:
mark verified reviews done, create retry/follow-up leaves for resolved blockers,
link unresolved blockers to one visible problem task, and assign clear leaves.
Broad rediscovery belongs in follow-up tasks, not in the same planning update
before the tree has a next action.

The owner wake should include a compact planning packet, not only raw ids.
The packet should include state counts, runnable-frontier ids, and compact
details for backlog, active, review, blocked, and done leaves: goal, outputs,
acceptance criteria, conflict scope, dependencies, blocker, session id,
readiness reasons, and relevant trace fields. The packet is the starting point;
the owner may dive deeper with task-tree/domain commands when deciding. Domain
status commands and metric context may be listed as tools or event context, but
the owner agent decides whether they matter and how they map to work.

Owner-loop health is not binary. `runnable=0, active=0, gaps>0` is a zero-work
condition and may need human escalation. `runnable=0, active>0, gaps>0` is
still underfilled capacity when the app has a higher parallelism target; it
should wake the project owner to refill concrete leaves, not wait for the
single active task to finish.

The worker workflow is parallel and narrow. It receives exactly one
owner-created assignment, verifies the attempt id against the current task,
wakes that task's primary session, and emits `project.task.completed`. Workers
must not reshape sibling branches, roll up parents, create planning/control
nodes, or mutate task-tree completion state. The app event layer maps
`project.task.completed` to the next `project.owner.requested` wake.

The task id is durable; the worker session is an attempt detail. When the owner
rejects an error review or requeues a stale active attempt, the next assignment
should use a fresh worker session id and append it to `session_history`. Reusing
a terminal/error session is not retry; it risks an immediate zero-op failure and
should be treated as a runtime defect.

Repeated stale active attempts are not progress. A watchdog should observe
missing or dead runtime attempts and wake the owner with stale-attempt evidence.
The owner decides whether to retry, repair, replace, split, or block the
task; the watchdog does not mutate the task tree or dispatch workers.

## Project Metrics

Project apps can register domain metrics through the platform metric system.
Metrics should monitor whether the task tree is producing real project motion;
they should not replace task-tree reasoning.

Use three metric classes:

- Activity counters: runnable backlog, active tasks, review tasks, done tasks,
  features extracted, specs written, replays written, live runs started.
- Impact counters: model paths passing/failing/unknown/blocked, live runs
  succeeded, evidence recorded.
- Health counters: no runnable/active work while gaps remain, runnable backlog
  starvation while gaps remain, capacity underfilled while gaps remain, stale
  active tasks, stale review tasks, stale blocked tasks, dependency-waiting
  backlog with stale or missing dependencies, repeated shared blockers, live
  execution idle despite runnable work, duplicate artifact growth.

Metric breach handling stays event-based:

```text
metrics-snapshot
  -> metric.breach
     source: runtime:metrics
     target: { project }
     owner: project:<project> (inferred or explicit)
  -> project app onEvent
  -> project.owner.requested with metric context
  -> project-owner agent reads task tree + metric context
  -> task tree repair, concrete work, or escalation
```

Only ownership-boundary blockers should notify a human. For example,
`aks-rp-e2e.task.no-work-with-gaps` is P0 because the project is active, the
knowledge model still has non-passing paths, and the task tree has no
dependency-clear runnable leaf or active worker task. Review tasks do not
suppress this metric: review is owner judgment work, so the breach should wake
the project owner to accept, reject, split, or create follow-up tasks. That
breach may also create a human-owned escalation with the metric snapshot, Kanban
link, task tree path, and domain status command so the operator can reply from
mobile when the owner cannot repair the branch. In contrast,
`runnable-starvation-with-gaps` and `capacity-underfilled-with-gaps` should
usually wake the owner only; they mean the project owner should refill the task
tree, not that a human must intervene immediately.

Routine progress metrics should be visible on dashboards and in owner context
without creating mobile noise. A metric target breach is a signal to investigate
and update task context; it is not proof that the project is blocked.

## Task Tree

The task tree belongs in the app:

```text
aks-rp-e2e.app/tasks/tree.json
```

Rationale:

- It is May-agent's current decomposition of how to drive the project.
- It includes review state, blocked review, owner lanes, assignments, and
  current project thinking.
- It should not be required for a human to run the domain project.

The task tree still represents project understanding, not workflow attempt
history. Bad or stale branches should be marked done with a replacement
resolution or archived after their replacement is clear. Runtime attempts stay
in infra history.

Task state follows the canonical five-state model from
`task-tree-engine.md`: `backlog`, `active`, `review`, `done`, and `blocked`.
Readiness is a projection over backlog leaves; it is not a persisted state.
Decomposition is structural through `children`; it is not a persisted state.
Replacement is `state: "done"` with resolution/replacement metadata; it is not
a separate lifecycle state. During migration, tools may read legacy `status`
values, but new app writes should write `state`.

Project-specific owner-review intent should usually be modeled as tasks, not as
workflow prompt rules. If a project has a measurable progress signal or a
recurring judgment loop, create a visible standing task under the relevant
durable lane. For example, `aks-rp-e2e.app` uses a standing
`knowledge-model-gap-reconciliation` task to convert non-passing knowledge model
paths into concrete execution, diagnosis, unblock, or spec-refinement leaves.
The owner prompt should only tell the project owner agent to read and act on
the task tree; the project-specific state-to-work mapping belongs in that
standing task's context and acceptance criteria.

Tasks are the context containers for project work. A task may store compact
working context inline, or reference larger task-owned context files when the
context becomes too large for `tree.json`:

```text
aks-rp-e2e.app/tasks/context/<task-id>.md
```

This is a storage optimization only. Semantically, the context still belongs to
the task.

Tasks may also store a primary session pointer. That session is the warm
working memory for the task and should be reused when the same task continues
or receives feedback:

```json
{
  "id": "spec-runner-current-frontier-review",
  "context_ref": "tasks/context/spec-runner-current-frontier-review.md",
  "session": {
    "primary": "s_123",
    "status": "warm",
    "handoff_summary": "Runner scripts need review before product verdicts."
  }
}
```

Important conclusions from the session must still be promoted into task
context, task fields, domain artifacts, or child tasks. The primary session
keeps useful implicit working memory; the task remains the auditable source of
truth.

Task leaves may reference domain files:

```json
{
  "id": "managedsystem-golden-path-gap-audit",
  "workspaceRefs": [
    "features/managedsystem-pool.yaml",
    "features/managedsystem-pool/specs/managedsystem-rest-add-existing.json",
    "features/managedsystem-pool/tests/managedsystem-rest-add-existing.test.ts"
  ]
}
```

## UI

There are two UI kinds:

- Shared May-agent project UI: Kanban, task tree, app state, workflow/session
  trace.
- Project app UI: app-specific steering surfaces that help drive the domain
  project.

For `aks-rp-e2e.app`, the app UI can still render AKS feature pages, test spec
cards, run history, and trigger-test actions. It reads domain artifacts through
the workspace binding and app/run projections through the app/runtime APIs.

Serving rule:

```text
/projects/aks-rp-e2e/ui      -> aks-rp-e2e.app/ui
/projects/aks-rp-e2e/kanban  -> shared platform projection of aks-rp-e2e.app/tasks/tree.json
```

The domain repo may also have its own static reports or generated views, but
they are not May-agent UI unless an app serves them.

## Commit And Versioning Policy

Splitting repos improves boundary clarity but creates version-coupling risk.

Rules:

- Domain changes are committed in the domain repo.
- App/control-plane changes are committed in the agents/platform repo.
- App tasks that depend on a domain layout should record the domain revision
  they observed.
- When an app change requires a domain runner/spec change, land the domain
  change first, then update the app to require or expect that revision.
- The app should fail clearly when the workspace is missing, dirty when a clean
  checkout is required, or older than the minimum supported domain revision.

The runtime should expose current workspace revision in app context:

```ts
const workspace = await ctx.workspaceStatus();
// { path, branch, revision, dirty, remote }
```

## Safety And Gates

Mutation gates live in the app and runtime, not in the domain project alone.

The domain runner can require explicit flags such as `--target=staging-rest`.
The app additionally decides whether a requested mutation is allowed now:

- budget gate;
- concurrency gate;
- Azure/staging gate;
- human approval gate;
- workspace clean/dirty gate;
- task-tree conflict scope gate.

The app must not hide mutation behind discussion entries or implicit retries.
Human/UI requests become explicit events, and the app records the request,
decision, command, result, and follow-up.

## Migration From Embedded Apps

Current embedded layout:

```text
aks-rp-e2e/
  .app/
  features/
  runner/
```

Target V3 layout:

```text
aks-rp-e2e/
  features/
  runner/

agents-repo/projects/aks-rp-e2e.app/
  app.ts
  tasks/
  workflows/
  agents/
  ui/
```

Migration steps:

1. Add V3 runtime discovery for `*.app/app.ts` while keeping legacy embedded discovery.
2. Create `aks-rp-e2e.app/` in the agents/platform repo.
3. Move `.app/app.ts`, `.app/project.json`, `.app/tasks/`, `.app/workflows/`,
   `.app/agents/`, `.app/ui/`, and app JSONL streams into `aks-rp-e2e.app/`.
4. Add `workspace` binding to `aks-rp-e2e.app/app.ts`.
5. Update path helpers and workflow code from `.app` relative paths to
   `ctx.appPath(...)` and `ctx.workspacePath(...)`.
6. Update platform UI routing to serve `aks-rp-e2e.app/ui`.
7. Remove root symlinks such as `ui -> .app/ui` from the domain repo once the
   app UI is served from the app repo.
8. Remove `.app/` from the domain repo after V3 app parity is verified.
9. Keep the domain README focused on domain commands and remove May-agent
   runtime boundary language.

## Compatibility Rules

- Legacy embedded apps remain runtime-compatible only. Do not use them for new
  or migrated project-app work.
- V3 sibling apps are preferred for portable domain projects and reusable
  May-agent operation.
- A simple project without app behavior can remain a plain project folder.
- The runtime should never require a domain repo to contain `.app/`.

## aks-rp-e2e Target

`aks-rp-e2e` should become a pure AKS RP learning and E2E test project:

```text
source anchor -> feature -> spec -> suite -> replay -> run -> model update
```

It owns:

- capability model;
- feature packets;
- test specs;
- suites;
- replay scripts;
- repo-native runner;
- generated runs and durable evidence;
- domain design docs.

`aks-rp-e2e.app` owns:

- project task tree;
- feature-learning loop workflow;
- owner-review/worker/blocker workflows;
- app-local agents;
- May-agent UI integration;
- trigger-test event handling;
- progress projections for humans;
- gates and scheduling.

This gives the intended boundary:

```text
aks-rp-e2e is portable and runnable without May-agent.
aks-rp-e2e.app is how May-agent drives aks-rp-e2e.
```

## Open Questions

- Should `*.app/` folders live under `agents-repo/projects/`, `agents-repo/apps/`,
  or another top-level folder?
- Should app ids be derived from folder names or required in `app.ts` and only
  validated against folder names?
- How should the runtime mount remote domain workspaces in containers?
- What is the minimum workspace status check before an app can run mutation?

## Proposal: Owner Checkpoint Step (2026-06-14)

### Problem

Agents write files but never commit. 69 uncommitted files accumulated across
the agents repo in a single day:

| Area                 | Files | Owner                                       |
| -------------------- | ----- | ------------------------------------------- |
| agents/may/handlers  | 9     | may (code changes to handlers, tests)       |
| aks-rp-e2e.app       | 28    | aks-explorer (workflows, scripts, tree, UI) |
| shared/lib/task-tree | 3     | may/dev (engine improvements)               |
| scout-knowledge-lib  | 5+    | scout (knowledge updates)                   |
| evaluation.app/tasks | 1     | evaluator (tree updates)                    |
| may-agent.app        | 5     | may (design docs, app config)               |

The design says "domain commits are owner checkpoints" (§Core Boundary) and
the owner "commits a coherent done slice when safe." But no workflow actually
executes this step. Workers produce files, the owner reviews and rolls up task
state, and nobody commits. A human eventually notices and commits everything
in bulk — losing the per-task attribution and purpose tracking.

The `domain-checkpoint` script in `aks-rp-e2e.app/scripts/` already exists as
a read-only tool that classifies dirty files into hold/candidate/needs-review.
But it is never called automatically.

### Design: Checkpoint As Owner Workflow Step

The checkpoint is not a new workflow or a separate schedule. It is a step inside
the existing owner workflow — the same pass that reviews completions, rolls up
parents, and assigns work. After task-tree updates, the owner inspects dirty
files and commits coherent slices.

```text
project.owner.requested
  → owner workflow
  → step 1: event review
  → step 2: task-tree update (review completions, assign work)
  → step 3: checkpoint — inspect dirty files, commit done slices
```

The checkpoint step is lightweight:

1. **Scan**: `git status` in the app dir and domain workspace.
2. **Classify**: map dirty files to task-tree nodes by outputs/inputs refs.
   Files belonging to done tasks are commit candidates. Files belonging to
   active/review tasks are held. Unrelated files need owner judgment.
3. **Commit candidates**: group by task or purpose, commit with a message that
   references the task id and goal.
4. **Skip when nothing is ready**: if all dirty files belong to active work,
   the checkpoint is a no-op. Don't force commits on in-progress work.

### What The Owner Decides

The owner is the brain. The checkpoint step gives it the data; the owner
decides:

- Which candidate slices to commit now vs hold for more work.
- Whether an unclassified file is noise (revert), belongs to a task (commit
  with that task), or needs a new task.
- The commit message — should reflect the purpose, not "commit dirty files."
- Whether to commit app changes and domain changes together or separately
  (different repos may require separate commits).

### Scope Per App

Each app checkpoints its own scope:

| App                     | Checkpoint scope                                                      |
| ----------------------- | --------------------------------------------------------------------- |
| aks-rp-e2e.app          | `projects/aks-rp-e2e.app/` + domain workspace                         |
| evaluation.app          | `projects/evaluation.app/`                                            |
| scout-knowledge-lib.app | `projects/scout-knowledge-lib.app/` + `projects/scout-knowledge-lib/` |
| may-agent.app           | `projects/may-agent.app/` + `agents/may/` + `shared/`                 |

The agents repo is shared — multiple apps commit to it. The checkpoint must
scope its `git add` to the app's own files, never `git add -A`.

### Cadence

The checkpoint fires as part of the owner wake, not on a separate schedule.
Every owner pass that completes task reviews should end with a checkpoint
check. If no tasks were completed and no files are dirty, the step is instant.

For high-throughput apps (aks-rp-e2e does 50 sessions/hour), the checkpoint
should batch — don't commit after every single task completion. Check every
N owner wakes or when done-task file count exceeds a threshold.

### What This Is Not

- **Not auto-commit**: the owner reviews and decides. No blind `git add -A`.
- **Not a guard**: the finish guard already blocks sessions with uncommitted
  changes. The checkpoint prevents that guard from firing by committing
  reviewed work proactively.
- **Not a new workflow**: it's a step in the existing owner workflow. No new
  schedule, no new event type.
- **Not cross-app**: each app commits its own scope. If `shared/` is dirty,
  the app that owns the change (usually may-agent.app) commits it.

### Implementation Path

1. **aks-rp-e2e.app first** — already has `domain-checkpoint.ts`. Wire it
   into the project-planner workflow as a post-review step. Test with real
   dirty files from aks-explorer sessions.
2. **Extract to SDK** — once the pattern works, move the classify + commit
   logic to `@may-agent/sdk` as a reusable checkpoint helper.
3. **Other apps adopt** — evaluation.app, scout-knowledge-lib.app,
   may-agent.app add the same step to their owner workflows.

### Existing Infrastructure

- `aks-rp-e2e.app/scripts/domain-checkpoint.ts` — classifies dirty files
  into hold/candidate/needs-review using task-tree output refs. Read-only
  today; needs a commit-candidate execution path.
- `finish() blocked [uncommitted changes]` guard — already fires when agents
  try to finish with dirty files. The checkpoint prevents this by committing
  proactively.
- `evaluator.finish-blocked-uncommitted-count-24h` metric — tracks how
  often the guard fires. Should trend toward zero after checkpoint adoption.
- Should app UI routes use the app id, the domain project id, or both when one
  domain project has multiple apps?
