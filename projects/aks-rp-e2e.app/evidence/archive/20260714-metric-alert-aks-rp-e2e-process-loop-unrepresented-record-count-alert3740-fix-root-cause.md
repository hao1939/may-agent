# Metric alert 3740 fix_root_cause — compact reviewed-exception family holder restore

- Metric: `aks-rp-e2e.process.loop.unrepresented-record-count`
- Alert: `3740`
- Attempt: `a_ops-apply-restore-compact-reviewed-exception-family-holder-20260714_20260714193006`
- Applied at: `2026-07-15T00:03:36.157Z`
- Shared wait restored: `wait-compact-reviewed-exception-live-ready-policy-family-20260702`

## Baseline before repair

The compact-loop runtime still had five blocked features pointing at a shared wait id that no longer existed in the live tree:

- `ccp-coredns`
- `ccp-metricsserver`
- `kms-etcd-encryption`
- `ossku-migration`
- `planned-maintenance`

The archived task record at `.state/tasks/archive/done-leaves-20260714234329224.json` showed why the representation disappeared:

- `trace.stale_wait_closed_by = feature-compact-loop-controller`
- `trace.stale_wait_closed_reason = all spec ids named by this compact wait are already pass in spec-loop state`
- the archived context still named `familyFeatureKeys = ["ccp-coredns","ccp-metricsserver","kms-etcd-encryption","ossku-migration","planned-maintenance"]`

That stale closure left the loop root with the five blocked features still present in compact state but no live blocked carrier task.

## Repair applied

1. Restored `wait-compact-reviewed-exception-live-ready-policy-family-20260702` into the live task tree as a blocked child of `aks-feature-compact-loop`.
2. Marked the restored task as an exact compact wait with `context.featureCompactExactWait = true` so the current controller contract will not stale-close it again merely because one named spec already passed.
3. Reattached the shared family metadata via `context.familyFeatureKeys` / `context.featureKeys` for the five blocked features.
4. Updated `aks-feature-compact-loop.context.workflowProgress` so the five features are once again counted as represented rather than unrepresented blocked residue.

## Before snapshot

```json
{
  "missingTask": true,
  "loopChildrenIncludesWait": false,
  "unrepresentedBlockedCount": 5,
  "unrepresentedNonTerminalCount": 5,
  "unrepresentedBlockedFeatureKeys": [
    "ccp-coredns",
    "ccp-metricsserver",
    "kms-etcd-encryption",
    "ossku-migration",
    "planned-maintenance"
  ],
  "representedFeatureKeys": [
    "aad-rbac",
    "ccp-agent",
    "ccp-autoupgrader-pipeline",
    "ccp-security-patch-os-variants",
    "ccp-underlay-vpa",
    "ccp-vpa-os-arch-variants",
    "cluster-autoscaler",
    "cost-analysis",
    "extension-addon",
    "fleet",
    "hcp-interceptor",
    "jwt-authenticator",
    "localdns",
    "machines-agentpool",
    "managedsystem-pool",
    "net-integration",
    "network-cni",
    "node-ephemeral-os-disk",
    "node-http-proxy",
    "node-http-proxy-trusted-ca",
    "paf-throttling",
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
  ]
}
```

## After snapshot

```json
{
  "restoredTask": {
    "id": "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
    "state": "blocked",
    "status": "blocked",
    "owner": "aks-explorer",
    "conflict_scope": [
      "feature-compact-followup:package-partial",
      "feature:ccp-coredns",
      "feature:ccp-metricsserver",
      "feature:kms-etcd-encryption",
      "feature:machines-agentpool",
      "feature:ossku-migration",
      "feature:planned-maintenance"
    ],
    "context": {
      "familyFeatureKeys": [
        "ccp-coredns",
        "ccp-metricsserver",
        "kms-etcd-encryption",
        "ossku-migration",
        "planned-maintenance"
      ],
      "reviewEvidencePath": "evidence/archive/20260714-metric-alert-aks-rp-e2e-process-loop-unrepresented-record-count-alert3740-fix-root-cause.md",
      "domainEvidencePath": "evidence/archive/reconcile-ccp-metricsserver-ha-compact-holder-20260714.md",
      "lastAddedFeatureKey": "ccp-metricsserver",
      "featureCompactExactWait": true,
      "featureKeys": [
        "ccp-coredns",
        "ccp-metricsserver",
        "kms-etcd-encryption",
        "ossku-migration",
        "planned-maintenance"
      ],
      "restoredFromArchive": ".state/tasks/archive/done-leaves-20260714234329224.json",
      "restoredByMetricAlert": 3740
    },
    "blocker": {
      "condition": "Blocked only while the residual reviewed-exception members in ccp-coredns, ccp-metricsserver, kms-etcd-encryption, planned-maintenance, and ossku-migration remain intentionally excluded from the compact live-ready subset.",
      "category": "external-wait",
      "owner": "aks-explorer",
      "blocked_at": "2026-07-15T00:03:36.157Z",
      "waiting_for": {
        "type": "compact.live-ready.policy",
        "scope": "reviewed-exception-live-ready-family",
        "taskId": "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
        "featureKeys": [
          "ccp-coredns",
          "ccp-metricsserver",
          "kms-etcd-encryption",
          "ossku-migration",
          "planned-maintenance"
        ],
        "target": "staging"
      },
      "observed_by": {
        "workflow": "feature-compact-loop-controller",
        "trigger": "project.task.tick",
        "repairedBy": "app-ops",
        "repairedAt": "2026-07-15T00:03:36.157Z"
      },
      "observation_method": "On each compact-loop tick, verify that the reviewed-exception members named by this shared family wait still remain intentionally excluded from the compact live-ready subset.",
      "next_check_at": "2026-07-15T00:30:00Z",
      "resume_condition": "Resume only on accepted reviewed-exception member reclassification or an intentional compact live-ready policy change; do not broad-rerun unchanged features.",
      "fallback_at": "2026-07-15T18:30:00Z",
      "fallback_action": "If this shared reviewed-exception/live-ready policy wait is still true at fallback, refresh the family evidence or replace it with one sharper exact successor rather than leaving the compact family unrepresented."
    }
  },
  "loopChildrenIncludesWait": true,
  "unrepresentedBlockedCount": 0,
  "unrepresentedNonTerminalCount": 0,
  "unrepresentedBlockedFeatureKeys": [],
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
  ]
}
```

## Result

The shared reviewed-exception/live-ready family wait is live again, the compact loop root now includes it as a blocked child, and `workflowProgress.unrepresentedBlockedCount` / `workflowProgress.unrepresentedNonTerminalCount` are both back to zero in the tracked task tree.
