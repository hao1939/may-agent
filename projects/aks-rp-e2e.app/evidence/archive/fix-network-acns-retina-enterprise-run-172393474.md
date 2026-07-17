# fix-network-acns-retina-enterprise-run-172393474

## Subject
- Spec: `spec.network-acns.retina-enterprise`
- Original reviewed run: `172393474`
- Original result artifact: `/app/projects/aks-rp-e2e/workspace/fix-network-acns-retina-enterprise-run-172310203-domain-followup/20260716T004218Z/download/runs/test-results/test_20260715205835430_wi1aqn_758669/artifacts/network-acns-retina-enterprise/spec-runner/result.json`
- Repair branch: `refs/heads/aks-explorer/fix-network-acns-retina-enterprise-run-172310203-20260715`
- Repair commit: `d6a73b8eb6d70fa8025bd1bde2a152b3d4070a2b`
- Post-repair verification rerun: `172450674`
- Verification run URL: `https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172450674`

## Original failure packet from run `172393474`
- Target: `staging-westus2`
- Branch at failure: `refs/heads/aks-explorer/fix-network-acns-retina-enterprise-run-172310203-20260715`
- Failed phase: `completed-with-nonpassing-result`
- Failed operation/assertion frontier: `op.verify-retina-windows-metrics` / `assert.retina-windows-metrics-available`
- Last passing assertion before failure: `assert.retina-windows-daemonset-ready: Windows Retina DaemonSet: ready=1 desired=1`
- Failing excerpt: `kubectl port-forward exited early: Forwarding from 127.0.0.1:38743 -> 10093 ... failed to connect to localhost:10093 for pod ...`
- Input fingerprint: `apiVersion=2026-05-02-preview;kubernetesVersion=1.33;networkPlugin=azure;networkPluginMode=overlay;advancedNetworking.enabled=true;observability.enabled=true;security.enabled=false;systemPool=Ubuntu:2;userPools=AzureLinux:1+Windows2022:1;vmSize=Standard_D4ads_v6`
- Original error fingerprint: `windows-retina-metrics-kubectl-port-forward-connection-refused`

## Original repair that was already published
The original reviewed failure was a bounded test-code bug, not an AKS product verdict.

Evidence chain for that first fix:
1. The original live artifact showed cluster create, kubeconfig acquisition, Linux Retina checks, and Windows Retina DaemonSet readiness all passed before failure.
2. The failing string was specifically the host-side `kubectl port-forward` path trying to bridge into the Windows Retina pod on port `10093`.
3. Mounted AKS RP source for the same observability family uses an in-cluster debug pod scraping `http://<podIP>:<metricsPort>/metrics`, not host-side port forwarding (`observability/check_factories.go` + `verify_metrics.go`).
4. The repo-local scenario had diverged to a host-side port-forward implementation, which exactly matched the failing surface in run `172393474`.

Published repair in worktree `workspace/fix-network-acns-retina-enterprise-run-172310203-domain-followup-wt`:
- removed the local `kubectl port-forward` metrics probe,
- resolved the target Retina pod name and `status.podIP`,
- launched a short-lived in-cluster curl debug pod in `kube-system`,
- waited for the debug pod to complete and read its logs as the metrics payload,
- always cleaned up the debug pod.

Local verification completed before the rerun:
- `bun features/network-cni/tests/network-acns-retina-enterprise.ts --check` passed before the change.
- The same `--check` command passed after the repair.
- The repair commit was pushed to the branch consumed by the rerun lineage.

## Terminal review of verification rerun `172450674`

This session addressed the redo findings by inspecting the current terminal returned artifacts for run `172450674` instead of reusing the stale nonterminal memo.

### Exact current terminal artifact set
- `/app/projects/aks-rp-e2e/workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/ado-run-show.json`
- `/app/projects/aks-rp-e2e/workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/ado-artifacts.json`
- `/app/projects/aks-rp-e2e/workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/result.json`
- `/app/projects/aks-rp-e2e/workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/spec-runner/result.json`
- `/app/projects/aks-rp-e2e/workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/spec-runner/diagnosis.json`
- `/app/projects/aks-rp-e2e/workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/spec-runner/request.json`
- `/app/projects/aks-rp-e2e/workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/tests/network-acns-retina-enterprise.json`
- `/app/projects/aks-rp-e2e/workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/shared-clusters/shared-exec-cluster-01.json`
- `/app/projects/aks-rp-e2e/workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/stdout.log`

### Terminal facts observed
From `ado-run-show.json`:
- `id=172450674`
- `status=completed`
- `result=failed`
- `sourceBranch=refs/heads/aks-explorer/fix-network-acns-retina-enterprise-run-172310203-20260715`
- `sourceVersion=d6a73b8eb6d70fa8025bd1bde2a152b3d4070a2b`

From `ado-artifacts.json`:
- published artifacts are `plan-inputs` and `slice-01-test-results`

From aggregate `result.json`:
- `status=nonpassing`
- counts: `pass=0`, `fail=0`, `blocked=0`, `error=1`, `skipped=0`
- `specResults[0]` reports `spec.network-acns.retina-enterprise` with `status=error`

From per-spec `spec-runner/result.json` and `stdout.log`:
- `assert.cluster-create-succeeded` passed with `HTTP 200; provisioningState=Succeeded`
- Linux Retina daemonset, operator, configmap, and Linux metrics checks passed
- Windows Retina daemonset readiness passed
- the current failing frontier is now `assert.retina-windows-metrics-available`
- failing excerpt: `Windows Retina metrics: pod=retina-agent-win-zgtc4; port=10093; found prefixes=(none); missing prefixes=networkobservability_; expected prefixes=networkobservability_`
- cleanup still executed: `cleanup.resource-group-delete-requested: HTTP 202`

From `shared-exec-cluster-01.json`:
- `resourceGroup=rg-plan-001-4268-b2mc02-428931`
- `clusterName=aks-plan-001-4268-b2mc02-428931`
- `location=westus2`
- `cleanupStatus=complete`

## Input/error fingerprint comparison before any further rerun
- Prior rerun metadata input fingerprint: `apiVersion=2026-05-02-preview;kubernetesVersion=1.33;networkPlugin=azure;networkPluginMode=overlay;advancedNetworking.enabled=true;observability.enabled=true;security.enabled=false;systemPool=Ubuntu:2;userPools=AzureLinux:1+Windows2022:1;vmSize=Standard_D4ads_v6`
- Current rerun `request.json` target still uses `apiVersion=2026-05-02-preview` and `westus2`, so the intended spec input stayed the same.
- Prior error fingerprint: `windows-retina-metrics-kubectl-port-forward-connection-refused`
- New terminal error fingerprint: `windows-retina-metrics-missing-networkobservability-prefixes`

Conclusion: the transport repair changed the failure frontier. Repeating the same input again without a changed diagnosis or new fix would be a blind rerun.

## Current diagnosis from terminal review
1. **The original transport bug is fixed.** Run `172450674` advanced past the old host-side `kubectl port-forward` connection-refused failure.
2. **The spec still ends non-passing.** The exact per-spec artifact now fails on Windows metrics content rather than on transport.
3. **Mounted-source expectations still require the missing prefix.** `/app/sources/aks-rp/test/e2ev3/sigs/network/plans/acns/observability/platform.go` defines Windows Retina metrics prefixes as `networkobservability_`, and `/app/sources/aks-rp/test/e2ev3/sigs/network/plans/acns/observability/check_factories.go` verifies those prefixes after in-cluster pod-IP scraping. The repo-local repair now matches that scrape transport.
4. **The remaining failure is not yet a proven product verdict.** The live artifact proves a changed error surface, but it does not yet isolate whether the Windows pod emitted empty/non-matching metrics, whether the payload needs deeper diagnostics, or whether another bounded scenario-side content bug remains.

## Planner-facing next step proposal
Do **not** queue another unchanged rerun of `spec.network-acns.retina-enterprise` yet.

The smallest truthful next action is a new bounded domain diagnosis/repair leaf on the Windows Retina metrics content frontier using the exact artifact bundle from run `172450674`, limited to determining why the in-cluster scrape returned no `networkobservability_` prefixes on pod `retina-agent-win-zgtc4`.

SPEC_RESULT_REVIEW:
```json
{
  "workflow": "spec-result-review",
  "specId": "spec.network-acns.retina-enterprise",
  "runId": "172450674",
  "runUrl": "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172450674",
  "resultPath": "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/spec-runner/result.json",
  "specStatus": "error",
  "reason": "The exact same-spec rerun reached a live cluster and advanced past the prior port-forward transport failure, but assert.retina-windows-metrics-available still ended non-passing because pod retina-agent-win-zgtc4 exposed none of the expected networkobservability_ metric prefixes; cleanup still requested resource-group deletion.",
  "liveVerified": false,
  "liveClusterObserved": true,
  "resourceGroup": "rg-plan-001-4268-b2mc02-428931",
  "clusterName": "aks-plan-001-4268-b2mc02-428931",
  "artifactRefs": [
    "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/ado-run-show.json",
    "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/ado-artifacts.json",
    "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/result.json",
    "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/spec-runner/result.json",
    "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/spec-runner/diagnosis.json",
    "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/tests/network-acns-retina-enterprise.json",
    "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/shared-clusters/shared-exec-cluster-01.json",
    "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/stdout.log"
  ],
  "specResults": [
    {
      "specId": "spec.network-acns.retina-enterprise",
      "runId": "172450674",
      "resultPath": "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/spec-runner/result.json",
      "specStatus": "error",
      "reason": "Aggregate result.json marks the spec as error, and the exact spec-runner result/stdout show the run reached assert.retina-windows-metrics-available but found no networkobservability_ metrics on Windows pod retina-agent-win-zgtc4.",
      "liveVerified": false,
      "liveClusterObserved": true,
      "resourceGroup": "rg-plan-001-4268-b2mc02-428931",
      "clusterName": "aks-plan-001-4268-b2mc02-428931",
      "artifactRefs": [
        "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/result.json",
        "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/spec-runner/result.json",
        "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/spec-runner/diagnosis.json",
        "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/tests/network-acns-retina-enterprise.json",
        "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/shared-clusters/shared-exec-cluster-01.json",
        "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/stdout.log"
      ]
    }
  ]
}
```

FIX_FORWARD_RESULT:
```json
{
  "workflow": "fix-forward",
  "subject": {
    "kind": "spec",
    "id": "spec.network-acns.retina-enterprise"
  },
  "classification": "needs-diagnosis",
  "diagnosis": "Run 172450674 proves the bounded transport repair worked: the same-spec rerun advanced beyond the old kubectl port-forward connection-refused failure and reached the Windows metrics content assertion. The remaining live failure is that the in-cluster scrape of Windows pod retina-agent-win-zgtc4 returned no expected networkobservability_ prefixes, and current artifacts do not yet isolate whether that is emitted-metrics absence, payload-shape mismatch, or another bounded scenario-side content bug.",
  "minimumDiagnosisPacket": {
    "target": "staging-westus2",
    "branch": "refs/heads/aks-explorer/fix-network-acns-retina-enterprise-run-172310203-20260715",
    "runId": "172450674",
    "resultPath": "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/spec-runner/result.json",
    "failingPhase": "completed-with-nonpassing-result",
    "failingAssertion": "assert.retina-windows-metrics-available",
    "requestOrResponseExcerpt": "Windows Retina metrics: pod=retina-agent-win-zgtc4; port=10093; found prefixes=(none); missing prefixes=networkobservability_; expected prefixes=networkobservability_",
    "referencesChecked": [
      "features/network-cni/tests/network-acns-retina-enterprise.ts",
      "features/network-cni/tests/network-acns-retina-metrics-verifier.ts",
      "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/ado-run-show.json",
      "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/ado-artifacts.json",
      "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/result.json",
      "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/spec-runner/result.json",
      "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/spec-runner/diagnosis.json",
      "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/spec-runner/request.json",
      "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/stdout.log",
      "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/shared-clusters/shared-exec-cluster-01.json",
      "/app/sources/aks-rp/test/e2ev3/sigs/network/plans/acns/observability/platform.go",
      "/app/sources/aks-rp/test/e2ev3/sigs/network/plans/acns/observability/check_factories.go",
      "/app/sources/aks-rp/test/e2ev3/sigs/network/plans/acns/observability/verify_metrics.go"
    ],
    "inputFingerprint": "apiVersion=2026-05-02-preview;kubernetesVersion=1.33;networkPlugin=azure;networkPluginMode=overlay;advancedNetworking.enabled=true;observability.enabled=true;security.enabled=false;systemPool=Ubuntu:2;userPools=AzureLinux:1+Windows2022:1;vmSize=Standard_D4ads_v6",
    "errorFingerprint": "windows-retina-metrics-missing-networkobservability-prefixes"
  },
  "changedFiles": [
    "../aks-rp-e2e.app/evidence/archive/fix-network-acns-retina-enterprise-run-172393474.md"
  ],
  "verification": {
    "runId": "172450674",
    "resultPath": "workspace/wait-network-acns-retina-enterprise-ado-run-172450674-result/20260716T003750Z/download/runs/test-results/test_20260716021834268_b2mc02_428931/artifacts/network-acns-retina-enterprise/spec-runner/result.json",
    "status": "error"
  },
  "nextAction": "create-domain-repair",
  "nextActionReason": "The exact same-spec verification rerun is already terminal and changed the failure from transport to Windows metrics content. Another unchanged rerun would be blind repetition; the smallest truthful move is a new bounded diagnosis/repair task on the Windows Retina metrics content surface using the artifact-backed failure packet from run 172450674."
}
```
