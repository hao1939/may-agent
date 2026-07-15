# Reconcile compact loop package-partial sampled frontier — 2026-07-15

- Task: `reconcile-compact-loop-package-partial`
- Attempt: `a_reconcile-compact-loop-package-partial_20260715080951`
- Worker: `aks-explorer`
- Domain head checked: `cb92d29a3`
- Scope: app-owned compact loop state for the assigned sampled family (`egress-lockdown`, `machines-agentpool`, `net-integration`, `rp-nodepool-lifecycle`, `traffic-alb-controller`)

## Subject

Feature family `package-partial` on target `staging` / branch `dev`.

## Decision

No bounded rerun was truthful in this pass. All five sampled features kept the same input fingerprint, and the only material fingerprint change was that `rp-nodepool-lifecycle` had a **stale broader error fingerprint** in task context while current diagnostics now narrow it to one exact rollback wait. I updated controller-visible state to preserve the exact holders and the current ready subsets from diagnostics instead of reopening unchanged work.

## Per-feature comparison and preserved raw facts

### egress-lockdown

- Input fingerprint: unchanged (`{"branch":"dev","diagnosticspath":"features/egress-lockdown/compact/staging.diagnostics.json","featurekey":"egress-lockdown","planpath":"features/egress-lockdown/compact/staging.plan.json","target":"staging"}`)
- Exact holder preserved: `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
- Ready spec ids now surfaced from diagnostics: spec.egress-lockdown.vm-prerelease-vhd-matrix
- Run/result anchor: run `171607915`; result path `.state/feature-compact-loop/artifacts/171607915/runs/test-results/feature-compact-egress-lockdown-staging_249481/result.json`
- Current selection blocker: `repo-local-live-ready-filter`
- Diagnosis: Current diagnostics still show one ready member (spec.egress-lockdown.vm-prerelease-vhd-matrix), but the only exact blocked carrier remains wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702 for spec.egress-lockdown.fips. The input fingerprint is unchanged, and the shared-auth owner-return lineage for the ready member is still metadata-only rather than a live dispatch carrier.

### machines-agentpool

- Input fingerprint: unchanged (`{"branch":"dev","diagnosticspath":"features/machines-agentpool/compact/staging.diagnostics.json","featurekey":"machines-agentpool","planpath":"features/machines-agentpool/compact/staging.plan.json","target":"staging"}`)
- Exact holder preserved: `wait-compact-machines-agentpool-run-28809049156-review-20260714`
- Ready spec ids now surfaced from diagnostics: spec.nap.default-machines-pool-cleanup-no-machine-crud
- Run/result anchor: run `28809049156`; result path `runs/test-results/single-nap-default-machines-pool-cleanup-no-machine-crud_449028`
- Current selection blocker: `repo-local-live-ready-filter`
- Diagnosis: Current diagnostics still show one ready member (spec.nap.default-machines-pool-cleanup-no-machine-crud), but the exact same-spec holder wait-compact-machines-agentpool-run-28809049156-review-20260714 already preserves the unchanged reference/validator/request-shape preflight blocker from run 28809049156. The input fingerprint is unchanged and no new repo-local repair landed for that same carrier.

### net-integration

- Input fingerprint: unchanged (`{"branch":"dev","diagnosticspath":"features/net-integration/compact/staging.diagnostics.json","featurekey":"net-integration","planpath":"features/net-integration/compact/staging.plan.json","target":"staging"}`)
- Exact holder preserved: `hold-compact-net-integration-package-partial-frontier`
- Ready spec ids now surfaced from diagnostics: spec.net-integration.authorized-ip-ranges, spec.net-integration.authorized-service-tags, spec.net-integration.auto-assign-hostports, spec.net-integration.cross-tenant-auxiliary-token, spec.net-integration.custom-vnet-kubenet, spec.net-integration.custom-vnet-lifecycle, spec.net-integration.external-acr, spec.net-integration.external-keyvault, spec.net-integration.ipmasq-azure-cni-cidrs, spec.net-integration.ipmasq-dualstack, spec.net-integration.ipmasq-overlay-health, spec.net-integration.multi-subnet-pools, spec.net-integration.natgw-v2-base, spec.net-integration.natgw-v2-dualstack, spec.net-integration.natgw-v2-migration-lb-to-v2, spec.net-integration.natgw-v2-migration-v1-to-v2, spec.net-integration.natgw-v2-migration-v2-to-block, spec.net-integration.natgw-v2-migration-v2-to-lb-blocked, spec.net-integration.natgw-v2-stack-transition, spec.net-integration.node-public-ip, spec.net-integration.node-public-ip-prefix, spec.net-integration.node-public-ip-prefix-dualstack, spec.net-integration.nsg-control, spec.net-integration.nsg-route-table-in-use-vm-prerelease, spec.net-integration.outbound-lb-custom-ip, spec.net-integration.outbound-migration-lb-to-natgw, spec.net-integration.outbound-migration-natgw-to-lb, spec.net-integration.outbound-nat-gateway, spec.net-integration.pod-subnet-delegation, spec.net-integration.service-cidr-custom, spec.net-integration.static-egress-gateway, spec.net-integration.static-egress-vmss, spec.net-integration.user-assigned-nat-gateway, spec.net-integration.vnet-peering
- Run/result anchor: run `172275388`; result path `.state/feature-compact-loop/artifacts/171742498/runs/test-results/feature-compact-net-integration-staging_246969/result.json`
- Current selection blocker: `repo-local-mixed-terminal-and-promotion-frontier`
- Diagnosis: The input fingerprint is unchanged. Current diagnostics still expose a non-empty ready set (34 ready specs), but the authoritative frontier remains mixed: 15 active-frontier quarantined members plus 2 consumed pass-history members. The MultiNIC dualstack/mixed pair stays represented by Microsoft.ContainerService/NetworkingMultiNICPreview registration on subscription 26fe00f8-9173-4872-9134-bb1d2e00343a, so no bounded rerun changed input or diagnosis exists yet.

### rp-nodepool-lifecycle

- Input fingerprint: unchanged (`{"branch":"dev","diagnosticspath":"features/rp-nodepool-lifecycle/compact/staging.diagnostics.json","featurekey":"rp-nodepool-lifecycle","planpath":"features/rp-nodepool-lifecycle/compact/staging.plan.json","target":"staging"}`)
- Exact holder preserved: `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707`
- Ready spec ids now surfaced from diagnostics: spec.rp-nodepool-lifecycle.add-remove, spec.rp-nodepool-lifecycle.agentpool-operations, spec.rp-nodepool-lifecycle.agentpool-upgrade-resume, spec.rp-nodepool-lifecycle.multi-agentpool-runner, spec.rp-nodepool-lifecycle.scale-manual, spec.rp-nodepool-lifecycle.upgrade-nodeimage
- Run/result anchor: run `28721673014`; result path `.state/feature-compact-loop/artifacts/171742526/runs/test-results/feature-compact-rp-nodepool-lifecycle-staging_229423/result.json`
- Current selection blocker: `repo-local-spec-metadata-single-frontier`
- Diagnosis: The task-context error fingerprint was stale: current diagnostics narrow the frontier to one blocked member (spec.rp-nodepool-lifecycle.rollback) with six ready members, not the older mixed promotion frontier. The input fingerprint is unchanged, and no changed input, new rollback-history evidence, or reviewed rerun plan exists for the six ready members, so only the single rollback wait remains truthful.

### traffic-alb-controller

- Input fingerprint: unchanged (`{"branch":"dev","diagnosticspath":"features/traffic-alb-controller/compact/staging.diagnostics.json","featurekey":"traffic-alb-controller","planpath":"features/traffic-alb-controller/compact/staging.plan.json","target":"staging"}`)
- Exact holder preserved: `hold-compact-traffic-alb-controller-package-partial-frontier`
- Ready spec ids now surfaced from diagnostics: spec.traffic-alb-controller.ingress-routing, spec.traffic-alb-controller.upgrade-survival
- Run/result anchor: run `171275475`; result path `runs/test-results/feature-compact-traffic-alb-controller-staging_007672`
- Current selection blocker: `repo-local-mixed-terminal-and-promotion-frontier`
- Diagnosis: Current diagnostics still show two ready members (spec.traffic-alb-controller.ingress-routing and spec.traffic-alb-controller.upgrade-survival), but the exact blocked carrier remains spec.traffic-alb-controller.enable-lifecycle on the cleanup-only authority gap. The input fingerprint is unchanged and no new disable/cleanup authority or accepted lifecycle execution evidence exists, so requeueing unchanged work would be false progress.

## State writeback applied

- Added current `compactLiveReadiness`, `compactSelectionCoverage`, `selectionBlocker`, `packageStatus`, and `liveDispatchGate` from the maintained diagnostics for all five sampled feature rows.
- Normalized `frontierTaskIds` to the exact live holder for `machines-agentpool`, `net-integration`, and `traffic-alb-controller` instead of leaving those rows with empty frontier arrays.
- Backfilled `lastSupportWorkFingerprint` for `egress-lockdown` from the assigned task context and refreshed `inputFingerprint` / `errorFingerprint` for all five sampled rows.
- Narrowed `rp-nodepool-lifecycle` from the stale mixed-promotion summary to the current single rollback frontier while preserving six ready members as visible ready-subset metadata only.
- Refreshed `reviewEvidencePath`, `evidencePaths`, `lastCheckedAt`, `updatedAt`, `lastSummary`, and `summary` to this current-attempt evidence memo.

## Why no rerun was queued

The task is fix-forward, so I did not rerun the same input after the same error without changed input, changed diagnosis, or a new external fact. In this pass:

- `egress-lockdown`: the live wait is still the exact FIPS UDR prerequisite and the ready member still has only shared-auth lineage metadata.
- `machines-agentpool`: run `28809049156` still represents the exact same-spec request-shape/reference/validator blocker for the cleanup-only split.
- `net-integration`: the mixed frontier is unchanged and the MultiNIC dualstack/mixed pair still needs reviewed `Microsoft.ContainerService/NetworkingMultiNICPreview` registration confirmation.
- `rp-nodepool-lifecycle`: the truthful move was to narrow stale state to the single rollback wait, not rerun six unchanged ready members from the old broader fingerprint.
- `traffic-alb-controller`: the cleanup-only authority gap for `spec.traffic-alb-controller.enable-lifecycle` is unchanged, so the two ready members remain visible only as ready-subset metadata.

## FIX_FORWARD_RESULT

```json
{
  "workflow": "fix-forward",
  "subject": {
    "kind": "feature-family",
    "id": "package-partial"
  },
  "classification": "other-known-class",
  "diagnosis": "Controller-visible compact state had drifted from current diagnostics for the sampled package-partial family: all five rows were missing current ready-subset/blocker structures, three rows had empty frontierTaskIds despite exact holders, and rp-nodepool-lifecycle still advertised a stale broader frontier instead of the current single rollback wait. Current diagnostics show no changed input or new external fact that would justify rerunning unchanged members.",
  "minimumDiagnosisPacket": {
    "target": "staging",
    "branch": "dev",
    "runId": "",
    "resultPath": "evidence/archive/reconcile-compact-loop-package-partial-attempt-20260715T081432Z-worker.md",
    "failingPhase": "compact-state-reconciliation",
    "failingAssertion": "controller-visible sampled package-partial rows must preserve exact holders while surfacing non-empty readySpecIds from current diagnostics",
    "requestOrResponseExcerpt": "rp-nodepool-lifecycle task context still described a mixed frontier, but current diagnostics narrow it to one rollback wait with six ready members.",
    "referencesChecked": [
      "features/egress-lockdown/compact/staging.diagnostics.json",
      "features/machines-agentpool/compact/staging.diagnostics.json",
      "features/net-integration/compact/staging.diagnostics.json",
      "features/rp-nodepool-lifecycle/compact/staging.diagnostics.json",
      "features/traffic-alb-controller/compact/staging.diagnostics.json",
      ".state/feature-compact-loop/state.json"
    ],
    "inputFingerprint": "five assigned staging/dev compact plan+diagnostics fingerprints unchanged",
    "errorFingerprint": "rp-nodepool-lifecycle narrowed from stale mixed frontier to single rollback wait; other four features preserved existing exact holders without changed rerun inputs"
  },
  "changedFiles": [
    ".state/feature-compact-loop/state.json",
    "evidence/archive/reconcile-compact-loop-package-partial-attempt-20260715T081432Z-worker.md"
  ],
  "verification": {
    "runId": "",
    "resultPath": "evidence/archive/reconcile-compact-loop-package-partial-attempt-20260715T081432Z-worker.md",
    "status": "not-run"
  },
  "nextAction": "done",
  "nextActionReason": "The requested bounded repair was controller-visible backlog reconciliation, and the truthful result for this pass is preserved exact waits plus refreshed ready-subset state rather than an unchanged rerun."
}
```
