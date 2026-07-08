# Metric alert triage — aks-rp-e2e.process.unowned-work-count

- Alert id: `2821`
- Metric id: `aks-rp-e2e.process.unowned-work-count`
- Judged at: `2026-07-07T00:45:44Z`
- Chosen operation: `waiting_with_evidence`

## Current measurement

The breach is still current in the metric source, but the only contributor is a stale open task-assignment pair for a task that is already done.

Fresh recompute from the metric source in `/app/projects/aks-rp-e2e.app`:

```bash
bun run metrics:sample aks-rp-e2e.process.unowned-work-count --json
```

Observed result:

```json
{
  "measuredAt": 1783385144903,
  "value": 1,
  "sampleSize": 1,
  "note": "{\"sampledAt\":\"2026-07-07T00:45:44.922Z\",\"staleActiveTaskIds\":[],\"staleActiveTaskSessions\":[],\"assignmentMismatchKeys\":[\"reconcile-compact-loop-package-partial-residual-six-20260707:a_reconcile-compact-loop-package-partial-residual-six-20260707_20260707003356\"],\"assignmentMismatchTasks\":[{\"correlationKey\":\"reconcile-compact-loop-package-partial-residual-six-20260707:a_reconcile-compact-loop-package-partial-residual-six-20260707_20260707003356\",\"taskId\":\"reconcile-compact-loop-package-partial-residual-six-20260707\",\"attemptId\":\"a_reconcile-compact-loop-package-partial-residual-six-20260707_20260707003356\",\"taskState\":\"done\"}],\"recoveryUnownedSpecIds\":[]}"
}
```

So the metric is not recovered yet, and the contributor is exactly one `assignmentMismatchTask`.

## Exact contributor

The open runtime pair is:

- `reconcile-compact-loop-package-partial-residual-six-20260707:a_reconcile-compact-loop-package-partial-residual-six-20260707_20260707003356`

Current `event_pair_runs` evidence:

- `pair_name = project.task`
- `status = open`
- `opened_at = 1783384545458`
- `note = opened by project.task.assigned`

Current task-tree state for that task proves it is no longer active:

```bash
bun run task-tree show reconcile-compact-loop-package-partial-residual-six-20260707
```

Observed state highlights:

- `state: done`
- `resolution: replaced`
- `done_at: 2026-07-07T00:35:26.780Z`
- review summary: replaced before worker start because accepted all-26 package-partial evidence already covered the residual-six slice

So this is not a live ownerless work item; it is an **open assignment-pair row left behind after the task was replaced/done**.

## Why this is `waiting_with_evidence`

This is a real current breach in the metric source, but the safe fix is not available in this triage session.

What is true now:

1. The contributor is not stale-active work and not a recovery-unowned spec.
2. The contributor is a stale `event_pair_runs` open row for a task whose task-tree state is already `done`.
3. There is already a newer legitimate package-partial assignment active now:
   - `reconcile-compact-loop-package-partial-202607070042`
   - pair row status `open`
   - task-tree state `active`
4. This environment does not provide a safe runtime write path to close or repair the stale `event_pair_runs` row directly.

Because the metric still recomputes to `1`, `resolve_stale` would be inaccurate. Because the fix requires controller/runtime state repair rather than a safe task-tree text edit from this triage session, the truthful operation is to leave the alert visible and document the exact stale-open pair that must clear.

## Required repair condition

The alert should clear once the runtime/controller path closes or reconciles this exact stale pair:

- `reconcile-compact-loop-package-partial-residual-six-20260707:a_reconcile-compact-loop-package-partial-residual-six-20260707_20260707003356`

No new domain task needs to be created; the task is already done and replaced. The missing change is closure of the lingering open `project.task` pair record.

## Next validation signal

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unowned-work-count`.

Expected outcomes:

- if the stale open pair is reconciled, the metric should return to `0` and alert `2821` should recover;
- if the metric remains `1`, reopen using the exact current `assignmentMismatchKeys` from a fresh recompute rather than creating new package-partial work.
