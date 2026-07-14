# Metric alert triage — `aks-rp-e2e.task.no-work-with-gaps` — alert `3656`

## Chosen operation

`fix_root_cause`

## Why the alert breached

At `2026-07-14T11:16Z`, the live owner-side metric recompute still returned `value=1`, and the task tree showed a blocked-only frontier with no runnable, waiting, review, or active leaf work even though verification gaps still remained.

Key facts at breach time:

- `bun run ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps --json` returned `{"value":1}`.
- `bun run task-tree summary --json` showed:
  - `frontier.runnable = []`
  - `frontier.waiting = []`
  - `frontier.review = []`
  - `active_task_ids = []`
  - blocked controller roots `aks-feature-compact-loop` and `aks-spec-verification-loop`
- The governing focus holder `focus-terminal-frontier-finality-reconciliation-20260714` was itself blocked on the exact owner-decision wait carried by `ops/wait-project-approval-owner-return-primary-blocker-20260713`, so the project still had open verification gaps but no executable app-side next step.

This is a real process gap for `app-ops`, not a stale metric row: the project remained active while all visible frontier work had collapsed into blocked stewardship.

## Repair applied

Created one truthful runnable app-ops follow-up in the live task tree:

- `ops/reconcile-blocked-only-frontier-vs-active-project-state-20260714`

Task goal:

> Reconcile the current blocked-only frontier against the still-active AKS RP E2E project state so app-ops either restores one truthful executable successor or converts the project/focus state into an exact paused/approved-exception disposition instead of leaving verification gaps with zero runnable work.

Why this is the root-cause fix:

- The metric contract explicitly treats blocked-only frontier stewardship as insufficient while verification gaps remain.
- The new runnable ops task is not filler backlog; it exists to close the exact process gap that caused the alert: active project + open gaps + zero executable work.
- Its acceptance criteria require a durable outcome: either create the next truthful runnable successor or convert the project/focus state into a truthful paused/approved-exception disposition.

## Validation

### Before repair

- Owner-side recompute: `aks-rp-e2e.task.no-work-with-gaps = 1`
- Live task summary: no runnable/active/review/waiting leaf frontier

### After repair

- `bun run task-tree show ops/reconcile-blocked-only-frontier-vs-active-project-state-20260714` shows the new backlog task exists under `project` with owner `app-ops`.
- `bun run task-tree summary --json` now shows:
  - `frontier.runnable = ["ops/reconcile-blocked-only-frontier-vs-active-project-state-20260714"]`
  - `frontier.active = ["ops/repair-environment-overblock-warning-shared-family-false-positive-20260714"]`
- Fresh owner-side recompute now returns `{"value":0}` for `aks-rp-e2e.task.no-work-with-gaps`.

The persisted runtime metric row and alert row have not recovered yet, which is expected until the next metrics snapshot updates the stored `metrics.current` value from `1` to `0`.

## Why this is not another operation

- Not `waiting_with_evidence`: the live source metric was still breaching at triage start, so a concrete process repair was required.
- Not `resolve_stale`: the latest persisted `1` sample matched the live blocked-only frontier when checked.
- Not `calibrate_metric` or `downgrade_priority`: the metric contract is correct for a true zero-work frontier while gaps remain.
- Not `upgrade_or_escalate`: `app-ops` had a safe local fix available by restoring truthful executable work in the task tree.
