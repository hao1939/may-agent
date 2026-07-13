# Design: Separate Source Files From Runtime State

Status: implemented for task tree/readout runtime paths; snapshot/restore is
still future operational hardening.

## Plain Goal

Stop committing files that only say what the project is doing right now.

Git should answer: "What is this project app, and how should it run?"

`.state/` should answer: "What is happening right now?"

This is not just repo cleanup. It prevents stale workers, external CI runs, and
review sessions from treating old runtime snapshots as source truth.

## Current Project Audit

The current apps are not identical, so the migration must be centralized in the
SDK instead of patched app by app.

Implementation note, 2026-07-06:

- The SDK owns runtime paths through `projectRuntimePaths()`,
  `resolveTaskTreePath()`, `loadProjectReadModel()`, and
  `saveProjectRuntimeState()`.
- Live task trees now resolve to `.state/tasks/tree.json`.
- Derived kanban snapshots now write to `.state/tasks/kanban.json`.
- Runtime project readout now writes to `.state/project-state.json`.
- `tasks/seed.json` exists as the git-tracked boot skeleton for project apps.
- Legacy `tasks/tree.json` and `tasks/kanban.json` are ignored and removed from
  git tracking for all current project apps.

| App                       | Source state in git                                                                    | Runtime state in `.state/`                                                                                 | Notes                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `aks-rp-e2e.app`          | `tasks/seed.json`, `tasks/README.md`, curated task archive docs, static `project.json` | `.state/tasks/tree.json`, `.state/tasks/kanban.json`, `.state/tasks/archive/`, `.state/project-state.json` | Main validation target. App-local scripts, workflows, metrics, and private kanban UI use the SDK runtime path contract. |
| `may-agent.app`           | `tasks/seed.json`, static `project.json`                                               | `.state/tasks/tree.json`, `.state/project-state.json`, app runtime journals/packets                        | Shared app UI and loader use the SDK runtime path contract.                                                             |
| `evaluation.app`          | `tasks/seed.json`, `tasks/README.md`, static `project.json`                            | `.state/tasks/tree.json`, `.state/project-state.json`                                                      | Uses the same boot and read-model contract as the larger apps.                                                          |
| `scout-knowledge-lib.app` | `tasks/seed.json`, `tasks/README.md`, static `project.json`                            | `.state/tasks/tree.json`, `.state/project-state.json`, app runtime packets                                 | Uses the same boot and read-model contract as the larger apps.                                                          |

Implementation seams that moved together:

- `packages/sdk/src/project-task-tree.ts` resolves the live task tree through
  the SDK runtime path helper.
- `packages/sdk/src/project-task-tree-store.ts` reads and writes the resolved
  runtime tree path and keeps the shrinkage guard.
- `may-agent/src/app/http/server.ts` serves project task state through the SDK
  resolver instead of directly reading `tasks/tree.json`.
- `aks-rp-e2e.app/scripts/project-metrics.ts`, `scripts/check-integrity.ts`,
  `scripts/domain-checkpoint.ts`, and `workflows/project-execution-watchdog.ts`
  read app-local task state through the SDK runtime path contract.
- `aks-rp-e2e.app/workflows/lib/project-readout-sync.ts` writes runtime readout
  fields to `.state/project-state.json`.
- `aks-rp-e2e.app/tasks/archive/*.json` is already mostly ignored, but generated
  task archives are still conceptually runtime. Curated docs or feature-standard
  artifacts under `tasks/archive/` may remain source files.

The design therefore has one shared resolver for all readers and writers, not a
separate compatibility branch per app.

## Problem

1. `tasks/tree.json` changes whenever the planner, durable loops, workers,
   reviewers, watchdog, or recovery flows update task state.
2. `tasks/kanban.json` is a derived view regenerated from the tree.
3. `project.json` mixes static config with runtime readout fields such as
   `currentState`, `currentFocus`, `focusPlan`, `taskIndex`, and `updatedAt`.
4. Git history is dominated by state churn like "publish latest project state"
   and task-tree pruning commits.
5. Review sessions waste attention deciding whether runtime changes should be
   committed.
6. Fresh workers and pipeline runs can accidentally start from stale committed
   state instead of the live local runtime state.

## Principle

Git tracks structure. `.state/` tracks runtime.

```
Git, reviewed by humans:
  app.ts                 project app wiring: handlers, schedules, budget
  project.json           static project metadata and policy
  tasks/seed.json        boot skeleton: root, lanes, durable loop roots
  tasks/README.md        task model and conventions
  workflows/*.ts         workflow behavior
  scripts/*.ts           app tools and metrics
  design/*.md            architecture/design
  curated artifacts      human-authored docs or feature standards

.state/, never committed:
  tasks/tree.json        live task tree
  tasks/kanban.json      derived board snapshot
  tasks/archive/*.json   generated done-leaf archives
  project-state.json     runtime readout and counters
  *.jsonl                runtime journals, runs, discussion, assignments
```

Use the phrase "task tree" for the logical object. Avoid teaching humans and
agents to depend on a physical path like `tasks/tree.json`; the path is an SDK
detail.

Reviewer and worker prompts must follow the same rule. A reviewer must not
reject a worker because the checked-in `tasks/tree.json` looks stale. The
reviewer should inspect the task record supplied by the workflow or use
supported helpers such as `bun run task-tree show <task-id>`, which resolve the
live runtime tree. Evidence may mention `.state/tasks/tree.json` as the runtime
backing store, but normal agent instructions should point to the helper, not to
manual file reads.

The same rule applies to loop runtime files under `.state/`, such as
`.state/feature-compact-loop/state.json` and `.state/spec-loop/state.json`.
They are authoritative only at the time they are read. If a reviewer reports
stale loop-state text, the app should verify the live record again before
creating another retry. Acceptance metadata on a task is only a note; the task
is not closed until the normal reviewed-event path or `mark-done` transition
sets the task state to `done`.

Generated agent session readouts are also runtime state. The current agent
runtime still writes them beside the agent for compatibility:

```
agents/<agent>/last-session.md
agents/<agent>/last-eval.md
agents/<agent>/last_heartbeat_brief.md
agents/<agent>/workflows/.may-runtime-module-*.mjs
```

These files are ignored and must not be tracked. They may move under `.state/`
later, but source cleanup does not require that path move because existing
prompt injection and session-end code intentionally read and write the
app-local agent paths.

## Source vs Runtime Fields

`project.json` remains the stable project definition.

Static fields stay in git:

- `id`
- `owner`
- `type`
- `priority`
- `status` when it means configured lifecycle, not current execution detail
- `policy`
- `domainProject`
- `workspace` or app-local workspace references
- `goal`
- `strategy`
- other handler/schedule/capability metadata

Runtime fields move to `.state/project-state.json`:

- `currentState`
- `currentFocus`
- `focusPlan`
- `taskIndex` when it is generated from current runtime files
- `activeTaskId`
- `activeTaskIds`
- `metrics` snapshots
- `updatedAt`
- transient wait/retry/readout fields

If a field is unclear, use this rule: if a worker or loop may update it during
normal operation, it belongs in `.state/project-state.json`.

The loader may merge `project.json` and `.state/project-state.json` for reads.
Writes must target only `.state/project-state.json`; runtime code must not
rewrite `project.json`.

## Runtime Path Contract

Add a small SDK path contract and use it everywhere.

Suggested API shape:

```ts
type ProjectRuntimePaths = {
  appDir: string;
  stateDir: string;
  taskTreePath: string;
  kanbanPath: string;
  taskArchiveDir: string;
  projectStatePath: string;
  journalPath: string;
};

function projectRuntimePaths(appDir: string): ProjectRuntimePaths;
function resolveTaskTreePath(appDir: string): string;
function ensureTaskTreeState(appDir: string): {
  path: string;
  migrated: boolean;
};
function loadProjectReadModel(appDir: string): Record<string, unknown>;
function saveProjectRuntimeState(
  appDir: string,
  patch: Record<string, unknown>,
): void;
```

The exact names can change, but the rule cannot: one SDK helper owns runtime
paths. App workflows, scripts, metrics, UI endpoints, and tests must use that
helper instead of reconstructing paths.

## Task Tree Boot and Migration

Runtime task tree resolution:

1. If `.state/tasks/tree.json` exists, use it.
2. Else if legacy `tasks/tree.json` exists, copy it to `.state/tasks/tree.json`
   and use the copy.
3. Else if `tasks/seed.json` exists, copy it to `.state/tasks/tree.json` and
   use the copy.
4. Else create an empty tree in `.state/tasks/tree.json`.

Safety rules:

- Never overwrite an existing `.state/tasks/tree.json` during migration.
- Log or journal when legacy `tasks/tree.json` is copied.
- Keep migration idempotent.
- Preserve the shrinkage guard for writes.
- Lock the runtime tree path, not the legacy path.

`tasks/seed.json` should be a minimal boot skeleton. It should contain root
project structure, lanes, and durable loop root tasks that must always exist.
It should not contain historical completed leaves, stale blocked leaves, or the
full current operational tree.

## Kanban Contract

`tasks/kanban.json` is derived runtime state.

Write it to `.state/tasks/kanban.json`. UI code may read either the live tree
and build a read model on demand, or read this snapshot as a cache. In both
cases, the public UI should say "task board" or "task tree", not expose the
physical runtime path as the concept.

The legacy app-local `tasks/kanban.json` should be removed from git and ignored.

## Generated Archives

Generated done-leaf archives are runtime and should move to
`.state/tasks/archive/`.

Curated source artifacts may remain in git if they are intentionally reviewed
knowledge. Examples:

- `tasks/archive/legacy-scenarios-tasks-README.md`
- `tasks/archive/managedsystem-pool/wave-01-feature-standard.yaml`

Rule: generated snapshots go to `.state`; human-authored or curated knowledge
can stay in git.

## Generated Agent Readouts

Agent `last-session.md`, `last-eval.md`, `last_heartbeat_brief.md`, and
`.may-runtime-module-*.mjs` files are generated runtime readouts.

They are not source files. Keep the local copies if the running app needs them,
but remove them from git tracking and ignore future writes. Agent instructions,
capability manifests, curated knowledge, skills, and checked-in workflows remain
source files.

This is intentionally narrower than ignoring all agent workspaces. Some
workspace files in older apps are curated research or knowledge artifacts; move
those only after a separate source-vs-runtime classification pass.

## Required Code Changes

Shared SDK:

- Add runtime path helpers.
- Change `taskTreeConfig()` to use `.state/tasks/tree.json`.
- Change `saveTaskTreeWithKanbanSnapshot()` and `writeKanbanSnapshot()` to write
  `.state/tasks/kanban.json`.
- Add explicit migration tests:
  - legacy tree copied once
  - seed tree bootstraps runtime tree
  - existing runtime tree wins
  - save path uses runtime tree
  - shrinkage guard still protects runtime tree

Shared runtime and UI:

- Update `may-agent/src/app/http/server.ts` project task endpoint to use the SDK
  resolver and return the actual runtime path in diagnostics.
- Update project detail loading so merged project state is visible without
  writing `project.json`.
- Update web UI empty-state text from "no tasks/tree.json" to "no task tree".

`aks-rp-e2e.app`:

- Update metrics, health, integrity, checkpoint, watchdog, readout sync, and
  task-tree CLI paths through the SDK helper.
- Change project readout sync to write `.state/project-state.json`, not
  `project.json`.
- Update prompts and docs that say "edit/read `tasks/tree.json`" so they point
  to the task-tree tools or logical task tree. It is okay for developer docs to
  mention the runtime path when they are specifically about files.
- Keep workflow outputs logical, for example `task tree` or
  `.state/tasks/tree.json`, but do not require workers to know the path for
  normal task work.

Other apps:

- Add `tasks/seed.json`.
- Move live tree to `.state/tasks/tree.json`.
- Ignore legacy runtime paths.
- Split runtime project fields only where they exist.

## Per-App Migration Steps

These are the completed rollout steps. Do not repeat them by deleting files
first in a future app; make the code able to read and write the runtime path
before removing tracked runtime files.

1. Implement SDK runtime path helpers.
2. Update shared UI/runtime readers to use the helpers.
3. Update app-local scripts and workflows for `aks-rp-e2e.app`.
4. Add compatibility tests with old and new layouts.
5. For each project app:
   - create `.state/tasks/tree.json` from the current live tree
   - create `.state/tasks/kanban.json` if the app has a board snapshot
   - create `.state/project-state.json` from runtime fields in `project.json`
   - create `tasks/seed.json`
   - strip runtime fields from `project.json`
   - add `tasks/tree.json`, `tasks/kanban.json`, and generated archives to
     `.gitignore`
   - remove tracked legacy runtime files from git
6. Boot the app and verify loops, metrics, shared project UI, private kanban UI,
   and task-tree CLI all see the same live task tree.

## Operations and Backup

Moving runtime state out of git is correct, but it changes failure recovery.

If `.state/` is lost, the project loses live task progress and restarts from
`tasks/seed.json`. That is acceptable only if we have an explicit operational
story.

Add or document:

- `bun run runtime-state snapshot` to write a timestamped archive outside git
  or under ignored `.state/snapshots/`.
- `bun run runtime-state restore <snapshot>` for intentional recovery.
- a health/metric check that reports missing runtime task tree, stale runtime
  tree, and mismatch between legacy tracked tree and active runtime tree during
  migration.

Snapshots are operational backups, not source files.

## Verification

Minimum verification before removing tracked runtime files:

1. SDK tests pass for runtime path resolution and migration.
2. `bun run task-tree summary` reads `.state/tasks/tree.json`.
3. `bun run task-tree kanban-snapshot` writes `.state/tasks/kanban.json`.
4. `bun run project-metrics` reads the runtime tree and does not require legacy
   `tasks/tree.json`.
5. Shared project UI loads the task board from the runtime tree.
6. `aks-rp-e2e.app/ui/kanban/` loads the same runtime tree state.
7. Planner/watchdog/readout sync updates `.state/project-state.json`, not
   `project.json`.
8. `git status` no longer shows task tree, kanban, or runtime project readout
   churn after normal operation.
9. Restarting the app preserves the runtime tree from `.state/`.
10. Removing `.state/tasks/tree.json` in a throwaway fixture boots from
    `tasks/seed.json`.

## Rollout Risks

The main risk is a split brain:

- one writer updates `.state/tasks/tree.json`
- one reader still reads `tasks/tree.json`
- UI and metrics disagree about project state

The fix is not more compatibility branches. The fix is one path resolver and a
temporary integrity check that fails loudly if legacy and runtime trees diverge
after migration.

Second risk: treating `tasks/seed.json` as a backup. It is not a backup. It is
only a boot skeleton.

Third risk: silently losing live progress because `.state/` is ignored. Add the
snapshot/restore operation before relying on this layout for long-running work.

## Decisions

- `tasks/seed.json` should be minimal, not a full copy of the current tree.
- Runtime tree migration may happen automatically only when no runtime tree
  exists, and it must be logged.
- `project-state.json` should stay one file for now. Split it only if one field
  becomes independently large or independently owned.
- Generated task archives are runtime. Curated task archive documents may stay
  in git.
- The first implementation target should be `aks-rp-e2e.app`, because it has
  the heaviest runtime churn and the most readers to validate.
