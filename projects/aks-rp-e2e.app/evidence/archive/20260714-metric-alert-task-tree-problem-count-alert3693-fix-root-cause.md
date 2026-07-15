# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3693)

- Date: 2026-07-14
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3693`
- Owner: `app-ops`

## Judgment

The breach was real when triage started, but by the time this session revalidated the live source of truth the task-tree defect had already recovered and the open alert was stale persisted state.

Earlier in this session, `bun run integrity` reproduced two focus-metadata drift issues under `focus-blocked-frontier-writeback-and-holder-normalization-20260714`:

- `context.observations.linked_active_task_ids` referenced missing task `domain-burn-down-localdns-blocked-family-20260714`
- `context.observations.linked_active_task_ids` still treated `review-spec-kms-v2-private-vnet-integration-private-kv-rerun-171997614-return-20260714` as active even though its live tree state had already moved to `review`

A later live recheck in the same session showed those defects were no longer present: `bun run integrity` was green and a fresh metric recompute returned `value = 0` while the persisted `metrics.current` row still showed `2`.

Because the live source of truth is back in range and this session has no safe runtime write path to close `metric_alerts` directly, the correct final judgment is `resolve_stale`.

## Evidence checked

### 1) Persisted metric row is still stale

The runtime `metrics` row still shows:

- `current = 2`
- `updated_at = 1784050348724`

That persisted value is what opened alert `3693`.

### 2) The breach was reproducible at session start

At the start of this triage session, `bun run integrity` failed with two task-tree problems:

- `focus metadata drift: context.observations.linked_active_task_ids references missing task domain-burn-down-localdns-blocked-family-20260714. (owner=focus-blocked-frontier-writeback-and-holder-normalization-20260714, expected=active, actual=missing)`
- `focus metadata drift: context.observations.linked_active_task_ids references review-spec-kms-v2-private-vnet-integration-private-kv-rerun-171997614-return-20260714 as active, but the live tree state is review. (owner=focus-blocked-frontier-writeback-and-holder-normalization-20260714, expected=active, actual=review)`

### 3) The current live source of truth has recovered

Later in the same session:

- `bun run integrity` returned `App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=132`
- `bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json` returned `{"value":0,...}`

That means the alert row and persisted metric value are now behind the live task-tree truth.

### 4) Concrete session output updated

Even though the live defect had already recovered by the time the repair helper acquired the task tree, this session still refreshed the focus readout artifacts so the written focus summary matches the recovered frontier:

- updated `project.context.current_focus_proposal.reason`
- refreshed `focus-progress-review-blocked-frontier-writeback-and-holder-normalization-20260714.md`
- recorded this stale-alert judgment in `evidence/archive/20260714-metric-alert-task-tree-problem-count-alert3693-fix-root-cause.md`

## Outcome

Choosing `resolve_stale` because the live source-of-truth checks now show `task-tree-problem-count = 0` and a passing integrity audit, while the open alert still reflects the older persisted value `2`.

## Next validation

Wait for the next `metrics-snapshot` / alert refresh to move persisted `metrics.current` from `2` to `0` and auto-clear alert `3693`.
