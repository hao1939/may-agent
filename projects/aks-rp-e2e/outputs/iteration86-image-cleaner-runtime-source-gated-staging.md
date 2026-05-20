# Iteration 86 — Image Cleaner runtime source-gated staging

**Feature focus:** source-gate and split the broad `image-cleaner-runtime-lifecycle` unknown before any cloud mutation; execute only bounded Image Cleaner runtime branches if practical.  
**Scope:** Image Cleaner only: public/API profile state, Image Cleaner Kubernetes components, public disable/re-enable runtime cleanup/restoration, and erasure wait classification.  
**Non-goals:** VPA/KEDA, Workload Identity/OIDC, App Routing, ManagedSystem Pool, Node Restriction, bootstrap profile, VirtualMachines/Machines agent pools, and Image Cleaner upgrade/restart survival unless source proves it is cheap and bounded.

## Preflight/source intent

### Current validator Image Cleaner state

First command run exactly as requested:

```bash
cd /app/projects/aks-rp-e2e && {
  echo '===== current validator Image Cleaner unknowns ====='
  cd capability-model
  bun src/validate.ts ../outputs/e2e-capability-model.json | tee /tmp/iteration86-validator.txt | grep -E 'image-cleaner|unknownFeatureIds|failingFeatureIds' -A60 -B8 || true
  cd ..

  echo '===== prior Image Cleaner state evidence ====='
  grep -n "Image Cleaner\|imageCleaner\|image-cleaner\|securityProfile" outputs/iteration62-security-profile-staging.md | head -160

  echo '===== inventory and ranking context ====='
  grep -n "Scenario_ImageCleaner\|Image Cleaner\|image-cleaner" \
    outputs/e2ev3-handwritten-coverage-inventory.md \
    outputs/iteration75-model-driven-probe-selection.md \
    outputs/input-expectation-knowledge-map.md | head -220

  echo '===== handwritten Image Cleaner source on devbox ====='
  ssh devbox "cd /home/hayua/rp && grep -R -n --exclude-dir=.git --exclude-dir=bin --exclude-dir=obj 'Scenario_ImageCleaner\\|ImageCleaner\\|image cleaner\\|image-cleaner\\|eraser\\|interval\\|vulnerable\\|restart\\|upgrade' test/e2ev3/sigs/security/imagecleaner test/e2e 2>/dev/null | head -260"
}
```

Observed validator/model state before this iteration:

- `image-cleaner-state-interval` is already `pass` with evidence `iteration62-security-profile-staging`.
- `image-cleaner-runtime-lifecycle` is `unknown` and groups component presence, disable cleanup, vulnerable-image erasure, and upgrade/restart survival into one feature.
- The same validator run still lists unrelated unknowns and failures, but those are non-goals for this iteration.

Prior Image Cleaner state evidence from `outputs/iteration62-security-profile-staging.md`:

- The active `aks-preview` surface exposed `--enable-image-cleaner`, `--disable-image-cleaner`, and `--image-cleaner-interval-hours` on update; create exposed enable and interval flags.
- Public CLI update with `--enable-image-cleaner --image-cleaner-interval-hours 48` exited successfully.
- Follow-up `az aks show` persisted `securityProfile.imageCleaner.enabled=true` and `intervalHours=48`.
- Iteration62 did **not** inspect Kubernetes Image Cleaner components and did **not** prove vulnerable-image erasure.

Inventory/ranking context:

- `outputs/e2ev3-handwritten-coverage-inventory.md` records `Scenario_ImageCleaner` as under-covered: state/interval evidence exists, but components and actual image erasure are not covered.
- The source-derived intent in that inventory says the handwritten case disables Image Cleaner, proves a vulnerable image remains, re-enables Image Cleaner, waits for eraser completion, then verifies the image is removed across pool types. It also includes interval update and upgrade/restart survival.
- `outputs/iteration75-model-driven-probe-selection.md` ranked Image Cleaner runtime as valuable but explicitly warned that the first pass should be enable/disable/components plus possibly one erasure, not full upgrade/restart lifecycle.

### Handwritten `Scenario_ImageCleaner` source intent

Source inspected on devbox under `/home/hayua/rp/test/e2ev3/sigs/security/imagecleaner/plans/impl.go` and `/home/hayua/rp/test/e2ev3/sigs/security/imagecleaner/suites/checkin.go`.

Key source facts:

- Cluster create mutator sets `securityProfile.imageCleaner.enabled=true` and `intervalHours=168` (`INITIAL_INTERVAL_HOURS`).
- `checkImageCleaner` validates `ImageCleaner.Enabled` equals the expected value and, when enabled, validates `IntervalHours` is either `168` or the updated `42`.
- Runtime component check is bounded: namespace `kube-system`; pod selector `app.kubernetes.io/name=image-cleaner`; clusterrolebinding `eraser-manager-rolebinding`; service accounts `eraser-controller-manager` and `eraser-imagejob-pods`; retry policy is 10 retries at 10 seconds.
- Disable/re-enable uses managed-cluster update mutators that only set `securityProfile.imageCleaner.enabled=false/true`, then checks ARM state and Kubernetes component absence/presence.
- Vulnerable-image erasure is a separate, slower branch: it disables Image Cleaner, creates `kube-system/image-cleaner-test-pod` from `dockerimage.ImageImageCleanerVulnerabilityTest`, verifies the image exists on each node via Azure compute run-command (`ctr -n k8s.io images list | grep <image>`), re-enables Image Cleaner, waits up to 3600 seconds for collector pods with label `eraser.sh/type=collector` to reach `Succeeded`, then verifies image absence on each node via run-command.
- Upgrade survival is a separate branch using `validateManagedCluster.UpgradeWithValidate` with agent-pool upgrade enabled.
- Restart survival is a separate branch using `StopManagedCluster` then `StartManagedCluster`; it is skipped for Automatic SKU.
- Automatic SKU and AGC have branch-specific skips: disabling Image Cleaner is not allowed for Automatic SKU/AGC paths; interval update and stop/start are skipped for Automatic SKU.
- The check-in suite includes a normal `Scenario_ImageCleaner` and an `Automatic_SKU` mutation that skips update steps for Automatic clusters.

### Source-gated run decision

The existing `image-cleaner-runtime-lifecycle` feature is too broad to close honestly in one run. Source shows at least three distinct branches with different timing and observability:

1. **Component lifecycle** — bounded: profile state plus `kube-system` component presence, disable cleanup, and re-enable restoration. The source retry budget is about 100 seconds after each update.
2. **Vulnerable-image erasure** — potentially bounded but long/riskier: requires a vulnerable image, node/run-command access, eraser collector completion wait up to 1 hour, and post-run image absence checks across pool types.
3. **Upgrade/restart survival** — not bounded for this iteration: requires cluster upgrade and stop/start workflows and should not be conflated with component lifecycle.

Therefore this iteration will split the model before cloud mutation. A bounded staging probe is justified only for the **component lifecycle** branch. Vulnerable-image erasure remains deferred unless component lifecycle completes quickly and the source-derived eraser wait/run-command path is still practical; upgrade/restart survival remains a non-goal.

## Model branch decision

The model was updated to replace the stale, over-broad `image-cleaner-runtime-lifecycle` feature with branch-accurate features:

| Feature | Status after iteration86 | Why |
|---|---|---|
| `image-cleaner-state-interval` | Pass, unchanged | Iteration62 already proves public CLI/API state and interval persistence. |
| `image-cleaner-components-lifecycle` | Pass | Iteration86 proves enabled component presence, public disable cleanup, and public re-enable restoration. |
| `image-cleaner-vulnerable-image-erasure` | Unknown | Source requires a vulnerable test image, node run-command checks, and waiting up to 3600 seconds for eraser collector completion; iteration86 did not run this branch. |
| `image-cleaner-upgrade-restart-survival` | Unknown | Source requires cluster upgrade and stop/start restart; iteration86 deliberately did not combine these long operations with component lifecycle. |

`outputs/input-expectation-knowledge-map.md` was updated to remove the stale single-row/API-state-only wording and now separates Image Cleaner state/interval, component lifecycle, vulnerable-image erasure, and upgrade/restart survival.

## Bounded staging execution — component lifecycle branch

### Run identifiers and execution host

Execution was run from `/app/projects/aks-rp-e2e` through `ssh devbox`.

```text
ITERATION86_VARS RG=ic-life-86-202605200523 CL=ic860523 LOC=eastus2 VM=Standard_D4_v3 KUBECONFIG=/tmp/kubeconfig-ic-life-86-202605200523 LOG=/tmp/iteration86-image-cleaner-202605200523.log
```

CLI/staging context:

```json
{
  "name": "aks-preview",
  "path": "/home/hayua/.azure/cliextensions/aks-preview",
  "version": "20.0.0b6"
}
```

```json
{
  "id": "26fe00f8-9173-4872-9134-bb1d2e00343a",
  "name": "AKS INT/Staging Test",
  "tenantId": "72f988bf-86f1-41af-91ab-2d7cd011db47",
  "user": "hayua@microsoft.com"
}
```

Active CLI preflight showed `az aks update` exposes:

```text
--disable-image-cleaner : Disable ImageCleaner Service.
--enable-image-cleaner  : Enable ImageCleaner Service.
--image-cleaner-interval-hours : ImageCleaner scanning interval.
```

### Create: Image Cleaner enabled at interval 168

Commands:

```bash
az group create -n ic-life-86-202605200523 -l eastus2 \
  --query '{name:name,location:location,provisioningState:properties.provisioningState}' -o json
az aks create -g ic-life-86-202605200523 -n ic860523 --location eastus2 \
  --node-count 2 --node-vm-size Standard_D4_v3 --enable-managed-identity \
  --enable-image-cleaner --image-cleaner-interval-hours 168 --generate-ssh-keys \
  --query '{name:name,provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,securityProfile:{imageCleaner:securityProfile.imageCleaner}}' -o json
az aks get-credentials -g ic-life-86-202605200523 -n ic860523 \
  --file /tmp/kubeconfig-ic-life-86-202605200523 --overwrite-existing
kubectl --kubeconfig /tmp/kubeconfig-ic-life-86-202605200523 get nodes -o wide
```

Observed create state:

```json
{
  "kubernetesVersion": "1.34",
  "name": "ic860523",
  "provisioningState": "Succeeded",
  "securityProfile": {
    "imageCleaner": {
      "enabled": true,
      "intervalHours": 168
    }
  }
}
```

Node/runtime context:

```text
aks-nodepool1-21823461-vmss000000 Ready v1.34.7 Ubuntu 22.04.5 LTS containerd://1.7.31-1
aks-nodepool1-21823461-vmss000001 Ready v1.34.7 Ubuntu 22.04.5 LTS containerd://1.7.31-1
```

### Enabled runtime surface before disable

Source-expected component checks passed immediately (`component_present_wait_rc=0`):

```text
attempt=1 count=1 running=1 crb=1 sa1=1 sa2=1
```

ARM state after wait:

```json
{
  "kubernetesVersion": "1.34",
  "name": "ic860523",
  "provisioningState": "Succeeded",
  "securityProfile": {
    "imageCleaner": {
      "enabled": true,
      "intervalHours": 168
    }
  }
}
```

Kubernetes surface:

```text
namespace/kube-system

# selector app.kubernetes.io/name=image-cleaner
pod/eraser-controller-manager-7d5c89b7f4-dc2gr 1/1 Running

deployment.apps/eraser-controller-manager 1/1 image=mcr.microsoft.com/oss/v2/eraser/eraser-manager:v1.4.0-10

clusterrolebinding.rbac.authorization.k8s.io/eraser-manager-rolebinding
serviceaccount/eraser-controller-manager
serviceaccount/eraser-imagejob-pods

# named Image Cleaner / eraser resources in kube-system
pod/eraser-aks-nodepool1-21823461-vmss000000-dch78
pod/eraser-aks-nodepool1-21823461-vmss000001-wqst4
pod/eraser-controller-manager-7d5c89b7f4-dc2gr
deployment.apps/eraser-controller-manager
replicaset.apps/eraser-controller-manager-7d5c89b7f4
configmap/eraser-manager-config
configmap/eraser-system-exclusion
secret/sh.helm.release.v1.aks-managed-image-cleaner.v1
secret/sh.helm.release.v1.aks-managed-image-cleaner.v2
serviceaccount/eraser-controller-manager
serviceaccount/eraser-imagejob-pods

# collector pods
pod/eraser-aks-nodepool1-21823461-vmss000000-dch78 3/3 Running label=eraser.sh/type=collector
pod/eraser-aks-nodepool1-21823461-vmss000001-wqst4 3/3 Running label=eraser.sh/type=collector
```

Note: `kubectl get` emitted transient `metrics.k8s.io/v1beta1` memcache errors early in the cluster lifetime, but the resource queries returned the Image Cleaner objects above and `kubectl get nodes` succeeded.

### Disable: public state false and components removed

Command:

```bash
az aks update -g ic-life-86-202605200523 -n ic860523 --disable-image-cleaner \
  --query '{name:name,provisioningState:provisioningState,securityProfile:{imageCleaner:securityProfile.imageCleaner}}' -o json
```

Observed update result:

```json
{
  "name": "ic860523",
  "provisioningState": "Succeeded",
  "securityProfile": {
    "imageCleaner": {
      "enabled": false,
      "intervalHours": 168
    }
  }
}
```

Immediate and after-wait Kubernetes cleanup both showed no matching controller/collector resources. Source-expected absent check passed immediately (`component_absent_wait_rc=0`):

```text
attempt=1 count=0 running=0 crb=0 sa1=0 sa2=0
```

After-disable surface:

```text
namespace/kube-system

# pods selector app.kubernetes.io/name=image-cleaner
No resources found in kube-system namespace.

# deployments/daemonsets/services selector app.kubernetes.io/name=image-cleaner
No resources found in kube-system namespace.

Error from server (NotFound): clusterrolebindings.rbac.authorization.k8s.io "eraser-manager-rolebinding" not found
Error from server (NotFound): serviceaccounts "eraser-controller-manager" not found
Error from server (NotFound): serviceaccounts "eraser-imagejob-pods" not found

# collector pods
No resources found in kube-system namespace.
```

### Re-enable: public state true and components restored

Command:

```bash
az aks update -g ic-life-86-202605200523 -n ic860523 \
  --enable-image-cleaner --image-cleaner-interval-hours 168 \
  --query '{name:name,provisioningState:provisioningState,securityProfile:{imageCleaner:securityProfile.imageCleaner}}' -o json
```

Observed update result:

```json
{
  "name": "ic860523",
  "provisioningState": "Succeeded",
  "securityProfile": {
    "imageCleaner": {
      "enabled": true,
      "intervalHours": 168
    }
  }
}
```

Source-expected present check passed immediately (`component_reenabled_wait_rc=0`):

```text
attempt=1 count=1 running=1 crb=1 sa1=1 sa2=1
```

After-reenable surface:

```text
namespace/kube-system

# selector app.kubernetes.io/name=image-cleaner
pod/eraser-controller-manager-7d5c89b7f4-sjj7q 1/1 Running

deployment.apps/eraser-controller-manager 1/1 image=mcr.microsoft.com/oss/v2/eraser/eraser-manager:v1.4.0-10

clusterrolebinding.rbac.authorization.k8s.io/eraser-manager-rolebinding
serviceaccount/eraser-controller-manager
serviceaccount/eraser-imagejob-pods

# named Image Cleaner / eraser resources in kube-system
pod/eraser-aks-nodepool1-21823461-vmss000000-bc78b
pod/eraser-aks-nodepool1-21823461-vmss000001-c9fkn
pod/eraser-controller-manager-7d5c89b7f4-sjj7q
deployment.apps/eraser-controller-manager
replicaset.apps/eraser-controller-manager-7d5c89b7f4
configmap/eraser-manager-config
configmap/eraser-system-exclusion
secret/sh.helm.release.v1.aks-managed-image-cleaner.v1
secret/sh.helm.release.v1.aks-managed-image-cleaner.v2
serviceaccount/eraser-controller-manager
serviceaccount/eraser-imagejob-pods

# collector pods
pod/eraser-aks-nodepool1-21823461-vmss000000-bc78b 3/3 Running label=eraser.sh/type=collector
pod/eraser-aks-nodepool1-21823461-vmss000001-c9fkn 3/3 Running label=eraser.sh/type=collector
```

### Vulnerable-image erasure decision

I did **not** attempt the vulnerable-image erasure branch in this iteration. Source makes it a distinct branch with the following additional requirements:

- create a short-lived pod using the e2ev3 vulnerable image `dockerimage.ImageImageCleanerVulnerabilityTest`,
- verify image presence on every agent-pool node with Azure compute run-command and `ctr -n k8s.io images list`,
- re-enable Image Cleaner,
- wait up to 3600 seconds for `eraser.sh/type=collector` pods to reach `Succeeded`,
- re-run node/containerd image checks to prove absence.

That path is valuable, but it should be run as `image-cleaner-vulnerable-image-erasure` with an explicit one-hour wait/run-command budget rather than hidden inside the component lifecycle pass.

### Cleanup

Command/output:

```bash
az group delete -n ic-life-86-202605200523 -y --no-wait
# cleanup_rc=0
```

## Validation

Command:

```bash
cd /app/projects/aks-rp-e2e/capability-model
bun src/validate.ts ../outputs/e2e-capability-model.json | tee /tmp/iteration86-validator-after.txt
```

Validator summary after model split/update:

```text
feature image-cleaner-state-interval: pass
feature image-cleaner-components-lifecycle: pass
feature image-cleaner-vulnerable-image-erasure: unknown
feature image-cleaner-upgrade-restart-survival: unknown
```

The full validator summary reported no schema errors, `uncoveredFeatureIds: []`, and the Image Cleaner residuals now appear as branch-specific unknowns rather than the stale `image-cleaner-runtime-lifecycle` aggregate:

```json
{
  "uncoveredFeatureIds": [],
  "failingFeatureIds": [
    "app-routing-default-domain",
    "paf-throttling",
    "managedsystem-pool-cli-create-cluster",
    "managedsystem-pool-cli-add-existing",
    "virtualmachines-agentpool-cli-add-multi-sku",
    "app-routing-default-domain-tls-secret"
  ],
  "unknownFeatureIds_tail": [
    "node-restriction-tag-only-patch-shape",
    "managedsystem-single-pool-constraint",
    "managedsystem-reconcile-preservation",
    "image-cleaner-vulnerable-image-erasure",
    "image-cleaner-upgrade-restart-survival"
  ]
}
```

## Verdict

`image-cleaner-components-lifecycle` is a staging **PASS**: public create/update profile state and source-expected Kubernetes eraser/Image Cleaner components reconcile correctly across enable, disable, and re-enable. The old `image-cleaner-runtime-lifecycle` aggregate was split because component lifecycle, actual vulnerable-image erasure, and upgrade/restart survival have different observation costs and should not share one verdict.

Next best Image Cleaner-specific probe: `image-cleaner-vulnerable-image-erasure`, but only when the run explicitly budgets up to one hour for eraser completion plus Azure node run-command checks. Upgrade/restart survival should remain deferred to an upgrade/restart-focused run.
