# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3678)

- Date: 2026-07-14
- Final operation: `fix_root_cause`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3678`
- Owner: `app-ops`

## Judgment

The breach was real. The live task tree had one focus-metadata integrity defect after stale-active requeue moved `focus-terminal-frontier-finality-reconciliation-20260714` back to `backlog`: `context.observations.linked_active_task_ids` still claimed the focus plan itself was active. This session fixed the root cause by clearing that stale active link through the supported task-tree save path and refreshing the focus/project readout so the proposal is represented truthfully as pending approval with no live focus frontier leaves.

## Evidence checked

### 1) Persisted metric row was breaching before repair

- alert 3678 was opened because persisted `metrics.current` was `1` against threshold `0`

### 2) Live integrity issue before repair

- focus metadata audit returned exactly one issue before repair:

> context.observations.linked_active_task_ids references focus-terminal-frontier-finality-reconciliation-20260714 as active, but the live tree state is backlog.

### 3) Concrete repair applied

- cleared `focus-terminal-frontier-finality-reconciliation-20260714.context.observations.linked_active_task_ids` from `["focus-terminal-frontier-finality-reconciliation-20260714"]` to `[]`
- refreshed `focus-terminal-frontier-finality-reconciliation-20260714.context.progress_review` to say the focus proposal is pending approval with active/review/waiting/runnable all `none`
- refreshed `project.context.current_focus_proposal.reason` to remove the stale active claim and preserve the same blocked carrier linkage

### 4) Live validation after repair

- post-repair focus metadata audit issues: 0
- post-repair focus progress summary:

> The terminal-frontier finality focus proposal is still pending owner approval, and after stale-active requeue the truthful live focus frontier is active=[none], review=[none], waiting=[none], runnable=[none], blocked=122. The previous active claim for focus-terminal-frontier-finality-reconciliation-20260714 was stale once the task moved back to backlog.

- post-repair project focus reason:

> The next bounded no-live mission is still terminal-frontier finality reconciliation, but it is currently pending owner approval rather than active. The truthful live focus frontier is active=[none], review=[none], waiting=[none], runnable=[none], while blocked carrier linkage stays on [ops/wait-project-approval-owner-return-primary-blocker-20260713, aks-feature-compact-loop, wait-shared-westus2-managed-cluster-capacity-family-return-20260703, wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704, wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708, wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708, wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709, wait-kms-svc-cert-rotation-underlay-owner-decision-return-20260709, wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711, ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized, ops/review-2240-cluster-autoscaler-compact-frontier-lineage-20260713, ops/wait-shared-worker-model-auth-capability-return-20260713, hold-spec-shared-authenticated-artifact-result-recovery-family-20260714, hold-spec-localdns-managed-cluster-quota-family-frontier-20260708, hold-spec-localdns-autodefault-fresh-create-136-cilium-environment-frontier-20260714, wait-localdns-create-http400-residual-family-return-20260704, hold-spec-localdns-windows-nodepool-unsupported-nonlive-evidence-ceiling-20260712, wait-localdns-hosts-plugin-create-http400-body-or-surface-change-20260703]. The previous active claim for focus-terminal-frontier-finality-reconciliation-20260714 was cleared after stale-active requeue moved that focus plan back to backlog.

## Outcome

Choosing `fix_root_cause` because the current breach came from one stale focus active-link reference, that reference was safely removed through the supported task-tree save path in this session, and the live metric recompute can now validate the repair.

## Next validation

Wait for the next `metrics-snapshot` / alert refresh to move persisted `metrics.current` from `1` to `0` and auto-clear alert `3678`.
