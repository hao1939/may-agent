# Reconcile `package-partial` compact frontier for `network-cni` — 2026-07-16

- Task: `reconcile-compact-loop-package-partial`
- Attempt: `a_reconcile-compact-loop-package-partial_20260716105029`
- Subject: feature-family `network-cni`
- Target: `staging`
- Branch: `dev`
- Checked at: `2026-07-16T10:53:31Z`
- Repo HEAD: `eceacb337`

## Outcome

No rerun or requeue is truthful in this worker pass.

The task input fingerprint still matches the current compact authority paths, but the task-context error fingerprint is stale: it still describes a **12-member** active frontier, while the current accepted compact diagnostics plus app-owned feature-compact state preserve the sharper **14-member** active frontier introduced by the 2026-07-14 single-spec live blocker reconciliation.

The current exact family state remains:

- `53` `compactLiveReadiness.readySpecIds` remain non-empty
- `14` active-frontier blocked members remain excluded from live dispatch
- `2` consumed pass-history members remain preserved as non-active residue
- `packageStatus = partial`
- `liveDispatchGate.allowed = false`

So the truthful next action is to **keep the exact wait**, refresh stale controller-visible summary metadata, and avoid reopening an unchanged broad compact rerun.

## Input fingerprint comparison

Task context input fingerprint:

```json
{"branch":"dev","diagnosticspath":"features/network-cni/compact/staging.diagnostics.json","featurekey":"network-cni","planpath":"features/network-cni/compact/staging.plan.json","target":"staging"}
```

Observed current authority:

- branch: `dev`
- diagnostics: `features/network-cni/compact/staging.diagnostics.json`
- plan: `features/network-cni/compact/staging.plan.json`
- target: `staging`

Result: **match**. No carrier/package input changed.

## Error fingerprint comparison

Task context error fingerprint said:

```json
{"failureclass":"package-partial","reason":"resume only when one of the 12 active-frontier members materially changes, is reclassified, or is replaced by sharper same-lineage evidence, or when materially new same-path verification intent reopens spec.network-cni.azure-overlay-dual-stack-migration, spec.network-cni.azure-overlay-podcidr-expansion. do not rerun the broad compact package unchanged.","resultpath":"runs/test-results/feature-compact-network-cni-staging_429383","status":"blocked"}
```

Current compact authority says:

- active frontier count: `14`
- consumed pass history count: `2`
- current resume condition: preserve the exact 14-member frontier, with
  - `spec.network-cni.vm-prerelease-overlay-cilium-dualstack` represented by `wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703`
  - `spec.network-cni.azure-overlay-ilpip` represented by `domain/retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714`

Result: **stale task-context error fingerprint; current state already carries the sharper 14-member wait truth**.

## Raw facts preserved

### Current compact authority

From `features/network-cni/compact/staging.diagnostics.json` and app state:

- ready spec count: `53`
- active frontier count: `14`
- consumed pass-history count: `2`
- active frontier members:
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
- consumed pass history:
  - `spec.network-cni.azure-overlay-dual-stack-migration`
  - `spec.network-cni.azure-overlay-podcidr-expansion`

### Current downstream wait carriers

- shared wait carrier: `wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703`
- exact follow-up leaf: `domain/retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714`
- current app review evidence before this pass: `evidence/archive/ops-apply-reconcile-network-cni-single-spec-live-blockers-20260714.md`

### Current result/run references

- compact check result path: `runs/test-results/feature-compact-network-cni-staging_429383`
- compact check run mode/status from `run.json`: `mode=check`, `status=passed`
- current feature-state workflow run id/url:
  - run id: `172352561`
  - run url: `https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172352561`

### Representative same-lineage blocker excerpts still governing the family

`spec.network-cni.azure-overlay-ilpip`:

- failing phase: `setup.arm-auth`
- failing assertion: `No ARM token available. Set ARM_ACCESS_TOKEN, use GitHub OIDC, or run on managed identity.`
- authority: `../aks-rp-e2e/evidence/archive/domain-verify-network-cni-azure-overlay-ilpip-single-spec-live-verification-20260714.md`

`spec.network-cni.vm-prerelease-overlay-cilium-dualstack`:

- failing phase: ARM create / system-pool VM provisioning
- request/response excerpt: `LinkedAuthorizationFailed` on `Microsoft.Network/virtualNetworks/subnets/join/action`
- authority: `../aks-rp-e2e/evidence/archive/domain-verify-network-cni-vm-prerelease-overlay-cilium-dualstack-single-spec-live-verification-20260714.md`

## Repo-local change review

I checked current repo head and recent file lineage for the exact blocked carriers.

- repo HEAD: `eceacb337`
- recent `features/network-cni` tip commit touching the tree: `48fe3efe3 fix(network-swift-v1): repair NAT Gateway V2 dual-stack setup`
- that newest tree commit touched only:
  - `features/network-cni/tests/network-swift-v1-vnetscale-dual-stack-basic-datapath.ts`
- exact blocked carrier files remain at older governing commits:
  - `features/network-cni/specs/network-cni-azure-overlay-ilpip.json` → `deb3f7702`
  - `features/network-cni/tests/network-cni-azure-overlay-ilpip.ts` → `deb3f7702`
  - `features/network-cni/specs/network-cni-vm-prerelease-overlay-cilium-dualstack.json` → `deb3f7702`
  - `features/network-cni/tests/network-cni-vm-prerelease-overlay-cilium-dualstack.ts` → `deb3f7702`
  - `features/network-cni/specs/network-cni-azure-overlay-dual-stack.json` → `bc2892dda`
  - `features/network-cni/tests/network-cni-azure-overlay-dual-stack.ts` → `1c5d5050f`
- working tree status: clean

Result: no new repo-local change reopened a bounded dependency-clear rerun for the blocked frontier.

## Controller-visible metadata drift repaired in this pass

The app-owned `network-cni` compact-loop state already preserved the correct 14-member wait in `resumeCondition` / `waitingFor`, but two summary surfaces were stale:

- `retryReason` still said `12 active-frontier members`
- `lastSummary` still said `Terminal Azure DevOps pipeline wait observed ... run 172352561`

This pass refreshes those controller-visible summary surfaces to match the current exact 14-member wait and points review evidence at this memo.

## Planner-facing conclusion

Keep the feature-family on its exact preserved wait.

Do **not**:

- rerun the broad `network-cni` compact package unchanged
- collapse the 14-member frontier back to the stale 12-member wording
- treat the non-empty ready set as permission to dispatch the partial compact package

Smallest truthful next move after this worker pass:

- preserve `hold-compact-network-cni-package-partial-frontier-20260709i`
- preserve downstream carrier ownership for `spec.network-cni.vm-prerelease-overlay-cilium-dualstack` and `spec.network-cni.azure-overlay-ilpip`
- resume only when one of the 14 frontier members or the named downstream carrier facts materially changes

FIX_FORWARD_RESULT:
```json
{
  "workflow": "fix-forward",
  "subject": {
    "kind": "feature-family",
    "id": "network-cni"
  },
  "classification": "other-known-class",
  "diagnosis": "Task-context package-partial fingerprint was stale: it still described a 12-member active frontier, but current compact diagnostics and app-owned state already preserve the sharper 14-member network-cni frontier with exact downstream waits for spec.network-cni.vm-prerelease-overlay-cilium-dualstack and spec.network-cni.azure-overlay-ilpip. No new repo-local change reopened a dependency-clear bounded rerun.",
  "minimumDiagnosisPacket": {
    "target": "staging",
    "branch": "dev",
    "runId": "172352561",
    "resultPath": "runs/test-results/feature-compact-network-cni-staging_429383",
    "failingPhase": "frontier-reconciliation",
    "failingAssertion": "stale 12-member package-partial fingerprint vs current 14-member exact wait",
    "requestOrResponseExcerpt": "Current authority preserves 14 active-frontier members and routes spec.network-cni.vm-prerelease-overlay-cilium-dualstack to wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703 plus spec.network-cni.azure-overlay-ilpip to domain/retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714.",
    "referencesChecked": [
      "model/knowledge-map/README.md",
      "design/archive/legacy-replay-execution/automation.md",
      "features/network-cni/compact/staging.diagnostics.json",
      "features/network-cni/compact/staging.summary.md",
      "runs/test-results/feature-compact-network-cni-staging_429383/run.json",
      "evidence/archive/ops-apply-reconcile-network-cni-single-spec-live-blockers-20260714.md",
      "../aks-rp-e2e/evidence/archive/domain-verify-network-cni-azure-overlay-ilpip-single-spec-live-verification-20260714.md",
      "../aks-rp-e2e/evidence/archive/domain-verify-network-cni-vm-prerelease-overlay-cilium-dualstack-single-spec-live-verification-20260714.md"
    ],
    "inputFingerprint": "{\"branch\":\"dev\",\"diagnosticspath\":\"features/network-cni/compact/staging.diagnostics.json\",\"featurekey\":\"network-cni\",\"planpath\":\"features/network-cni/compact/staging.plan.json\",\"target\":\"staging\"}",
    "errorFingerprint": "{\"failureclass\":\"package-partial\",\"reason\":\"resume only when one of the 12 active-frontier members materially changes, is reclassified, or is replaced by sharper same-lineage evidence, or when materially new same-path verification intent reopens spec.network-cni.azure-overlay-dual-stack-migration, spec.network-cni.azure-overlay-podcidr-expansion. do not rerun the broad compact package unchanged.\",\"resultpath\":\"runs/test-results/feature-compact-network-cni-staging_429383\",\"status\":\"blocked\"}"
  },
  "changedFiles": [
    "/app/projects/aks-rp-e2e.app/evidence/archive/reconcile-compact-loop-package-partial-network-cni-20260716.md",
    "/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json"
  ],
  "verification": {
    "runId": "172352561",
    "resultPath": "/app/projects/aks-rp-e2e.app/evidence/archive/reconcile-compact-loop-package-partial-network-cni-20260716.md",
    "status": "pass"
  },
  "nextAction": "exact-wait",
  "nextActionReason": "The current package remains partial with a non-empty ready set but an unchanged exact 14-member blocked frontier; preserving the existing holder and sharper downstream waits is the smallest truthful move."
}
```