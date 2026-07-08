# Metric alert triage — aks-rp-e2e.process.unpublished-change-count (alert 3022)

- Alert id: `3022`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-07T13:13:10Z`
- Chosen operation: `waiting_with_evidence`

## Current measurement

Direct checks during this triage confirm the breach is still real:

- the latest metric snapshot reports `current = 5`, `threshold = 0`, `target = 0`, `priority = P0`
- the domain repo `/app/projects/aks-rp-e2e` is on branch `dev` with exactly five modified tracked paths and no ahead marker in the branch header
- `git diff --stat` shows those five paths account for the full dirty surface, so the metric value `5` matches current repo state exactly

## Current dirty surface

The unpublished tracked changes are exactly:

- `features/storage-csi/compact/staging.diagnostics.json`
- `features/storage-csi/compact/staging.plan.json`
- `features/storage-csi/compact/staging.summary.md`
- `features/storage-csi/specs/storage-csi-disk-resize.json`
- `features/storage-csi/specs/storage-csi-disk-xfs.json`

Current diffs show this is a coherent storage-csi compact-review slice rather than random residue:

- `storage-csi-disk-resize.json` promotes the spec from `draft/source-grounded` to `pass/pass` and adds reviewed single-spec evidence from run `28793232048`
- `storage-csi-disk-xfs.json` promotes the spec from `draft/source-grounded` to `pass/pass` and adds reviewed single-spec evidence from run `28791413293`
- `features/storage-csi/compact/staging.summary.md` narrows the quarantined compact frontier from five members to three by removing `disk-resize` and `disk-xfs` from the excluded set
- the matching plan/diagnostics rewrites are large regenerated compact artifacts tied to that same storage-csi review conclusion

## Why this is waiting, not a root-cause fix from this session

This alert is real, but the owner should not publish or revert this slice from the metric triage session yet:

1. runtime `sessions` still shows an active `aks-explorer` package-partial worker for project `aks-rp-e2e` (`s_task_reconcile-compact-loop-package-partial-202607071811`, status `running`) and the sampled feature set for that active task still includes `storage-csi`
2. runtime `sessions` also shows a current planner session for the same project (`s_project_planner_planning_update_20260707181254_y4uryl`, status `running`) reacting to this same metric breach
3. the five dirty files come from the just-finished storage-csi successor review, but that review has already been folded into a broader still-running package-partial reconciliation lane, so this alert session cannot safely prove that the slice is now fully settled
4. committing from this triage would race the active owner workflow and could publish a slice that the running package-partial worker or planner is still classifying

## Concrete state change made by this triage

This triage records the accepted wait judgment in:

- `projects/aks-rp-e2e.app/evidence/metric-alert-unpublished-change-count-20260707-alert3022.md`

That durable note replaces investigation-only context with an explicit owner judgment: the `5`-change breach is real, narrowly scoped to storage-csi compact promotion work, and intentionally left waiting until the active owner workflow settles the same slice.

## Resume condition

Re-evaluate on the next `metrics-snapshot` after one of these happens:

1. `s_task_reconcile-compact-loop-package-partial-202607071811` and the current planner session both finish and the same five-file storage-csi slice remains stable for publication/revert review, or
2. the five storage-csi files are intentionally published or cleared and the metric returns to `0`.
