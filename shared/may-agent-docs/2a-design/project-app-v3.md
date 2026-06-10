# Project App V3

## Status

Proposal. This does not replace `project-app-v2.md` yet.

V2 proved the control-plane split by putting May-agent runtime files under an
embedded `.app/` folder. V3 strengthens that split by moving the app out of the
domain project entirely.

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

- Removing support for V2 embedded `projects/<name>/.app/`.
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

## Repository Ownership

Recommended ownership:

```text
aks-rp-e2e repo
  README.md
  features/
  specs/
  suites/
  replays/
  runner/
  model/
  evidence/
  reports/
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
  handlers/              # app.ts helper modules
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
helpers, and task-tree inspection. May-agent infrastructure owns durable event,
session, workflow, and intent history. The app may keep compact JSONL traces in
`.state/` only when they help the app reason during local operation.

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
  workspace: {
    kind: "git",
    repo: "git@github.com:hao1939/aks-rp-e2e.git",
    localPath: "../aks-rp-e2e",
    branch: "main",
  },
  workflowHandlers: [
    {
      name: "aks-rp-e2e-project-planner",
      enabled: true,
      on: ["project.planning.requested"],
      handler: {
        workflow: "project-planner",
        includeEvent: true,
        task: "app: /app/projects/aks-rp-e2e.app\nproject: /app/projects/aks-rp-e2e",
        timeoutMs: 3600000,
      },
      context: ["projects/aks-rp-e2e.app/tasks/tree.json"],
    },
  ],
  async onEvent(ctx, event) {
    // App-owned event behavior.
  },
});
```

The binding has two roles:

- `repo` and `branch` describe the expected source of the domain project.
- `localPath` tells the runtime where commands should run on this host.

`workflowHandlers` replaces project-local `agents/*/cron.json`. The app owns
which events wake which workflows; infra owns delivery, scheduling, sessions,
dedup, and workflow-run audit.

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
- A project-scoped event that has no matching workflow handler and is not
  intentionally suppressed by `app.onEvent` is dispatched to the project owner.

Dedicated handlers are still useful for deterministic paths such as planner
wakes, ready-task pickup, native spec execution, watchdog recovery, and
synchronous read-only UI actions. Unknown project events should not disappear:
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
4. Validate app id, workspace binding, schedules, workflow handlers, event
   subscriptions, and resource limits.
5. Resolve the domain workspace path.
6. Expand convention defaults such as handler agent, handler project id, task
   owner, reviewer, and fallback event owner.
7. Register app event handlers, workflow handlers, and schedules.
8. Serve app UI and shared project task views.

Discovery should support V2 during migration:

```text
V3: agents-repo/projects/aks-rp-e2e.app/app.ts
V2: projects/aks-rp-e2e/.app/app.ts
```

If both exist for the same app id, V3 wins unless the runtime is configured to
prefer the embedded app. Duplicate active app ids should be rejected by default.

## Path Helpers

App code should not use ad hoc relative paths.

```ts
ctx.appPath("tasks/tree.json");          // aks-rp-e2e.app/tasks/tree.json
ctx.workspacePath("specs/index.json");   // aks-rp-e2e/specs/index.json
ctx.workspaceCwd();                      // aks-rp-e2e/
```

The naming should make the boundary obvious:

- `appPath` means May-agent app/control-plane files.
- `workspacePath` means domain project files.

## Event Flow

The event shape stays the same as V2. The only difference is path ownership.

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

## Task Tree

The task tree belongs in the app:

```text
aks-rp-e2e.app/tasks/tree.json
```

Rationale:

- It is May-agent's current decomposition of how to drive the project.
- It includes leases, review state, blocked review, planner lanes, and workflow
  coordination.
- It should not be required for a human to run the domain project.

The task tree still represents project understanding, not workflow attempt
history. Bad or stale branches should be superseded. Runtime attempts stay in
infra history.

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
    "specs/managedsystem-rest-add-existing.json",
    "replays/managedsystem-rest-add-existing.ts"
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

## Migration From V2

Current V2:

```text
aks-rp-e2e/
  .app/
  features/
  specs/
  replays/
  runner/
```

Target V3:

```text
aks-rp-e2e/
  features/
  specs/
  replays/
  runner/

agents-repo/projects/aks-rp-e2e.app/
  app.ts
  tasks/
  workflows/
  agents/
  ui/
```

Migration steps:

1. Add V3 runtime discovery for `*.app/app.ts` while keeping V2 discovery.
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

- V2 embedded apps remain valid for projects that want app and domain changes
  committed together.
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
- planning/review/blocker workflows;
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
- Should app UI routes use the app id, the domain project id, or both when one
  domain project has multiple apps?
