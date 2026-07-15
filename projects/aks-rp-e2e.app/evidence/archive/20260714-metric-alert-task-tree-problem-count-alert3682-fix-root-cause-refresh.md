# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3682 refresh)

- Date: 2026-07-14
- Final operation: `fix_root_cause`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3682`
- Owner: `app-ops`

## Judgment

The breach was real. The live focus metadata audit before repair still returned two exact defects after the latest planner/worker transitions: one stale active-link still claimed `ops/apply-focus-terminal-frontier-context-readout-patch-20260714` was active even though the live tree had moved it to review, and one stale review-link still named missing task `ops-apply-close-stale-nonapproval-escalation-envelopes-after-replay-fix-` instead of the actual live review task id.

I fixed the root cause by refreshing the focus-plan metadata to the current live frontier through the supported task-tree save path, pruning blocked links to still-blocked carriers, updating the root current-focus reason, and syncing the runtime project readout.

## Evidence checked

### 1) Live defect before repair

The focus metadata audit reported 2 relevant issue(s):

1. context.observations.linked_active_task_ids references ops/apply-focus-terminal-frontier-context-readout-patch-20260714 as active, but the live tree state is review.
2. context.observations.linked_review_task_ids references missing task ops-apply-close-stale-nonapproval-escalation-envelopes-after-replay-fix-.

### 2) Concrete repair applied

- rewrote `focus-terminal-frontier-finality-reconciliation-20260714.context.observations.linked_active_task_ids` to `[]`
- rewrote `focus-terminal-frontier-finality-reconciliation-20260714.context.observations.linked_review_task_ids` to `["ops-apply-ops-apply-close-stale-nonapproval-escalation-envelopes-after-r","ops/apply-focus-terminal-frontier-context-readout-patch-20260714"]`
- pruned `focus-terminal-frontier-finality-reconciliation-20260714.context.observations.linked_blocked_task_ids` to still-blocked carriers only
- refreshed `focus-terminal-frontier-finality-reconciliation-20260714.context.progress_review` and `project.context.current_focus_proposal.reason` to the truthful live frontier
- ran `syncProjectReadout(...)` so `.state/project-state.json` matches the repaired task-tree state

### 3) Live validation after repair

- post-repair focus metadata audit issues: 0
- synced runtime readout changed: yes
- live frontier at repair time: active=[none], review=[ops-apply-ops-apply-close-stale-nonapproval-escalation-envelopes-after-r, ops/apply-focus-terminal-frontier-context-readout-patch-20260714], waiting=[none], runnable=[none], blocked=124

## Outcome

Choosing `fix_root_cause` because the breach came from two stale focus metadata references, those references were repaired through the supported task-tree save path in this session, and the live focus metadata audit now returns 0 issues.

## Next validation

Wait for the next `metrics-snapshot` / alert refresh to move persisted `metrics.current` from `2` to `0` and auto-clear alert `3682`.
