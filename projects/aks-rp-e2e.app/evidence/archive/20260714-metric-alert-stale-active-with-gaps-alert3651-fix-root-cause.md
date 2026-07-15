# Metric alert triage — fix_root_cause — `aks-rp-e2e.task.stale-active-with-gaps`

- Alert id: `3651`
- Metric id: `aks-rp-e2e.task.stale-active-with-gaps`
- Triage time: `2026-07-14T10:42Z`
- Chosen operation: `fix_root_cause`

## What was wrong

At triage time the task tree still showed three `ops/*` leaves as `active`, but all three attached worker sessions had already ended `done`:

- `ops/reconcile-compact-terminal-frontier-holder-slice-20260714`
- `ops/reconcile-project-blocked-wait-proof-family-20260714`
- `ops/reconcile-spec-loop-terminal-frontier-model-finality-20260714`

This left the project appearing busy while no live worker owned those leaves. The metric sampler reported:

- `aks-rp-e2e.task.stale-active-count = 3`
- `aks-rp-e2e.task.stale-active-with-gaps = 1`
- `aks-rp-e2e.task.no-work-with-gaps = 1`

## Root-cause repair applied

Used the app-safe task-tree requeue path to move each stale active leaf back to backlog with a fresh-session marker:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree requeue-active <task-id> \
  --reason "Metric aks-rp-e2e.task.stale-active-with-gaps triage: worker session ended done while task remained active; requeue to restore runnable ownership." \
  --fresh-session
```

Applied to:

1. `ops/reconcile-compact-terminal-frontier-holder-slice-20260714`
2. `ops/reconcile-project-blocked-wait-proof-family-20260714`
3. `ops/reconcile-spec-loop-terminal-frontier-model-finality-20260714`

## Evidence after the repair

Post-requeue task-tree summary:

- `frontier.active = []`
- `frontier.runnable = [3 tasks]`
- `counts.backlog = 3`
- `counts.active = 0`

Post-requeue metric samples:

- `aks-rp-e2e.task.stale-active-count = 0`
- `aks-rp-e2e.task.stale-active-with-gaps = 0`
- `aks-rp-e2e.task.no-work-with-gaps = 0`

Each repaired task now records `stale_active_requeued_at` and the triage reason in its trace and shows `state/status = backlog`.

## Follow-up signal

The next runtime `metrics-snapshot` should update the persisted `metrics` row and clear alert `3651`. If a later snapshot still shows `current=1`, then the remaining issue is in metric persistence/alert lifecycle rather than task-tree state.

## Separate issue observed

`aks-rp-e2e.process.unowned-work-count` still reports `3` because the old `project.task` assignment pair rows remain open for the previous attempts even though the tasks are now backlog again. That is a separate P0 process-integrity signal and was not the direct cause of this alert once the stale active leaves were requeued.
