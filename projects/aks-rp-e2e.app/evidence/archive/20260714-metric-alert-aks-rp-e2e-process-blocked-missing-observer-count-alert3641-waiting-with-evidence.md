# Metric alert triage — `aks-rp-e2e.process.blocked.missing-observer-count` (alert 3641)

Date: 2026-07-14
Owner: app-ops
Chosen operation: `waiting_with_evidence`

## Metric facts checked

- metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- alert id: `3641`
- persisted metric row at triage time: `current=1`, `threshold=0`, `target=0`, `priority=P0`, `updated_at=1784023881274`
- open alert row still unresolved: `resolved_at=NULL`
- latest persisted snapshot named one offender task id: `ops/wait-project-approval-owner-return-primary-blocker-20260713`

## Live source-of-truth checks

The persisted alert is currently contradicted by the live task-tree source of truth:

1. `bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json`
   - returned `{"value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}`
2. `bun run task-tree show ops/wait-project-approval-owner-return-primary-blocker-20260713`
   - shows `blocker.observed_by`, `blocker.observation_method`, and `blocker.next_check_at` all present on the exact task named by the latest stale snapshot
3. Direct audit of `.state/tasks/tree.json`
   - found `blocked_missing_observer_count = 0` and `task_ids = []`
4. `bun run ./scripts/task-tree.ts repair-blocked-contracts --dry-run`
   - returned `repairedCount = 0`, so the supported repair path sees nothing left to fix

## Why this is waiting, not fix or resolve

This is not a threshold problem and not a live blocked-contract defect anymore. The metric definition is still correct: blocked waits should carry observer metadata. But the current runtime tree is already healthy, including the one task id named by the recent stale snapshot. Because this triage environment has no safe runtime write path for `metrics` or `metric_alerts`, there is no truthful root-cause repair or manual stale-resolution action to apply from here.

The smallest correct owner action is therefore `waiting_with_evidence`: record that the live source of truth is back at `0`, leave the alert visible, and let the next metrics refresh / alert lifecycle update reconcile the stale persisted row.

## Not chosen

- Not `fix_root_cause`: live recompute, direct audit, and repair dry run all show nothing left to repair.
- Not `resolve_stale`: the alert looks stale, but this session does not have a safe runtime write path to resolve `metric_alerts` directly.
- Not `calibrate_metric`: threshold `0` is still correct for missing observer metadata.
- Not `downgrade_priority`: the right issue is stale persistence, not reduced urgency of a real breach.
- Not `document_exception`: no exception is being accepted; the healthy live state should recover normally.
- Not `upgrade_or_escalate`: no destructive action or human-only policy decision is required yet.

## Expected next validation

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`. Expected recovery signal: persisted `metrics.current` changes from `1` to `0` and alert `3641` resolves automatically. If the next fresh sample returns `>0`, reopen only with the concrete offender task ids from that fresh recompute.
