# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3682)

- Date: 2026-07-14
- Final operation: `fix_root_cause`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3682`
- Owner: `app-ops`

## Judgment

The breach was real. A fresh integrity recompute before repair still returned `value = 1`, and the live focus metadata audit named one exact defect: `focus-terminal-frontier-finality-reconciliation-20260714.context.observations.linked_active_task_ids` still referenced missing archived task `ops/repair-focus-controller-redispatch-gap-20260714`.

I fixed the root cause by applying the bounded focus context/readout patch through the supported task-tree save path. The patch refreshed the focus-plan nested metadata, the root `project.context.current_focus_proposal.reason`, and the linked `.state/project-state.json` notes so they describe the truthful live frontier instead of the archived carrier ids.

## Evidence checked

### 1) Persisted metric row was still breaching before repair

- `metrics.current = 1`
- threshold `0`
- priority `P0`

### 2) Live defect before repair

Before the patch, the focus metadata audit reported:

- `context.observations.linked_active_task_ids references missing task ops/repair-focus-controller-redispatch-gap-20260714.`

### 3) Concrete repair applied

The bounded patch at `scripts/ops-apply-focus-terminal-frontier-context-readout-patch-20260714.ts`:

- rewrote the focus-plan stale success-criteria/readout text to the current live frontier
- refreshed `focus-terminal-frontier-finality-reconciliation-20260714.context.progress_review`
- rewrote `linked_active_task_ids` / `linked_review_task_ids` to live frontier ids
- pruned `linked_blocked_task_ids` to still-blocked carriers only
- refreshed `project.context.current_focus_proposal.reason`
- refreshed `.state/project-state.json` fields `currentFocus.focusReview.note` and `focusPlan.summary`

Durable task evidence for the patch is recorded at:

- `evidence/archive/ops-apply-focus-terminal-frontier-context-readout-patch-20260714.md`

### 4) Live validation after repair

After the patch:

- `bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json` returned `{"value":0,...}`
- `bun run task-tree show focus-terminal-frontier-finality-reconciliation-20260714` now shows `linked_active_task_ids` aligned to live active tasks and no stale reference to `ops/repair-focus-controller-redispatch-gap-20260714`
- the patch script itself reported `afterIssues: []`
- the live frontier did shift again during the repair window (a second active repair and one waiting task appeared), but that race only changed which current ids were truthful; it did not reintroduce the missing archived-task reference that caused alert `3682`

## Outcome

Choosing `fix_root_cause` because the breach came from one specific stale archived task reference in live focus metadata, that reference was repaired through the supported task-tree save path in this session, and the live metric recompute now validates the repair with `value = 0`.

## Next validation

Wait for the next `metrics-snapshot` / alert refresh to move persisted `metrics.current` from `1` to `0` and auto-clear alert `3682`.
