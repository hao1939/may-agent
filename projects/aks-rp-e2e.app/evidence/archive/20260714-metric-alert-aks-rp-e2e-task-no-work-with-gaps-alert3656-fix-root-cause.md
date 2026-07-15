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

## Reconciliation follow-up for `ops/reconcile-blocked-only-frontier-vs-active-project-state-20260714`

Reviewed at `2026-07-14T11:18Z` after the metric-clearing repair task was dispatched.

### Baseline used for this follow-up

Per worker-mode audit rules, the baseline below treats the assigned reconciliation task itself as absent.

#### Pre-audit contributor set

Excluding `ops/reconcile-blocked-only-frontier-vs-active-project-state-20260714`, the live tree still had:

- active: `ops/repair-environment-overblock-warning-shared-family-false-positive-20260714`
- runnable: none
- waiting: none
- review: none
- blocked governing family:
  - `focus-terminal-frontier-finality-reconciliation-20260714`
  - `ops/wait-project-approval-owner-return-primary-blocker-20260713`
  - linked blocked carriers preserved by the focus branch:
    - `hold-compact-aad-rbac-reviewed-exception-trio-frontier`
    - `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
    - `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`
    - `hold-compact-localdns-package-partial-frontier`
    - `hold-spec-localdns-managed-cluster-quota-family-frontier-20260708`
    - `hold-compact-workload-autoscaler-package-partial-frontier`
    - `hold-spec-workload-autoscaler-keda-upgrade-survival-http400-frontier-20260707h`

### Why the remaining active leaf is not the project's truthful executable successor

`ops/repair-environment-overblock-warning-shared-family-false-positive-20260714` is a bounded feedback-loop observability repair, not a work-loop/domain successor and not a focus-approval unblock. Its goal is only to stop `task-tree packet` from re-flagging `hold-compact-aad-rbac-reviewed-exception-trio-frontier` as actionable environment-overblock noise when the exact shared-family wait is already accepted.

That means this active leaf does **not** change the governing next-step truth for the project:

- it does not restore runnable domain verification work;
- it does not replace `ops/wait-project-approval-owner-return-primary-blocker-20260713`;
- it does not unblock `focus-terminal-frontier-finality-reconciliation-20260714`; and
- when it closes, the focus baseline described in `focus-terminal-frontier-finality-reconciliation-20260714` still returns to blocked-only until an owner decision arrives.

The focus holder already says no further local focus action is truthful until the owner-decision wait returns, and the latest progress review says the truthful baseline excluding the last metadata repair was `active=[none], review=[none], waiting=[none], runnable=[none], blocked=122`.

### Reconciliation decision

The governing blocker for the current frontier is **`ops/wait-project-approval-owner-return-primary-blocker-20260713`**.

So the truthful next-step outcome is **not** to create more broad filler backlog. The planner should treat the current project/focus state as an **approval-gated blocked disposition** centered on that exact governing wait and its dependent blocked family, unless a same-lineage successor appears that directly narrows that wait or returns an owner decision.

Concretely:

- keep the current focus mission represented as blocked / needs-approval under `focus-terminal-frontier-finality-reconciliation-20260714`;
- do not let the incidental warning-heuristic repair leaf stand in for project-goal progress; and
- after this reconciliation task is reviewed, prefer a project/focus readout/disposition repair over creating unrelated runnable backlog.

### Post-action represented set

The represented set that should govern planner review is:

- one exact governing approval wait: `ops/wait-project-approval-owner-return-primary-blocker-20260713`
- one dependent blocked focus holder: `focus-terminal-frontier-finality-reconciliation-20260714`
- the same preserved blocked compact/spec carriers listed above
- zero broad filler successors unless one directly changes the same approval/blocker lineage

### Why no other filler backlog was proposed

The only live packet warning at review time was the aad-rbac environment-overblock false positive already owned by `ops/repair-environment-overblock-warning-shared-family-false-positive-20260714`. No evidence showed a missing runnable domain slice, a missing unsent external ask, or a sharper local unblock for the terminal-frontier finality family. Creating unrelated backlog here would only game the no-work metric instead of making the active/blocked project state truthful.
