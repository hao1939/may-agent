# Domain repair audit: KMS private cluster + VNet integration + private KV carrier no longer shells out to Azure CLI

## Task
- task id: `domain/repair-kms-private-vnet-private-kv-remove-az-cli-20260713`
- spec: `spec.kms.v2-private-vnet-integration-private-kv-lifecycle`
- carrier: `/app/projects/aks-rp-e2e/features/kms-etcd-encryption/tests/kms-v2-private-vnet-integration-private-kv.ts`

## What I verified
The domain repair requested by this task is already present on the current `dev` branch; no new domain edit was required in this session.

### Repair commit lineage
- `git log -1 --stat -- features/kms-etcd-encryption/tests/kms-v2-private-vnet-integration-private-kv.ts` shows the last carrier-changing commit as:
  - commit: `87b67098a6278a7f6b93b1ae25f9c3c8750b9e4f`
  - subject: `fix kms private vnet private kv live admission`
- `git rev-parse HEAD` and `git rev-parse origin/dev` both resolved to `cbccba9bca7566c1525ca33f5cfaa72aa309e3f9` on branch `dev`.
- `git diff 87b67098a6278a7f6b93b1ae25f9c3c8750b9e4f..HEAD -- features/kms-etcd-encryption/tests/kms-v2-private-vnet-integration-private-kv.ts` was empty, so current `dev` still carries that repair unchanged.

### Carrier surface proof
Negative proof:
- `grep -n 'azExec\|execFileSync\|az aks get-credentials\|az keyvault\|az role assignment create' features/kms-etcd-encryption/tests/kms-v2-private-vnet-integration-private-kv.ts`
- Result: no matches.

Positive proof:
- `grep -n 'createVirtualNetwork\|createUserAssignedIdentity\|createKeyVault\|createRoleAssignment\|invokeManagedClusterRunCommand\|nextManagedClusterUpgradeVersion\|mutationGateMatched = mutationEnvValue === REQUIRED_GATE_VALUE' features/kms-etcd-encryption/tests/kms-v2-private-vnet-integration-private-kv.ts`
- Observed helper usage includes:
  - `invokeManagedClusterRunCommand` import and use
  - `createVirtualNetwork` / `createOrUpdateSubnet`
  - `createUserAssignedIdentity`
  - `createKeyVault` / `createVaultKey` / `deleteKeyVault` / `recoverDeletedKeyVault` / `updateKeyVault`
  - `createRoleAssignment`
  - `nextManagedClusterUpgradeVersion`
  - exact gate check `const mutationGateMatched = mutationEnvValue === REQUIRED_GATE_VALUE;`

## Local policy / check verification
Commands run from `/app/projects/aks-rp-e2e`:

```bash
bun runner/check-private-source-policy.ts --specs spec.kms.v2-private-vnet-integration-private-kv-lifecycle
bun runner/check-live-admission.ts --specs spec.kms.v2-private-vnet-integration-private-kv-lifecycle
bun features/kms-etcd-encryption/tests/kms-v2-private-vnet-integration-private-kv.ts --check
```

Observed results:
- private-source policy: `Live execution dependency policy passed for 1 selected spec(s).`
- live admission policy: `Live admission policy passed for 1 selected spec(s).`
- probe `--check`: `Mode: check | Status: pass`, including:
  - correct spec id
  - `19` operations
  - `12` assertions
  - private cluster + VNet integration + private KV API-shape assertions
  - no accidental execute gate in check mode

## Existing same-spec verification rerun already queued
This session did not queue a new pipeline run because the repaired carrier was already queued for same-spec verification when commit `87b67098a6278a7f6b93b1ae25f9c3c8750b9e4f` landed.

Existing queue metadata reviewed from:
- `/app/projects/aks-rp-e2e/workspace/fix-kms-v2-private-vnet-integration-private-kv-lifecycle-run-171990664/20260713T1434Z/ado-run.json`

Queued verification details:
- run id: `171997614`
- run URL: `https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=171997614`
- branch: `refs/heads/dev`
- source version: `87b67098a6278a7f6b93b1ae25f9c3c8750b9e4f`
- target: `staging`
- selected spec: `spec.kms.v2-private-vnet-integration-private-kv-lifecycle`

QUEUED_PIPELINE_RUN:
```json
{
  "backend": "ado",
  "runId": "171997614",
  "runUrl": "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=171997614",
  "specIds": ["spec.kms.v2-private-vnet-integration-private-kv-lifecycle"],
  "target": "staging",
  "branch": "refs/heads/dev",
  "sourceVersion": "87b67098a6278a7f6b93b1ae25f9c3c8750b9e4f",
  "metadataPath": "workspace/fix-kms-v2-private-vnet-integration-private-kv-lifecycle-run-171990664/20260713T1434Z/ado-run.json"
}
```

## Conclusion
Task acceptance is satisfied from current domain state:
- the selected scenario test no longer shells out to Azure CLI;
- the live dependency preflight now passes for `spec.kms.v2-private-vnet-integration-private-kv-lifecycle`;
- the repair is already committed on `dev` and preserved at current `origin/dev` head.

Next truthful step outside this bounded repair task: review Azure DevOps run `171997614` (or a newer exact same-spec successor if one exists) to confirm live staging behavior on the repaired carrier.
