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
- `_archive/`

Legacy `project.md` workspaces should live under `_archive/` unless explicitly
restored for migration or review.

## Current Active Project Apps

- `aks-rp-e2e.app/` - May-agent app that drives the AKS RP E2E domain project.
- `may-agent.app/` - May-agent app that drives the May-agent platform/runtime
  domain project and owns May-agent design/principle docs.
- `scout-knowledge-lib.app/` - May-agent app that drives Scout's knowledge
  library project.

## Domain Workspaces

- `aks-rp-e2e/` - portable AKS RP feature knowledge, specs, replays, runner,
  evidence, model, suites, and reports. This is a separate git repo and should
  run without May-agent.
- `may-agent/` - May-agent platform/runtime code workspace. This is a separate
  git repo and should remain usable without the project app.
- `scout-knowledge-lib/` - portable Scout knowledge library workspace with
  knowledge notes, reports, and design material.

## Compatibility Wrapper

`platform/` may exist locally as an ignored compatibility wrapper containing a
symlink from `platform/repos/may-agent` to `../may-agent`. Do not treat it as an
active project. New project work belongs in `may-agent.app/` and
`may-agent/`.

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

## Suggested Cleanup Path

1. Keep active v3 apps and domain workspaces at top level.
2. Keep `may-agent.app/` as the platform project app and `may-agent/` as the
   platform/runtime domain workspace.
3. Keep legacy folders in `_archive/` unless intentionally restoring one for
   migration or review.
4. Keep ambiguous local scratch out of the top-level project list.
