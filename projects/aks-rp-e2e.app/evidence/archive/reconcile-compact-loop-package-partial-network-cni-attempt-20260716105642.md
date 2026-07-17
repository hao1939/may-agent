# Reconcile `package-partial` compact frontier for `network-cni` — attempt `a_reconcile-compact-loop-package-partial_20260716105642`

- Task: `reconcile-compact-loop-package-partial`
- Attempt: `a_reconcile-compact-loop-package-partial_20260716105642`
- Subject: feature-family `network-cni`
- Target: `staging`
- Branch: `dev`
- Prior memo intentionally reused as exact authority: `evidence/archive/reconcile-compact-loop-package-partial-network-cni-20260716.md`

## Review correction addressed in this attempt

This retry does **not** broaden, rerun, or reclassify the `network-cni` compact family.
It fixes the review finding `compact-fix-forward-evidence-not-fresh` by writing a
fresh attempt-specific memo and by carrying explicit `evidenceFreshness: "reused-exact"`
metadata in the structured result.

## Current authority revalidated

Sources checked in this attempt:

- `model/knowledge-map/README.md`
- `design/archive/legacy-replay-execution/automation.md`
- `features/network-cni/compact/staging.diagnostics.json`
- `features/network-cni/compact/staging.summary.md`
- `runs/test-results/feature-compact-network-cni-staging_429383/run.json`
- `evidence/archive/domain-verify-network-cni-azure-overlay-ilpip-single-spec-live-verification-20260714.md`
- `evidence/archive/domain-verify-network-cni-vm-prerelease-overlay-cilium-dualstack-single-spec-live-verification-20260714.md`
- `../aks-rp-e2e.app/evidence/archive/ops-apply-reconcile-network-cni-single-spec-live-blockers-20260714.md`
- `../aks-rp-e2e.app/.state/feature-compact-loop/state.json`
- prior reconciliation memo `evidence/archive/reconcile-compact-loop-package-partial-network-cni-20260716.md`

Read-order note: the worker instruction names `replays/execution/automation.md`, but that path is absent in this checkout; the checked project equivalent is `design/archive/legacy-replay-execution/automation.md`.

## Current authority snapshot

A current read of compact diagnostics plus app state still shows:

- `packageStatus = partial`
- `liveDispatchGate.allowed = false`
- `compactLiveReadiness.readySpecIds` count = `53`
- `compactLiveReadiness.activeFrontierSpecIds` count = `14`
- `compactLiveReadiness.consumedPassHistorySpecIds` count = `2`
- exact holder task = `hold-compact-network-cni-package-partial-frontier-20260709i`
- represented sharp same-lineage waits remain:
  - `spec.network-cni.vm-prerelease-overlay-cilium-dualstack` -> `wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703`
  - `spec.network-cni.azure-overlay-ilpip` -> `domain/retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714`

Current active frontier members remain exactly:

- `spec.network-cni.azure-overlay-agic-vm-prerelease`
- `spec.network-cni.azure-overlay-dual-stack`
- `spec.network-cni.azure-overlay-ilpip`
- `spec.network-cni.kubenet-network-policy-calico`
- `spec.network-cni.none-byo-cni-vm-prerelease-lifecycle`
- `spec.network-cni.vm-prerelease-azure-npm-matrix`
- `spec.network-cni.vm-prerelease-azure-overlay-multi-subnet-matrix`
- `spec.network-cni.vm-prerelease-azure-overlay-upgrade-matrix`
- `spec.network-cni.vm-prerelease-calico-eno-migration-matrix`
- `spec.network-cni.vm-prerelease-calico-matrix`
- `spec.network-cni.vm-prerelease-cilium-matrix`
- `spec.network-cni.vm-prerelease-npm-uninstall-matrix`
- `spec.network-cni.vm-prerelease-overlay-cilium-dualstack`
- `spec.network-swift-v1.dynamic-ip-allocation`

Consumed pass-history members remain exactly:

- `spec.network-cni.azure-overlay-dual-stack-migration`
- `spec.network-cni.azure-overlay-podcidr-expansion`

## Input fingerprint comparison

Task context input fingerprint:

```json
{"branch":"dev","diagnosticspath":"features/network-cni/compact/staging.diagnostics.json","featurekey":"network-cni","planpath":"features/network-cni/compact/staging.plan.json","target":"staging"}
```

Current authority still matches that same carrier set exactly.

Result: **match**.

## Error fingerprint comparison

Task context error fingerprint still says the preserved wait is the stale **12-member** frontier:

```json
{"failureclass":"package-partial","reason":"resume only when one of the 12 active-frontier members materially changes, is reclassified, or is replaced by sharper same-lineage evidence, or when materially new same-path verification intent reopens spec.network-cni.azure-overlay-dual-stack-migration, spec.network-cni.azure-overlay-podcidr-expansion. do not rerun the broad compact package unchanged.","resultpath":"runs/test-results/feature-compact-network-cni-staging_429383","status":"blocked"}
```

Current accepted authority remains sharper than that task-context fingerprint:

- preserved active frontier count is `14`, not `12`
- the exact represented waits still route
  - `spec.network-cni.vm-prerelease-overlay-cilium-dualstack` to `wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703`
  - `spec.network-cni.azure-overlay-ilpip` to `domain/retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714`

Result: **task-context error fingerprint remains stale; current app/domain authority already preserves the sharper exact 14-member wait**.

## Raw fact packet preserved for this attempt

### Compact run/result authority

- compact validation run id: `172352561`
- compact result root: `runs/test-results/feature-compact-network-cni-staging_429383`
- `run.json` status: `passed`
- `run.json` mode: `check`
- workflow URL: `https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172352561`

### Exact downstream blocker facts still governing the frontier

`spec.network-cni.azure-overlay-ilpip`

- exact authority: `evidence/archive/domain-verify-network-cni-azure-overlay-ilpip-single-spec-live-verification-20260714.md`
- failing phase: `setup.arm-auth`
- failing assertion: `No ARM token available. Set ARM_ACCESS_TOKEN, use GitHub OIDC, or run on managed identity.`
- excerpt: `ARM auth failed: No ARM token available. Set ARM_ACCESS_TOKEN, use GitHub OIDC, or run on managed identity.`

`spec.network-cni.vm-prerelease-overlay-cilium-dualstack`

- exact authority: `evidence/archive/domain-verify-network-cni-vm-prerelease-overlay-cilium-dualstack-single-spec-live-verification-20260714.md`
- failing phase: ARM create / system-pool VM provisioning
- failing assertion: `LinkedAuthorizationFailed`
- excerpt: `does not have permission to perform action(s) 'Microsoft.Network/virtualNetworks/subnets/join/action'`

### Repo-local change review reused in this attempt

Current repo inspection still does not reopen a bounded dependency-clear rerun:

- repo HEAD: `eceacb337`
- latest `features/network-cni` commit: `48fe3efe3 fix(network-swift-v1): repair NAT Gateway V2 dual-stack setup`
- exact blocked carrier files remain under prior governing lineage commit `deb3f7702`
- working tree remained clean when checked

## Truthful decision

No bounded repo-local rerun or repair became newly truthful in this attempt.
The non-empty ready set remains real, but the package is still partial and the
same exact 14-member frontier still blocks live compact dispatch. The smallest
truthful move remains to preserve the exact wait rather than reopen an unchanged
broad compact package.

## State writeback from this attempt

This attempt updates controller-visible app state only to point review surfaces
at this fresh memo while preserving the unchanged exact-wait decision.

- `reviewEvidencePath` -> `evidence/archive/reconcile-compact-loop-package-partial-network-cni-attempt-20260716105642.md`
- `lastSummary` refreshed to cite this attempt-specific memo

## Planner-facing conclusion

Keep the exact preserved wait.

Do **not**:

- rerun the broad `network-cni` compact package unchanged
- collapse the 14-member frontier back to stale 12-member wording
- replace the sharp downstream carriers with a generic family placeholder

Resume only when one of the 14 active-frontier members materially changes, one
of the named downstream carrier facts materially changes, or materially new
same-path verification intent reopens the consumed pass-history members.

FIX_FORWARD_RESULT:
```json
{
  "workflow": "fix-forward",
  "subject": {
    "kind": "feature-family",
    "id": "network-cni"
  },
  "classification": "other-known-class",
  "evidenceFreshness": "reused-exact",
  "diagnosis": "Previous attempt evidence remained exact on retry: current compact diagnostics still show packageStatus=partial, liveDispatchGate.allowed=false, 53 ready specs, 14 active-frontier blocked members, and 2 consumed pass-history members. This attempt only repairs the freshness guard by writing a new attempt-specific memo that explicitly marks the prior authoritative reconciliation as reused-exact; no bounded dependency-clear rerun or sharper replacement evidence emerged.",
  "minimumDiagnosisPacket": {
    "target": "staging",
    "branch": "dev",
    "runId": "172352561",
    "resultPath": "runs/test-results/feature-compact-network-cni-staging_429383",
    "failingPhase": "frontier-reconciliation",
    "failingAssertion": "task-context stale 12-member package-partial fingerprint vs current preserved 14-member exact wait",
    "requestOrResponseExcerpt": "Current authority still preserves 14 active-frontier members and routes spec.network-cni.vm-prerelease-overlay-cilium-dualstack to wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703 plus spec.network-cni.azure-overlay-ilpip to domain/retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714.",
    "referencesChecked": [
      "model/knowledge-map/README.md",
      "design/archive/legacy-replay-execution/automation.md",
      "features/network-cni/compact/staging.diagnostics.json",
      "features/network-cni/compact/staging.summary.md",
      "runs/test-results/feature-compact-network-cni-staging_429383/run.json",
      "evidence/archive/domain-verify-network-cni-azure-overlay-ilpip-single-spec-live-verification-20260714.md",
      "evidence/archive/domain-verify-network-cni-vm-prerelease-overlay-cilium-dualstack-single-spec-live-verification-20260714.md",
      "../aks-rp-e2e.app/evidence/archive/ops-apply-reconcile-network-cni-single-spec-live-blockers-20260714.md",
      "../aks-rp-e2e.app/evidence/archive/reconcile-compact-loop-package-partial-network-cni-20260716.md",
      "../aks-rp-e2e.app/.state/feature-compact-loop/state.json"
    ],
    "inputFingerprint": "{\"branch\":\"dev\",\"diagnosticspath\":\"features/network-cni/compact/staging.diagnostics.json\",\"featurekey\":\"network-cni\",\"planpath\":\"features/network-cni/compact/staging.plan.json\",\"target\":\"staging\"}",
    "errorFingerprint": "{\"failureclass\":\"package-partial\",\"reason\":\"resume only when one of the 12 active-frontier members materially changes, is reclassified, or is replaced by sharper same-lineage evidence, or when materially new same-path verification intent reopens spec.network-cni.azure-overlay-dual-stack-migration, spec.network-cni.azure-overlay-podcidr-expansion. do not rerun the broad compact package unchanged.\",\"resultpath\":\"runs/test-results/feature-compact-network-cni-staging_429383\",\"status\":\"blocked\"}",
    "evidenceFreshness": "reused-exact"
  },
  "changedFiles": [
    "/app/projects/aks-rp-e2e.app/evidence/archive/reconcile-compact-loop-package-partial-network-cni-attempt-20260716105642.md",
    "/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json"
  ],
  "verification": {
    "runId": "172352561",
    "resultPath": "/app/projects/aks-rp-e2e.app/evidence/archive/reconcile-compact-loop-package-partial-network-cni-attempt-20260716105642.md",
    "status": "pass",
    "evidenceFreshness": "reused-exact"
  },
  "nextAction": "exact-wait",
  "nextActionReason": "The package is still partial with a non-empty ready set, but the unchanged exact 14-member frontier and named downstream carriers remain the smallest truthful controller-visible wait."
}
```