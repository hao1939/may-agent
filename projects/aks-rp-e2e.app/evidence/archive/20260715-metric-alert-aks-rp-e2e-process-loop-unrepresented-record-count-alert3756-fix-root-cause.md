# Metric alert fix: aks-rp-e2e.process.loop.unrepresented-record-count (alert 3756)

- Applied at: 2026-07-15T02:52:54.084Z
- Attempt: a_ops-apply-represent-net-integration-terminal-review-wait-20260715_20260715033000
- Worker: app-ops

## Root cause
The compact-loop record for `net-integration` had drifted away from its truthful live representation. The archived/reviewed run-172275388 wait was already gone from the live task tree, but feature-compact state still pointed `taskId` and `frontierTaskIds` at that missing wait instead of the surviving exact holder plus the two live fix-forward successors. That left the loop vulnerable to re-reporting `net-integration` as unrepresented whenever workflow progress was recomputed.

## Baseline
- missing live wait before repair: `wait-net-integration-multinic-dualstack-ado-run-172275388-result` was absent from the runtime tree
- loop unrepresented count before this final normalization pass: `0` (already manually repaired once, but not yet durable against recomputation)
- stale feature state taskId before repair: `wait-net-integration-multinic-dualstack-ado-run-172275388-result`
- stale feature state frontierTaskIds before repair: `wait-net-integration-multinic-dualstack-ado-run-172275388-result`
- live successors already present before repair: `fix-net-integration-multinic-dualstack-run-172275388`, `fix-net-integration-multinic-mixed-run-172275388`

## Repair applied
1. Left the missing archived wait absent from the live tree instead of restoring a stale done carrier.
2. Added `feature-compact:net-integration` and `feature:net-integration` scopes to the two live fix-forward successors:
   - `fix-net-integration-multinic-dualstack-run-172275388`
   - `fix-net-integration-multinic-mixed-run-172275388`
3. Rebound feature-compact state for `net-integration` to the exact family holder `hold-compact-net-integration-package-partial-frontier`.
4. Replaced stale missing-wait frontier pointers with the two live successor task ids above.
5. Repaired `aks-feature-compact-loop.context.workflowProgress` so the current runtime tree and compact state agree that no blocked compact feature is unrepresented.

## Post-repair state
- wait still absent after repair: `true` (the archived wait remains history only)
- loop unrepresented count after repair: `0`
- loop unrepresented blocked feature keys after repair: (empty)
- feature state taskId after repair: `hold-compact-net-integration-package-partial-frontier`
- feature state frontierTaskIds after repair: `fix-net-integration-multinic-dualstack-run-172275388`, `fix-net-integration-multinic-mixed-run-172275388`
- live fix-forward successors now carry feature representation scopes for `net-integration`: `true`

## Mutation details

```json
{
  "projectChildren": [
    "aks-spec-verification-loop",
    "aks-feature-reference-loop",
    "aks-feature-compact-loop",
    "wait-shared-westus2-managed-cluster-capacity-family-return-20260703",
    "wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704",
    "wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708",
    "wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709",
    "wait-kms-svc-cert-rotation-underlay-owner-decision-return-20260709",
    "wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711",
    "ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized",
    "ops/wait-disabled-alert-alias-runtime-owner-decision-20260709j-owner-normalized",
    "ops/wait-project-approval-owner-return-primary-blocker-20260713",
    "ops/wait-shared-worker-model-auth-capability-return-20260713",
    "ops-apply-reconcile-spec-loop-error-storage-csi-state-repair",
    "ops-apply-ops-apply-repair-live-wait-archive-regression-unrepresented-loop-record-20260715-task-tree-followup-state-repa",
    "fix-net-integration-multinic-dualstack-run-172275388",
    "fix-net-integration-multinic-mixed-run-172275388",
    "ops-apply-ops-apply-reconcile-compact-net-integration-after-representation-repair-20260715-task-tree-followup-task-tree-"
  ],
  "loopChildren": [
    "hold-compact-aad-rbac-reviewed-exception-trio-frontier",
    "hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b",
    "hold-compact-ccp-agent-reviewed-exception-frontier",
    "hold-compact-ccp-autoupgrader-pipeline-reviewed-exception-frontier",
    "hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier-20260713",
    "hold-compact-ccp-underlay-vpa-reviewed-exception-placement-frontier-20260710",
    "hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier",
    "hold-compact-cluster-autoscaler-five-carrier-frontier-20260714",
    "hold-compact-cost-analysis-reviewed-exception-frontier",
    "hold-compact-extension-addon-reviewed-exception-frontier",
    "hold-compact-fleet-reviewed-exception-split-frontier-20260709",
    "hold-compact-hcp-interceptor-reviewed-exception-frontier",
    "hold-compact-jwt-authenticator-package-partial-frontier",
    "hold-compact-localdns-package-partial-frontier",
    "hold-compact-net-integration-package-partial-frontier",
    "hold-compact-network-cni-package-partial-frontier-20260709i",
    "hold-compact-node-http-proxy-package-partial-frontier-owner-normalized-20260713",
    "hold-compact-paf-throttling-reviewed-exception-frontier-owner-normalized-20260713",
    "hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix",
    "hold-compact-rp-cluster-lifecycle-split-frontier-20260711",
    "hold-compact-secops-package-partial-frontier-20260714",
    "hold-compact-secure-tls-bootstrap-package-partial-frontier-20260707",
    "hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier",
    "hold-compact-storage-csi-successor-pair-and-residual-frontier-20260707",
    "hold-compact-traffic-alb-controller-package-partial-frontier",
    "hold-compact-traffic-applink-cross-cluster-self-contained-carrier-gap-20260707",
    "hold-compact-traffic-applink-upgrade-survival-contract-mismatch-frontier-20260707",
    "hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705",
    "hold-compact-virtualmachine-prerelease-row60-legacy-addon-disable-scaling-reviewed-exception-frontier-owner-normalized-20260713",
    "hold-compact-virtualmachines-agentpool-auto-zone-invalidavailabilityzones-frontier-20260708",
    "hold-compact-virtualmachines-agentpool-cli-add-multi-sku-reviewed-exception-frontier-20260713",
    "hold-compact-virtualmachines-agentpool-row61-oldest-branch-runtime-frontier-20260708",
    "hold-compact-virtualmachines-agentpool-row75-row76-node-readiness-frontier-20260708",
    "hold-compact-virtualmachines-agentpool-split-frontier-maintained-20260708b",
    "hold-compact-windows-eligibility-frontier-20260707",
    "hold-compact-workload-autoscaler-package-partial-frontier",
    "ops/wait-compact-remediator-runtime-owner-review-return-20260709-owner-normalized",
    "wait-compact-machines-agentpool-run-28809049156-review-20260714",
    "wait-compact-managedsystem-cli-default-payload-owner-decision-return-20260711",
    "wait-compact-node-ephemeral-os-disk-resourcedisk-authority-or-reclassify-20260703",
    "wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708",
    "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
    "wait-compact-serverless-multi-pod-burst-runtime-readiness-20260705"
  ],
  "waitPresent": false,
  "waitParentId": null,
  "waitConflictScope": [],
  "waitState": "",
  "waitContextKeys": [],
  "loopProgress": {
    "completionReady": false,
    "reason": "feature-compact loop state still has non-terminal features",
    "pending": 0,
    "running": 0,
    "done": 40,
    "blocked": 44,
    "error": 0,
    "retryBudgetExhausted": 0,
    "maxDirectAttemptsPerFeature": 2,
    "blockedWaitBlockedCount": 39,
    "blockedWaitErrorCount": 0,
    "unrepresentedBlockedCount": 0,
    "unrepresentedErrorCount": 0,
    "unrepresentedNonTerminalCount": 0,
    "unrepresentedBlockedFeatureKeys": [],
    "unrepresentedErrorFeatureKeys": [],
    "unrepresentedRunningFeatureKeys": [],
    "unrepresentedPendingFeatureKeys": [],
    "unrepresentedNonTerminalFeatureKeys": [],
    "activeGithubRuns": 3,
    "githubActiveRunLimit": 5,
    "openChildren": 0,
    "openSupportChildren": 2,
    "blockedWaitChildren": 42,
    "harvestedTerminalGitHubWaits": 0,
    "checkedTerminalGitHubWaits": 0,
    "representedSupportErrorClasses": [
      "package-partial"
    ],
    "representedFeatureKeys": [
      "aad-rbac",
      "ccp-agent",
      "ccp-autoupgrader-pipeline",
      "ccp-coredns",
      "ccp-metricsserver",
      "ccp-security-patch-os-variants",
      "ccp-underlay-vpa",
      "ccp-vpa-os-arch-variants",
      "cluster-autoscaler",
      "cost-analysis",
      "extension-addon",
      "fleet",
      "hcp-interceptor",
      "jwt-authenticator",
      "kms-etcd-encryption",
      "localdns",
      "machines-agentpool",
      "managedsystem-pool",
      "net-integration",
      "network-cni",
      "node-ephemeral-os-disk",
      "node-http-proxy",
      "node-http-proxy-trusted-ca",
      "ossku-migration",
      "paf-throttling",
      "planned-maintenance",
      "private-cluster",
      "remediator-node-not-ready-restart",
      "rp-cluster-lifecycle",
      "secops",
      "secure-tls-bootstrap",
      "serverless",
      "sgx-addon-vm-prerelease-matrix",
      "storage-csi",
      "traffic-alb-controller",
      "traffic-applink",
      "trusted-access",
      "virtualmachine-prerelease-row60-legacy-addon-disable-scaling",
      "virtualmachines-agentpool",
      "virtualmachines-agentpool:auto-zone",
      "virtualmachines-agentpool:cli-add-multi-sku",
      "virtualmachines-agentpool:row61",
      "virtualmachines-agentpool:row75-row76",
      "virtualmachines-agentpool:split-frontier",
      "windows",
      "workload-autoscaler"
    ],
    "activePipelineFeatureKeys": [],
    "activePipelineWaits": [],
    "lastPulseCreated": 0,
    "lastPulseAssigned": 0,
    "updatedAt": "2026-07-15T02:52:54.084Z"
  }
}
```
