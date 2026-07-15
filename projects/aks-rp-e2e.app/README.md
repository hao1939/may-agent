# aks-rp-e2e.app

This is the May-agent project app for the portable `aks-rp-e2e` domain
workspace.

The boundary is:

```text
aks-rp-e2e/      # domain repo: features, specs, scenario tests, runner, model
aks-rp-e2e.app/  # May-agent app: tasks, workflows, agents, UI, steering
```

`aks-rp-e2e` must remain cloneable and runnable without May-agent. This app is
how May-agent drives that project through events, workflows, task-tree state,
and UI integration.

## Knowledge Layers

The project has two kinds of knowledge:

- AKS knowledge model: source-backed feature behavior, API/design/doc claims,
  generated test intent, specs, scenario behavior, compact plans,
  resource/state DAGs, live test results, and known gaps. Ground truth comes
  from authorized docs, design docs, API specs, and approved product contracts;
  `../aks-rp-e2e` is executable workspace and evidence, not ground truth by
  itself. The app owns the model so it can generate, verify, compact, and
  investigate AKS tests.
- Project operating knowledge: task breakdown, workflow routing, loop ledgers,
  review/stall handling, retries, exact waits, and planner decisions. Durable
  project operating knowledge belongs in this app.

The bridge is a normal task workflow:

```text
task -> workflow -> domain command/artifact -> workflowResult
     -> project.task.completed -> task-reviewer -> project-planner
```

Workflow code collects facts and writes scoped artifacts. The agent/reviewer
judges whether the result satisfies the goal. The planner owns task-tree
mutation. See `design/project-knowledge-layers.md` for the full picture.

The project-control contract has two nested loops:

```text
work:     goal gap -> plan -> execute -> review -> evidence/model -> next gap
feedback: abnormal -> diagnose -> repair -> verify -> restored work
```

Feedback activity is not domain progress by itself. It succeeds only when it
restores affected work or reaches an evidence-backed terminal disposition. A
blocked-only frontier remains an active recovery incident. See
`design/two-loop-operating-model.md`.

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
  `../aks-rp-e2e/runner/`, `../aks-rp-e2e/model/`,
  `../aks-rp-e2e/runs/test-results/`.

## Runtime Files

- `app.ts` - Project app declaration, schedules, generated event handlers, and
  operator actions.
- `package.json` - app-local command surface for bundle, check, test, format,
  and inspection tools.
- `tsconfig.json` - TypeScript check boundary for the app.
- `project.json` - readable May-agent operating state for this app.
- `.state/tasks/tree.json` - current runtime task-tree authority for project execution decomposition.
- `tasks/tree.json` - legacy bootstrap snapshot path; not the live task-tree authority once `.state/tasks/tree.json` exists.
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
- `design/` - active app-control design proposals and review notes.

May-agent infrastructure owns durable event, session, workflow, and intent
history. This app does not keep a parallel `events/` or `runs/` directory.
This app also does not own a `runner/` directory or domain test scripts;
runnable test logic belongs to the portable domain project.

The project is the owner for project-scoped events. Event handlers normally use
`target: { project: "aks-rp-e2e" }`; the runtime should infer
`owner: "project:aks-rp-e2e"` and then delegate execution to the app-local
project-owner agent. Because this app has a single local agent,
`agents/aks-explorer/`, workflow handlers and tasks do not need to repeat
`aks-explorer` as their default executor.

The event envelope terms are:

- `source`: who emitted the event, such as `agent:aks-explorer` or
  `runtime:metrics`.
- `target`: the concrete subject and first delivery point, such as
  `{ project, taskId }`.
- `owner`: who is accountable when the target does not handle it, normally
  `project:aks-rp-e2e` for project events.

Anything with a durable identity and responsibility boundary can be an owner:
project, human, agent, or a long-lived controller task. A workflow or event
handler is normally just implementation; it should not become the owner unless
it also owns durable state, authority, and a close/escalate rule. A task id in
`target` is not automatically a task owner; most tasks are targets that roll up
to the project owner.

Task-targeted events start at the concrete task and roll up by containment:
`{ project, taskId }` is first available to exact task handlers, then loop or
parent-task handlers, then the project owner. A project selector still matches
task-targeted events for the same project, but a task selector only matches that
task.

The active execution model is deliberately small. See
`design/project-app-event-contract.md` for the canonical event names.

- The project planning workflow handles `project.owner.requested`.
  It sends the owner a compact planning packet, runs event review, then runs
  the task-tree update/assignment step.
  Its detailed contract is in `design/project-planner-contract.md`: workflow
  code orchestrates owner review and assignment, while deterministic branches
  use structured event/task fields instead of parsing prose.
- `focus-plan` handles `project.focus.review.requested`; `data.mode` selects
  `plan` or `progress`.
  It runs the slower mid-term planning cadence: propose or refresh the current
  focus branch, review progress every six hours, and emit a human-targeted
  message when direction/risk needs approval or the focus is off track.
- `task-worker` handles `project.task.assigned`.
- `project-execution-watchdog` observes task/session liveness and wakes the
  project owner when review is needed.
- `app.ts` uses `workflowHandlers: [...]` as its declarative workflow event
  surface.
- Each handler declares the event selectors it consumes in `accepts` and the
  event types it may produce in `emits`. There is no top-level `events` list for
  generated handlers.
- `eventGraph` is audit metadata only: external event outputs, intentional
  cycles, and limits. It must not duplicate handler routing.

Task completion is not accepted work. The contract is:

1. The planner assigns a concrete task.
2. The worker or task-specific workflow handles that task and emits a structured
   `project.task.completed` envelope when its attempt ends.
3. The worker or workflow emits any explicit target follow-up, such as a loop
   tick for a known loop parent.
4. The owner/review step judges the result and requests
   `project.problem.investigation.requested` only when focused problem solving
   is actually needed.

App routing does not inspect task state, build completion envelopes, or compare
free-form summary text. Worker summaries are review material, not control-flow
protocol.

`app.ts` actions are operator/API shortcuts that emit ordinary target events.
They should stay small and should not become domain planners, spec indexers, or
test runners. If an action needs project-specific judgment, it should emit an
event for a workflow.

Deleting `.state/` must not lose the project goal, task decomposition, feature
knowledge, specs, scenario tests, test results, or durable steering decisions.
If an app needs those facts to reason correctly, they belong in checked-in
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
- `bun run health` - print the read-only project health report.
- `bun run tasks:summary` - print task-tree counts and roots.

## Focus Plan Cadence

The normal planner/worker loop keeps concrete leaves moving. The focus-plan
cadence keeps the project pointed at a reviewable mid-term direction so the
human owner does not need to poll status and steer repeatedly.

- Daily `project.focus.review.requested` with `data.mode=plan` proposes or
  refreshes the next 12-24h focus.
- Six-hour `project.focus.review.requested` with `data.mode=progress` reviews
  whether the current focus is on track, off track, completed, stale, or
  blocked.
- The durable focus state belongs in `tasks/tree.json` as a visible
  `focus_plan` branch. `project.json.currentFocus` is only a compact summary of
  that branch, not an independent live status authority.
- If approval or steering is needed, the workflow emits a human-targeted
  `message.created` record. Runtime or SDK escalation paths may still emit
  `escalation.created` for confirmed ownership-boundary blockers, but that is
  not the normal focus-plan approval output. The normal planner folds replies
  into the task tree and continues assigning work.

### Live status authority order

App-facing planner/status consumers must read current project state in this
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

Use `bun run health` for the canonical operator readout. It joins the live task
tree, assignment queue, journal, planner/reviewer traces, and durable loop
progress into one status: `complete`, `moving`, `recovering`, `attention`, or
`stalled`. Ops-only activity is `recovering`; it becomes `moving` only when
domain work resumes or a domain outcome is accepted.
`bun run health --json` exposes the same facts as structured data for metrics,
workflow triage, or UI surfaces.

Manual actions exposed by `app.ts`:

- `request-focus-plan` - ask for a new or refreshed focus proposal.
- `review-focus-progress` - ask for an immediate progress review.
- `pulse-spec-loop` - wake the long-lived spec verification controller task.
- `pulse-feature-reference-loop` - wake the official feature-reference loop.
- `pulse-feature-compact-loop` - wake the feature compact-package loop.

Spec-loop operator commands:

- `bun run spec-loop status` - inspect loop task/state and dev-infra-core
  priority coverage.
- `bun run spec-loop seed` - create the long-lived loop task if it is missing.

## Active Design Proposals

- `design/project-knowledge-layers.md` - overview of the AKS knowledge model
  versus project operating knowledge and how workflows bridge them.
- `design/project-observability.md` - read-only project health contract for
  understanding whether the app is moving and what needs inspection.
- `design/spec-verification-loop.md` - proposal for a task-workflow-routed
  single-spec verification loop over the AKS RP E2E spec set.
- `design/reusable-task-workflows.md` - design for reusable task workflows,
  optional workflow input/output contracts, and structured workflow results.

## Runtime Reload

The app has separate reload surfaces:

- Editing `workflows/*.ts` is picked up on the next workflow dispatch.
- Editing an existing named May-agent handler is picked up on that handler's
  next fire.
- Editing `app.ts` changes schedules, `onEvent` generated handlers, actions,
  and event selectors. The platform re-installs project app manifests via the
  project-app manifest watcher; `/reload` or `runtime.reload.requested` is the
  immediate operator path.

Shared-workflow caveat: when a workflow entrypoint imports helper code from
another workflow file, a helper-only edit may not replace the already-loaded
entrypoint module in a long-running runtime immediately. In this app,
`task-worker.ts` imports `default-task-worker.ts`, so changes to
`default-task-worker.ts` or other shared helper modules should be followed by an
explicit `/reload` (or another manifest-refresh action) before using retries as
verification evidence. Otherwise a retry can still run the old code path and
repeat stale fallback summaries such as `Agent ended with an empty assistant turn`.

To add or update a project workflow handler, add or edit the workflow file under
`workflows/`, update the `workflowHandlers: [...]` entry in `app.ts`,
then let the watcher reload it or issue `/reload`. Existing running sessions are
not cancelled by this reload; new triggers use the updated manifest.

## Domain Execution

The app drives the domain runner instead of replacing it. For example, a
feature-page test request should become an event handled by this app, and the
app should invoke a command in `../aks-rp-e2e` such as:

```sh
bun run spec <spec-id> --target=staging-rest --surface=REST --host=devbox
```

The domain runner writes test results under `../aks-rp-e2e/runs/test-results/`
and durable reviewed knowledge under checked-in feature/model files.

## Tests

Workflow unit tests live beside workflow code in `workflows/*.test.ts`.
Cross-surface UI/app tests live in `e2e/`. Domain runner and scenario/spec tests
belong in `../aks-rp-e2e`.
