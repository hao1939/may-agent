# Fix-forward memo — spec.rp-regional-quota.public-create-path / run 172346097

Task: `fix-rp-regional-quota-public-create-path-run-172346097`
Attempt: `a_fix-rp-regional-quota-public-create-path-run-172346097_20260717000906`
Worker: `app-ops`
Date: `2026-07-17`

## Subject

- kind: `spec`
- id: `spec.rp-regional-quota.public-create-path`
- run: `172346097`
- result path: `workspace/review-rp-regional-quota-public-create-path-run-172346097/20260716T003750Z/slice-01-test-results/runs/test-results/test_20260715162136698_6ymm8c_422653/artifacts/rp-regional-quota-public-create-path/spec-runner/result.json`

## Classification

`capacity-exhausted`

## Diagnosis

The reviewed non-pass was not a product verdict and did not reach the quota-negative `managedClusters PUT` assertion. Azure DevOps run `172346097` stopped at `preflight.target-usage` because the configured staging target in subscription `26fe00f8-9173-4872-9134-bb1d2e00343a` / `westus2` had drifted to `40/161` managed clusters instead of the previously observed exhausted state.

Current repo-local execution posture is already repaired enough to reach that live preflight:

- `bun runner/check-private-source-policy.ts --specs spec.rp-regional-quota.public-create-path` passes.
- `bun runner/check-live-admission.ts --specs spec.rp-regional-quota.public-create-path` passes.
- `bun features/rp-regional-quota/tests/rp-regional-quota-public-create-path.ts --check` passes.

So the smallest truthful fix-forward move was not a blind rerun. It was to remove stale repo truth surfaces that still claimed westus2 was already exhausted and immediately rerunnable, and replace them with the exact external wait condition proved by run `172346097`.

## Raw failure packet

- run id: `172346097`
- run url: `https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172346097`
- request id: `req_20260715184424844_8w7h1c`
- status: `error`
- phase: `completed-with-nonpassing-result`
- failing phase: `preflight.target-usage`
- failing assertion: `target-usage-exhausted`
- target: `staging-westus2`
- branch: `aks-explorer/execute-localdns-westus2-capacity-rerun-20260716`
- artifact refs:
  - `runs/test-results/test_20260715162136698_6ymm8c_422653/artifacts/rp-regional-quota-public-create-path/spec-runner/status.json`
  - `runs/test-results/test_20260715162136698_6ymm8c_422653/artifacts/rp-regional-quota-public-create-path/spec-runner/plan.json`
  - `runs/test-results/test_20260715162136698_6ymm8c_422653/artifacts/rp-regional-quota-public-create-path/spec-runner/summary.md`
- request/response excerpt: none; mutation never ran because live preflight blocked before the decisive create
- blocking summary: `Live quota-negative execution stopped before mutation because the staging target is not currently exhausted: managedClusters=40/161.`
- blocking reason: `Current managed-cluster usage 40/161 does not satisfy the exhausted-target precondition for spec.rp-regional-quota.public-create-path.`
- blocker resume condition: `Rerun only when the same staging subscription+region is back at zero available managed-cluster slots.`

## Input/error fingerprint comparison before rerun decision

The reviewed result bundle did not persist explicit `inputFingerprint` or `errorFingerprint` fields. Before deciding whether to rerun, I computed worker-local fingerprints from the current decisive inputs and the preserved failure packet.

- current input fingerprint: `a97543306076b95b89ccc03ed4b89b4ce8f6520b454e2b39d4a7096e6072e06b`
  - files:
    - `features/rp-regional-quota/specs/rp-regional-quota-public-create-path.json`
    - `features/rp-regional-quota/tests/rp-regional-quota-public-create-path.ts`
    - `features/rp-regional-quota.yaml`
    - `features/rp-regional-quota/notes/public-create-path-target-selection-20260715.md`
    - `runner/targets/staging.json`
- preserved error fingerprint: `077f1e576a0b1cbaed037eb1f7f7685b89762169c800694bbbb901685db00e0e`
  - fields hashed: status=`error`, phase=`completed-with-nonpassing-result`, summary=`...managedClusters=40/161.`, blockedPhase=`preflight.target-usage`, blockerReason, resumeCondition

Judgment: no new external fact proves that the same target is exhausted again, so rerunning now would still violate the exact exhausted-target precondition. The repo-local truth-surface cleanup below changes documentation/truthfulness, not the live target state, so verification stayed local and non-mutating.

## Files changed

To keep the spec slice truthful after the failed live run, I updated these domain files:

1. `features/rp-regional-quota/specs/rp-regional-quota-public-create-path.json`
   - replaced stale `161/161` ready-to-rerun language with the exact `172346097` / `40/161` environment-blocked diagnosis
   - updated `resumeCondition`, `nextAction`, setup intent, and execute-mode wording to require re-proven exhausted target state before rerun
2. `features/rp-regional-quota.yaml`
   - replaced the old “target selection solved / rerun now” gap text with the current external target-state wait
3. `features/rp-regional-quota/notes/public-create-path-target-selection-20260715.md`
   - appended a dated follow-up documenting that repo-local live-admission fixes landed, but run `172346097` proved target exhaustion drift and therefore only an exact wait is truthful now
4. `features/rp-regional-quota/tests/rp-regional-quota-public-create-path.ts`
   - updated repo-truth assertions so `--check` validates the current environment-blocked wait instead of stale `161/161` assumptions

## References checked

Official/API/design/source references reviewed before judgment:

- `https://github.com/Azure/azure-rest-api-specs/blob/main/specification/containerservice/resource-manager/Microsoft.ContainerService/aks/stable/2025-02-01/managedClusters.json`
- `https://learn.microsoft.com/azure/aks/quotas-skus-regions`
- `features/rp-regional-quota/specs/rp-regional-quota-public-create-path.json`
- `features/rp-regional-quota/tests/rp-regional-quota-public-create-path.ts`
- `features/rp-regional-quota.yaml`
- `features/rp-regional-quota/notes/public-reference-check-20260714.md`
- `features/rp-regional-quota/notes/public-create-path-target-selection-20260715.md`
- `runner/targets/staging.json`
- `workspace/review-rp-regional-quota-public-create-path-run-172346097/20260716T003750Z/slice-01-test-results/runs/test-results/test_20260715162136698_6ymm8c_422653/artifacts/rp-regional-quota-public-create-path/spec-runner/result.json`
- `workspace/review-rp-regional-quota-public-create-path-run-172346097/20260716T003750Z/slice-01-test-results/runs/test-results/test_20260715162136698_6ymm8c_422653/artifacts/rp-regional-quota-public-create-path/spec-runner/plan.json`
- `workspace/review-rp-regional-quota-public-create-path-run-172346097/20260716T003750Z/slice-01-test-results/runs/test-results/test_20260715162136698_6ymm8c_422653/artifacts/rp-regional-quota-public-create-path/spec-runner/status.json`
- `workspace/review-rp-regional-quota-public-create-path-run-172346097/20260716T003750Z/slice-01-test-results/runs/test-results/test_20260715162136698_6ymm8c_422653/artifacts/rp-regional-quota-public-create-path/spec-runner/summary.md`

## Verification

Local non-mutating verification performed after the truth-surface cleanup:

```bash
cd /app/projects/aks-rp-e2e && bun features/rp-regional-quota/tests/rp-regional-quota-public-create-path.ts --check
cd /app/projects/aks-rp-e2e && bun runner/check-private-source-policy.ts --specs spec.rp-regional-quota.public-create-path
cd /app/projects/aks-rp-e2e && bun runner/check-live-admission.ts --specs spec.rp-regional-quota.public-create-path
```

Observed results:

- probe `--check`: pass
- private-source policy: pass
- live admission: pass
- no live rerun queued from this task

## Exact wait / planner proposal

Worker cannot emit events. The planner/reviewer should treat this task as evidence for an exact wait on the same spec slice:

- wait subject: `spec.rp-regional-quota.public-create-path`
- wait reason: latest live proof says configured staging target is `40/161`, so the target is not currently exhausted and the decisive quota-negative create would be untruthful
- observer: app/spec reviewer for this slice
- check method: re-read same-surface live usage on subscription `26fe00f8-9173-4872-9134-bb1d2e00343a` in `westus2`, or record a replacement repo-known exhausted target for the same public assertion
- resume condition: only rerun when the same target is back at zero available managed-cluster slots, or when an equivalent exhausted replacement target is recorded
- fallback: if westus2 staging does not return to an exhausted state, create follow-up domain work to select and prove a replacement exhausted target rather than blindly retrying this input

FIX_FORWARD_RESULT:
```json
{
  "workflow": "fix-forward",
  "subject": {
    "kind": "spec",
    "id": "spec.rp-regional-quota.public-create-path"
  },
  "classification": "capacity-exhausted",
  "diagnosis": "Run 172346097 never reached the quota-negative managedClusters PUT. The live probe reached preflight.target-usage, re-measured the configured westus2 staging target at 40/161 managed clusters, and blocked because the exact exhausted-target precondition was false. I updated the spec/probe/packet/note truth surfaces to replace stale 161/161 rerun claims with the exact external wait proved by this run.",
  "minimumDiagnosisPacket": {
    "target": "staging-westus2",
    "branch": "aks-explorer/execute-localdns-westus2-capacity-rerun-20260716",
    "runId": "172346097",
    "resultPath": "workspace/review-rp-regional-quota-public-create-path-run-172346097/20260716T003750Z/slice-01-test-results/runs/test-results/test_20260715162136698_6ymm8c_422653/artifacts/rp-regional-quota-public-create-path/spec-runner/result.json",
    "failingPhase": "preflight.target-usage",
    "failingAssertion": "target-usage-exhausted",
    "requestOrResponseExcerpt": "No ARM create request was sent; preflight blocked with managedClusters=40/161.",
    "referencesChecked": [
      "https://github.com/Azure/azure-rest-api-specs/blob/main/specification/containerservice/resource-manager/Microsoft.ContainerService/aks/stable/2025-02-01/managedClusters.json",
      "https://learn.microsoft.com/azure/aks/quotas-skus-regions",
      "features/rp-regional-quota/specs/rp-regional-quota-public-create-path.json",
      "features/rp-regional-quota/tests/rp-regional-quota-public-create-path.ts",
      "features/rp-regional-quota.yaml",
      "features/rp-regional-quota/notes/public-reference-check-20260714.md",
      "features/rp-regional-quota/notes/public-create-path-target-selection-20260715.md",
      "runner/targets/staging.json",
      "workspace/review-rp-regional-quota-public-create-path-run-172346097/20260716T003750Z/slice-01-test-results/runs/test-results/test_20260715162136698_6ymm8c_422653/artifacts/rp-regional-quota-public-create-path/spec-runner/result.json",
      "workspace/review-rp-regional-quota-public-create-path-run-172346097/20260716T003750Z/slice-01-test-results/runs/test-results/test_20260715162136698_6ymm8c_422653/artifacts/rp-regional-quota-public-create-path/spec-runner/plan.json",
      "workspace/review-rp-regional-quota-public-create-path-run-172346097/20260716T003750Z/slice-01-test-results/runs/test-results/test_20260715162136698_6ymm8c_422653/artifacts/rp-regional-quota-public-create-path/spec-runner/status.json",
      "workspace/review-rp-regional-quota-public-create-path-run-172346097/20260716T003750Z/slice-01-test-results/runs/test-results/test_20260715162136698_6ymm8c_422653/artifacts/rp-regional-quota-public-create-path/spec-runner/summary.md"
    ],
    "inputFingerprint": "a97543306076b95b89ccc03ed4b89b4ce8f6520b454e2b39d4a7096e6072e06b",
    "errorFingerprint": "077f1e576a0b1cbaed037eb1f7f7685b89762169c800694bbbb901685db00e0e"
  },
  "changedFiles": [
    "features/rp-regional-quota/specs/rp-regional-quota-public-create-path.json",
    "features/rp-regional-quota/tests/rp-regional-quota-public-create-path.ts",
    "features/rp-regional-quota/notes/public-create-path-target-selection-20260715.md",
    "features/rp-regional-quota.yaml"
  ],
  "verification": {
    "runId": "",
    "resultPath": "",
    "status": "not-run"
  },
  "nextAction": "exact-wait",
  "nextActionReason": "The repo-local carrier is now truthful about its environment blocker, but the decisive create would still be invalid until same-surface evidence proves an exhausted target again."
}
```
