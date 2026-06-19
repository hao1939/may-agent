# aks-rp-e2e.app

This is the May-agent project app for the portable `aks-rp-e2e` domain
workspace.

The boundary is:

```text
aks-rp-e2e/      # domain repo: features, specs, suites, replays, runner, model
aks-rp-e2e.app/  # May-agent app: tasks, workflows, agents, UI, steering
```

`aks-rp-e2e` must remain cloneable and runnable without May-agent. This app is
how May-agent drives that project through events, workflows, task-tree state,
and UI integration.

## Workspace Binding

The app declaration in `app.ts` points at the sibling domain repo:

```text
../aks-rp-e2e
```

App code should treat paths intentionally:

- app/control-plane files: `app.ts`, `project.json`, `package.json`,
  `tsconfig.json`, `tasks/tree.json`, `workflows/`, `agents/`, `ui/`,
  `scripts/`, and `e2e/`;
- app runtime scratch files: `.state/journal.jsonl`,
  `.state/planner-runs.jsonl`, `.state/discussion.jsonl`, `.state/tmp/`,
  and `.state/cache/`;
- domain workspace files: `../aks-rp-e2e/features/`,
  `../aks-rp-e2e/specs/`, `../aks-rp-e2e/replays/`,
  `../aks-rp-e2e/runner/`, `../aks-rp-e2e/model/`.

## Runtime Files

- `app.ts` - Project app declaration, schedules, actions, and event behavior.
- `package.json` - app-local command surface for bundle, check, test, format,
  and inspection tools.
- `tsconfig.json` - TypeScript check boundary for the app.
- `project.json` - readable May-agent operating state for this app.
- `tasks/tree.json` - current project execution decomposition.
- `agents/` - app-local agent definitions and triggers.
- `workflows/` - project-specific workflow implementation.
- `scripts/` - app package tooling only, such as integrity checks and task-tree
  inspection. Domain runner logic still belongs in `../aks-rp-e2e`.
- `types/` - small app-local ambient declarations needed by app checks.
- `ui/` - project-specific May-agent UI assets.
- `e2e/` - cross-surface app/UI tests.
- `.state/` - ignored app sandbox for runtime scratch, including
  `discussion.jsonl`, `journal.jsonl`, `planner-runs.jsonl`, temporary files,
  and caches.
- `archive/` - retired app-control files kept for reference only; code here is
  not bundled, typechecked, or used as an active workflow.

May-agent infrastructure owns durable event, session, workflow, and intent
history. This app does not keep a parallel `events/` or `runs/` directory.
This app also does not own a `runner/` directory or domain test scripts;
runnable test logic belongs to the portable domain project.

The project owner is inferred by convention from the app-local `agents/`
folder. Because this app has a single local agent, `agents/aks-explorer/`,
workflow handlers and tasks do not need to repeat `aks-explorer` as their
default owner/agent.

The active execution model is deliberately small:

- The project owner workflow handles `project.owner.requested`.
  It sends the owner a compact planning packet, runs event review, then runs
  the task-tree update/assignment step.
- `focus-plan` handles `project.focus.plan.requested` and
  `project.focus.review.requested`.
  It runs the slower mid-term planning cadence: propose or refresh the current
  focus branch, review progress every six hours, and emit a human escalation
  when direction/risk needs approval or the focus is off track.
- `task-worker` handles `project.task.assigned`.
- `project-execution-watchdog` observes task/session liveness and wakes the
  project owner when review is needed.
- App-level `onEvent` handles audit/wake events such as `task.started`,
  legacy task execution requests, and `project.task.completed`.

Deleting `.state/` must not lose the project goal, task decomposition, feature
knowledge, specs, replay scripts, evidence, or durable steering decisions. If
an app needs those facts to reason correctly, they belong in checked-in
app/domain files, not `.state/`.

## App Commands

Run app-local commands from this directory:

```sh
bun run check
```

The default check verifies app integrity, bundles app/workflow entrypoints as a
syntax gate, typechecks the app, checks package/tooling formatting, and runs the
stable workflow/replanning test set.

Useful commands:

- `bun run bundle` - bundle `app.ts` and workflow entrypoints into
  `.state/bundle/`.
- `bun run integrity` - validate app config against actual workflows, agents,
  task tree, and domain runner presence.
- `bun run typecheck` - run `tsc` for the app boundary.
- `bun run test` - run stable workflow and replanning tests.
- `bun run test:ui` - run state-sensitive UI e2e tests.
- `bun run tasks:summary` - print task-tree counts and roots.

## Focus Plan Cadence

The normal planner/worker loop keeps concrete leaves moving. The focus-plan
cadence keeps the project pointed at a reviewable mid-term direction so the
human owner does not need to poll status and steer repeatedly.

- Daily `project.focus.plan.requested` proposes or refreshes the next 12-24h
  focus.
- Six-hour `project.focus.review.requested` reviews whether the current focus
  is on track, off track, completed, stale, or blocked.
- The durable focus state belongs in `tasks/tree.json` as a visible
  `focus_plan` branch. `project.json.currentFocus` is only a compact summary of
  that branch, not an independent live status authority.
- If approval or steering is needed, the workflow emits `escalation.created`
  for `human:operator`; the normal planner then folds the reply into the task
  tree and continues assigning work.

### Live status authority order

Per the accepted stale-surface scan in
`../aks-rp-e2e/evidence/archive/planner-status-surface-live-frontier-preference-scan-20260619.md`,
app-facing planner/status consumers must read current project state in this
order:

1. `tasks/tree.json` live frontier and counts.
2. Live derived metrics regenerated from current task/spec/model surfaces.
3. `project.json.currentState` and `project.json.currentFocus` only as compact
   summaries/provenance.
4. Historical root-task ceiling/steady-state context in `tasks/tree.json` only
   as provenance after reopen events, never as present-tense closure proof.

If these surfaces disagree, prefer the live task-tree frontier and derived
metrics. Do not treat `project.json` summaries or root ceiling-era context as
authoritative signals that the project is completed, at ceiling, or safe to
stop reviewing.

Manual actions exposed by `app.ts`:

- `request-focus-plan` - ask for a new or refreshed focus proposal.
- `review-focus-progress` - ask for an immediate progress review.

## Runtime Reload

The app has separate reload surfaces:

- Editing `workflows/*.ts` is picked up on the next workflow dispatch.
- Editing an existing named platform handler is picked up on that handler's next
  fire.
- Editing `app.ts` changes schedules, `workflowHandlers`, actions, event
  selectors, and `onEvent`. The platform re-installs project app manifests via
  the project-app manifest watcher; `/reload` or `runtime.reload.requested` is
  the immediate operator path.

To add or update a project workflow handler, add or edit the workflow file under
`workflows/`, update the `workflowHandlers` entry in `app.ts`, then let the
watcher reload it or issue `/reload`. Existing running sessions are not
cancelled by this reload; new triggers use the updated manifest.

## Domain Execution

The app drives the domain runner instead of replacing it. For example, a
feature-page test request should become an event handled by this app, and the
app should invoke a command in `../aks-rp-e2e` such as:

```sh
bun run spec <spec-id> --target=staging-rest --surface=REST --host=devbox
```

The domain runner writes run artifacts under `../aks-rp-e2e/runs/` and durable
evidence under `../aks-rp-e2e/evidence/`.

## Tests

Workflow unit tests live beside workflow code in `workflows/*.test.ts`.
Cross-surface UI/app tests live in `e2e/`. Domain runner, replay, and spec tests
belong in `../aks-rp-e2e`.
