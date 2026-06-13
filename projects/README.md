# Projects

`/app/projects` contains several kinds of folders. Do not infer one execution
model from the directory name alone; classify by markers.

## Classification Rules

- `*.app/` with `app.ts` and `project.json` is a **May-agent project app**.
  It is a control plane: events, handlers, schedules, task tree, project UI,
  and app-local runtime state.
- A sibling folder without `project.md` but with domain assets is a
  **domain workspace**. It should be portable and useful without May-agent.
- A folder with `project.md` is a **legacy project workspace**. Its status and
  type come from front matter.
- `_archive/` is the **physical archive** for old material moved out of the
  top-level project list.
- Folders with no project markers are **ambiguous/stale** until adopted or
  removed.

Stable links matter, so classification does not automatically imply moving a
folder. Move only when the owner explicitly decides that link breakage is worth
the cleanup.

## Top-Level Policy

The top level is intentionally small:

- active project apps
- domain workspaces required by those apps
- the platform workspace
- `_archive/`

Legacy `project.md` workspaces should live under `_archive/` unless explicitly
restored for migration or review.

## Current Active Project Apps

- `aks-rp-e2e.app/` - May-agent app that drives the AKS RP E2E domain project.
- `scout-knowledge-lib.app/` - May-agent app that drives Scout's knowledge
  library project.

## Domain Workspaces

- `aks-rp-e2e/` - portable AKS RP feature knowledge, specs, replays, runner,
  evidence, model, suites, and reports. This is a separate git repo and should
  run without May-agent.
- `scout-knowledge-lib/` - portable Scout knowledge library workspace with
  knowledge notes, reports, and design material.

## Platform Workspace

- `platform/` - shared May-agent platform workspace. It is still on the legacy
  project layout with a partial `.app/` control plane and the real May-agent
  repo at `platform/repos/may-agent/`. Treat it as the platform owner lane until
  it is fully migrated to the v3 app layout.

### Platform V3 Migration Plan

Migrate `platform/` after the project app convention is stable enough to avoid
churn in the shared runtime project itself.

Target shape:

```text
platform/      # platform domain workspace: docs, proposals, tasks, repo host
platform.app/  # May-agent control plane: app.ts, project.json, workflows, UI
```

Migration order:

1. Create `platform.app/` beside `platform/` with `app.ts`, `project.json`,
   `tasks/`, `workflows/`, `.state/`, and any platform-specific project UI.
2. Move runtime-control files from `platform/.app/` into `platform.app/`.
3. Keep `platform/repos/may-agent/` inside the domain workspace unless the repo
   itself is later promoted to a separate top-level domain workspace.
4. Leave root `platform/project.md` as domain history until the platform app has
   a stable `project.json` and task tree.
5. Update loaders and docs to discover `platform.app/`, then retire
   `platform/.app/`.

## Legacy Project Workspaces

These folders were old `project.md`-based project workspaces. They are not v3
apps and were archived under:

```text
_archive/top-level-cleanup-2026-06-13/
```

Their current state should be read from front matter before use.

Waiting or paused legacy folders archived in this batch:

- `evaluator-aftermath-duplicate-review-loop/`
- `ruflo-learning-loop/`
- `scout-second-brain-learning/`

Done or closed milestone/archive folders archived in this batch:

- `agent-convention-compliance/`
- `agent-memory-learning/`
- `agent-system-evolution/`
- `agent-system-literacy/`
- `closed-loop-reliability/`
- `coach-quality/`
- `cross-agent-collaboration/`
- `daily-alert-review/`
- `documentation-gen/`
- `empty-assistant-stop-runtime-retry/`
- `eval-llm-lane-restoration/`
- `evaluation-revival/`
- `evaluator-aftermath-null-trigger-loop/`
- `evaluator-aftermath-p114-drift/`
- `evaluator-aftermath-routing-drift/`
- `evaluator-good-repair-contradiction/`
- `evaluator-low-quality-rate-calibration/`
- `evaluator-receipt-coverage/`
- `evaluator-session-aftermath-scan-timeouts/`
- `finish-blocked-hygiene-reduction/`
- `gym-quality-improvement/`
- `handler-reliability/`
- `hao-alignment/`
- `heartbeat-efficiency/`
- `master-worker-context-sharing/`
- `prompt-efficiency/`
- `proof-of-life-dashboard/`
- `request-deduplication/`
- `retry-budget-integration/`
- `retry-removal/`
- `skill-workflow-audit/`
- `system-efficiency/`
- `system-operations/`
- `test-coverage/`
- `v2-conformance-and-visibility/`
- `v2-spec-coverage-buildout/`
- `workflow-reliability/`

## Physical Archive

- `_archive/` - older project material already moved out of the top-level
  working set. Keep it read-only unless intentionally restoring historical
  context.
- `_archive/top-level-cleanup-2026-06-13/` - legacy project workspaces moved
  out of the top-level project list during the app/domain cleanup.

## Ambiguous Or Stale

- `may-agent/` - resolved. This top-level folder only contained local Claude
  settings and was moved to `_archive/may-agent-local-settings/`. The actual
  May-agent repo is `platform/repos/may-agent/`.

## Suggested Cleanup Path

1. Keep active v3 apps and domain workspaces at top level.
2. Finish migrating `platform/` to the v3 app/domain split using the plan above.
3. Keep legacy folders in `_archive/` unless intentionally restoring one for
   migration or review.
4. Keep ambiguous local scratch out of the top-level project list.
