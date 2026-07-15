# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3672)

- Date: 2026-07-14
- Final operation: `fix_root_cause`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3672`
- Owner: `app-ops`

## Judgment

The breach was real. After the earlier 3671 repair, the live task tree stayed readable, but the focus-plan metadata drifted again when `aks-spec-verification-loop` moved from `blocked` back to `active` as a structural controller. `focus-terminal-frontier-finality-reconciliation-20260714` still listed that loop in `context.observations.linked_blocked_task_ids`, so the integrity audit and metric both counted one task-tree problem.

This session fixed the root cause by refreshing the live focus metadata through the supported task-tree save path so only still-blocked carriers remain in `linked_blocked_task_ids`, and by rewriting the project focus reason to match the current live frontier.

## Evidence checked

### 1) Persisted metric row was breaching before repair

- metric row for `aks-rp-e2e.process.integrity.task-tree-problem-count` still had `current = 1`, `threshold = 0`, `priority = P0`
- fresh recompute before repair returned `value = 1`

### 2) Live integrity failure named the exact stale reference

Before repair, `bun run integrity` failed with:

- `focus metadata drift: context.observations.linked_blocked_task_ids references aks-spec-verification-loop as blocked, but the live tree state is active. (owner=focus-terminal-frontier-finality-reconciliation-20260714, expected=blocked, actual=active)`

### 3) Concrete repair applied

The repair refreshed the focus-plan metadata from the current live frontier:

- active frontier: `focus-terminal-frontier-finality-reconciliation-20260714`, `ops/diagnose-shared-worker-model-auth-capability-local-recovery-20260714`
- review frontier: `aks-spec-verification-loop`, `domain/reconcile-row94-overlay-dualstack-mounted-source-holder-20260714`
- removed stale blocked-link entries: `aks-spec-verification-loop`
- retained still-blocked linked carriers: `ops/wait-project-approval-owner-return-primary-blocker-20260713`, `aks-feature-compact-loop`, `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`, `wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704`, `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`, `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`, `wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709`, `wait-kms-svc-cert-rotation-underlay-owner-decision-return-20260709`, `wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711`, `ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized`, `ops/review-2240-cluster-autoscaler-compact-frontier-lineage-20260713`, `ops/wait-shared-worker-model-auth-capability-return-20260713`, `hold-spec-shared-authenticated-artifact-result-recovery-family-20260714`, `hold-spec-localdns-managed-cluster-quota-family-frontier-20260708`, `hold-spec-localdns-autodefault-fresh-create-136-cilium-environment-frontier-20260714`, `wait-localdns-create-http400-residual-family-return-20260704`, `hold-spec-localdns-windows-nodepool-unsupported-nonlive-evidence-ceiling-20260712`, `wait-localdns-hosts-plugin-create-http400-body-or-surface-change-20260703`

### 4) Live validation after repair is green

- post-repair focus metadata audit issues for the focus/project pair: 0
- repaired project focus reason now says:

> The next bounded mission is still terminal-frontier finality reconciliation. The truthful live frontier is active=[focus-terminal-frontier-finality-reconciliation-20260714, ops/diagnose-shared-worker-model-auth-capability-local-recovery-20260714], review=[aks-spec-verification-loop, domain/reconcile-row94-overlay-dualstack-mounted-source-holder-20260714], waiting=[none], runnable=[none], while blocked carrier linkage now stays only on [ops/wait-project-approval-owner-return-primary-blocker-20260713, aks-feature-compact-loop, wait-shared-westus2-managed-cluster-capacity-family-return-20260703, wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704, wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708, wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708, wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709, wait-kms-svc-cert-rotation-underlay-owner-decision-return-20260709, wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711, ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized, ops/review-2240-cluster-autoscaler-compact-frontier-lineage-20260713, ops/wait-shared-worker-model-auth-capability-return-20260713, hold-spec-shared-authenticated-artifact-result-recovery-family-20260714, hold-spec-localdns-managed-cluster-quota-family-frontier-20260708, hold-spec-localdns-autodefault-fresh-create-136-cilium-environment-frontier-20260714, wait-localdns-create-http400-residual-family-return-20260704, hold-spec-localdns-windows-nodepool-unsupported-nonlive-evidence-ceiling-20260712, wait-localdns-hosts-plugin-create-http400-body-or-surface-change-20260703]. This refresh removed stale blocked-link claims for [aks-spec-verification-loop] after those tasks moved out of blocked state.

- repaired progress summary now says:

> The current no-live terminal-frontier mission still fits. The truthful live frontier is active=[focus-terminal-frontier-finality-reconciliation-20260714, ops/diagnose-shared-worker-model-auth-capability-local-recovery-20260714], review=[aks-spec-verification-loop, domain/reconcile-row94-overlay-dualstack-mounted-source-holder-20260714], waiting=[none], runnable=[none], blocked=122. linked_blocked_task_ids was refreshed to only still-blocked carriers after aks-spec-verification-loop changed state.

## Outcome

Choosing `fix_root_cause` because the current breach came from a specific stale blocked-link reference in live task-tree metadata, that reference was safely removed through the supported task-tree save path in this session, and the live integrity/metric checks can now validate the repair.

## Next validation

Wait for the next `metrics-snapshot` / alert refresh to move persisted `metrics.current` from `1` to `0` and auto-clear alert `3672`.
