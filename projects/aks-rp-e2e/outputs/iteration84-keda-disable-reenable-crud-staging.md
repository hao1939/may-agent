# Iteration 84 — KEDA Disable/Re-enable CRUD Lifecycle Staging Probe

**Date:** 2026-05-20  
**Feature focus:** `workload-autoscaler-keda-crud` only  
**Execution host:** planned on `devbox:/home/hayua/rp` via `ssh devbox` from `/app/projects/aks-rp-e2e`  
**Status:** preflight written before any staging mutation; execution evidence below will be appended after the focused probe

## 1. Preflight: current model unknown and prior KEDA evidence

The required first local inspection command was run before any cloud/staging mutation:

```bash
cd /app/projects/aks-rp-e2e && {
  echo '===== current validator KEDA/VPA/ImageCleaner unknowns ====='
  cd capability-model
  bun src/validate.ts ../outputs/e2e-capability-model.json | tee /tmp/iteration84-validator.txt | grep -E 'workload-autoscaler-keda-crud|workload-autoscaler-vpa|image-cleaner-runtime|unknownFeatureIds|failingFeatureIds' -A40 -B5 || true
  cd ..

  echo '===== prior KEDA runtime evidence ====='
  grep -n "KEDA\|ScaledObject\|workloadAutoScalerProfile\|keda.enabled\|runtime" outputs/iteration78-workload-autoscaler-runtime-staging.md | head -120

  echo '===== VPA split context to avoid scope creep ====='
  grep -n "KEDA\|VPA residual\|workload-autoscaler-keda-crud\|Next" outputs/iteration79-vpa-runtime-model-split.md | head -120
}
```

Key preflight findings:

- Validator still reports `workload-autoscaler-keda-crud` as `unknown` with evidence links to `iteration78-workload-autoscaler-runtime-staging` and `e2ev3-handwritten-coverage-inventory`.
- The same unknown list includes VPA residuals and Image Cleaner runtime, but they are explicit non-goals for this iteration.
- Prior KEDA runtime evidence in `outputs/iteration78-workload-autoscaler-runtime-staging.md` is already a pass for `workload-autoscaler-keda-runtime`: `workloadAutoScalerProfile.keda.enabled=true` persisted; KEDA CRDs/controllers/APIService were present/ready; a cron `ScaledObject` scaled a ready Deployment from 1 to 4 and back to 1.
- Iteration78 explicitly did **not** test KEDA CRUD: it notes `Scenario_Keda_CRUD` separately toggles KEDA false/true and validates resource absence/presence, and that `--disable-keda` was exposed but not used.
- Iteration79 split VPA residuals and explicitly kept `workload-autoscaler-keda-crud` unknown; it warned against another broad KEDA/VPA probe.

## 2. Scope and non-goals

This iteration is **KEDA only** and targets exactly one model feature:

- `workload-autoscaler-keda-crud` — handwritten/source intent: KEDA resources are present when enabled, absent/deactivated after disable, and restored after re-enable.

Inputs and expectation paths under test:

| Model path | Expected observation in this run |
|---|---|
| `workloadAutoScalerProfile.keda.enabled=true` | ARM/profile state after create/enable and re-enable shows `workloadAutoScalerProfile.keda.enabled=true`. |
| `workloadAutoScalerProfile.keda.enabled=false` | ARM/profile state after public disable shows KEDA disabled or absent/false in the profile. |
| `keda.resources.present=true` | KEDA CRDs, `kube-system` KEDA deployments/pods, external metrics APIService if present, and readiness are visible after enable and after re-enable. |
| `keda.resources.absentAfterDisable=true` | KEDA controllers and API surface are removed or deactivated after disable. If some CRDs/APIService remain, classify exactly what remains and whether the runtime/controller surface is absent. |

Explicit non-goals:

- No VPA residual runtime branches: no in-place update, HA/leader-election, cert renewal, Helm metadata, upgrade survival, or grouped VPA roll-up verdict.
- No Image Cleaner, App Routing, ManagedSystem, Node Restriction, Workload Identity/OIDC, NAP, VirtualMachines, or bootstrap profile work.
- No KEDA upgrade or OS-SKU matrix branch.
- A minimal post-reenable `ScaledObject` smoke test is optional only if cheap/reliable after CRUD evidence is collected; CRUD/profile/runtime-surface state is the bounded required scope.

## 3. Planned staging command shape

Use a fresh small staging resource group unless a clearly disposable existing KEDA-enabled staging cluster is safer. The command shape is:

```bash
RG=keda-crud-84-$(date -u +%Y%m%d%H%M)
CL=keda84${RG##*-}
VM=Standard_D4_v3
az account show --query '{name:name,id:id,tenantId:tenantId}' -o json
az extension show -n aks-preview --query '{name:name,version:version,path:path}' -o json
az aks update --help | grep -i -C 2 'enable-keda\|disable-keda'
az group create -n "$RG" -l eastus2 --query '{name:name,location:location,provisioningState:properties.provisioningState}' -o json
az aks create -g "$RG" -n "$CL" --location eastus2 --node-count 2 --node-vm-size "$VM" --enable-managed-identity --generate-ssh-keys --enable-keda --query '{name:name,provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,workloadAutoScalerProfile:workloadAutoScalerProfile}' -o json
az aks show -g "$RG" -n "$CL" --query '{name:name,provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,workloadAutoScalerProfile:workloadAutoScalerProfile}' -o json
az aks get-credentials -g "$RG" -n "$CL" --overwrite-existing
# collect KEDA CRDs/deployments/pods/APIService/readiness
az aks update -g "$RG" -n "$CL" --disable-keda --query '{name:name,provisioningState:provisioningState,workloadAutoScalerProfile:workloadAutoScalerProfile}' -o json
# collect disabled ARM state and runtime cleanup/deactivation evidence
az aks update -g "$RG" -n "$CL" --enable-keda --query '{name:name,provisioningState:provisioningState,workloadAutoScalerProfile:workloadAutoScalerProfile}' -o json
# collect restored ARM state and runtime surface
az group delete -n "$RG" --yes --no-wait
```

## 4. Execution evidence

Execution was run on devbox via:

```bash
cd /app/projects/aks-rp-e2e && ssh devbox 'bash -s' <<'REMOTE' | tee /tmp/iteration84-keda-crud-ssh.log
# script created RG/cluster, collected KEDA surface, disabled KEDA, collected cleanup surface,
# re-enabled KEDA, collected restored surface, and requested async RG deletion.
REMOTE
```

Run identifiers:

```text
ITERATION84_VARS RG=keda-crud-84-202605200425 CL=keda840425 VM=Standard_D4_v3 LOC=eastus2 KUBECONFIG=/tmp/kubeconfig-keda-crud-84-202605200425
```

### 4.1 CLI/staging context

```json
{
  "id": "26fe00f8-9173-4872-9134-bb1d2e00343a",
  "name": "AKS INT/Staging Test",
  "tenantId": "72f988bf-86f1-41af-91ab-2d7cd011db47"
}
{
  "name": "aks-preview",
  "path": "/home/hayua/.azure/cliextensions/aks-preview",
  "version": "20.0.0b6"
}
```

`az aks update --help` exposed both public lifecycle flags:

```text
--disable-keda [Preview] : Disable KEDA workload auto-scaler.
--enable-keda  [Preview] : Enable KEDA workload auto-scaler.
```

### 4.2 Create/enable: ARM profile state and runtime surface present

Commands used:

```bash
az group create -n keda-crud-84-202605200425 -l eastus2   --query '{name:name,location:location,provisioningState:properties.provisioningState}' -o json
az aks create -g keda-crud-84-202605200425 -n keda840425 --location eastus2   --node-count 2 --node-vm-size Standard_D4_v3 --enable-managed-identity   --generate-ssh-keys --enable-keda   --query '{name:name,provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,workloadAutoScalerProfile:workloadAutoScalerProfile}' -o json
az aks show -g keda-crud-84-202605200425 -n keda840425   --query '{name:name,provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,workloadAutoScalerProfile:workloadAutoScalerProfile}' -o json
az aks get-credentials -g keda-crud-84-202605200425 -n keda840425 --overwrite-existing
```

Observed create/show profile state:

```json
{
  "kubernetesVersion": "1.34",
  "name": "keda840425",
  "provisioningState": "Succeeded",
  "workloadAutoScalerProfile": {
    "keda": { "enabled": true },
    "verticalPodAutoscaler": null
  }
}
```

Kubernetes server/node context:

```text
Server Version: v1.34.7
aks-nodepool1-13056044-vmss000000 Ready Ubuntu 22.04.5 LTS containerd://1.7.31-1
aks-nodepool1-13056044-vmss000001 Ready Ubuntu 22.04.5 LTS containerd://1.7.31-1
```

Runtime KEDA surface after create/enable:

```text
customresourcedefinition.apiextensions.k8s.io/cloudeventsources.eventing.keda.sh
customresourcedefinition.apiextensions.k8s.io/clustercloudeventsources.eventing.keda.sh
customresourcedefinition.apiextensions.k8s.io/clustertriggerauthentications.keda.sh
customresourcedefinition.apiextensions.k8s.io/scaledjobs.keda.sh
customresourcedefinition.apiextensions.k8s.io/scaledobjects.keda.sh
customresourcedefinition.apiextensions.k8s.io/triggerauthentications.keda.sh

deployment.apps/keda-admission-webhooks           2/2     2            2
deployment.apps/keda-operator                     2/2     2            2
deployment.apps/keda-operator-metrics-apiserver   2/2     2            2
pod/keda-admission-webhooks-...                   1/1     Running
pod/keda-operator-...                             1/1     Running
pod/keda-operator-metrics-apiserver-...           1/1     Running
service/keda-admission-webhooks                   ClusterIP ... 443/TCP,8080/TCP
service/keda-operator                             ClusterIP ... 9666/TCP,8080/TCP
service/keda-operator-metrics-apiserver           ClusterIP ... 443/TCP,8080/TCP
poddisruptionbudget.policy/keda-admission-webhooks           1 N/A 1
poddisruptionbudget.policy/keda-operator                     1 N/A 1
poddisruptionbudget.policy/keda-operator-metrics-apiserver   1 N/A 1
```

Detailed deployment readiness and images:

```text
NAME                              READY   UP-TO-DATE   AVAILABLE   AGE     IMAGES
keda-operator                     2/2     2            2           5m13s   mcr.microsoft.com/oss/v2/kedacore/keda:2.17.3-3
keda-operator-metrics-apiserver   2/2     2            2           5m13s   mcr.microsoft.com/oss/v2/kedacore/keda-metrics-apiserver:2.17.3-3
keda-admission-webhooks           2/2     2            2           5m13s   mcr.microsoft.com/oss/v2/kedacore/keda-admission-webhooks:2.17.3-3
available=True reason=Passed message=all checks passed   # v1beta1.external.metrics.k8s.io

deployment "keda-operator" successfully rolled out
deployment "keda-operator-metrics-apiserver" successfully rolled out
deployment "keda-admission-webhooks" successfully rolled out
```

### 4.3 Disable: public profile state false and runtime surface removed

Command used:

```bash
az aks update -g keda-crud-84-202605200425 -n keda840425 --disable-keda   --query '{name:name,provisioningState:provisioningState,workloadAutoScalerProfile:workloadAutoScalerProfile}' -o json
az aks show -g keda-crud-84-202605200425 -n keda840425   --query '{name:name,provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,workloadAutoScalerProfile:workloadAutoScalerProfile}' -o json
```

Observed update/show profile state:

```json
{
  "name": "keda840425",
  "provisioningState": "Succeeded",
  "workloadAutoScalerProfile": {
    "keda": { "enabled": false },
    "verticalPodAutoscaler": null
  }
}
```

The first cleanup poll after disable already showed the three controller deployments were gone and all counted KEDA surface rows were zero:

```text
Error from server (NotFound): deployments.apps "keda-operator" not found
Error from server (NotFound): deployments.apps "keda-operator-metrics-apiserver" not found
Error from server (NotFound): deployments.apps "keda-admission-webhooks" not found
remaining_keda_kubesystem_lines=0 remaining_keda_crds=0 external_metrics_apiservice_rows=0
```

Runtime KEDA surface after disable:

```text
--- CRDs matching keda ---
NO_KEDA_CRDS
--- kube-system KEDA resources ---
NO_KEDA_KUBE_SYSTEM_RESOURCES
--- KEDA deployments readiness ---
Error from server (NotFound): deployments.apps "keda-operator" not found
Error from server (NotFound): deployments.apps "keda-operator-metrics-apiserver" not found
Error from server (NotFound): deployments.apps "keda-admission-webhooks" not found
--- external metrics APIService ---
Error from server (NotFound): apiservices.apiregistration.k8s.io "v1beta1.external.metrics.k8s.io" not found
NO_EXTERNAL_METRICS_APISERVICE
```

Classification: KEDA disable removed the runtime/controller/API surface rather than merely marking it inactive. No KEDA CRDs, kube-system KEDA deployments/pods/services/PDBs, or external metrics APIService remained in the observed surface.

### 4.4 Re-enable: public profile state true and runtime surface restored

Command used:

```bash
az aks update -g keda-crud-84-202605200425 -n keda840425 --enable-keda   --query '{name:name,provisioningState:provisioningState,workloadAutoScalerProfile:workloadAutoScalerProfile}' -o json
az aks show -g keda-crud-84-202605200425 -n keda840425   --query '{name:name,provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,workloadAutoScalerProfile:workloadAutoScalerProfile}' -o json
```

Observed update/show profile state:

```json
{
  "name": "keda840425",
  "provisioningState": "Succeeded",
  "workloadAutoScalerProfile": {
    "keda": { "enabled": true },
    "verticalPodAutoscaler": null
  }
}
```

Re-enable restore polling contained a minor script counter bug: the printed `ready_keda_deployments=0` compared the `READY` column (`2/2`) to the `AVAILABLE` column (`2`), so it never became 3 even while the human-readable deployment rows were ready. The final surface and rollout checks below are the readiness evidence.

Runtime KEDA surface after re-enable:

```text
customresourcedefinition.apiextensions.k8s.io/cloudeventsources.eventing.keda.sh
customresourcedefinition.apiextensions.k8s.io/clustercloudeventsources.eventing.keda.sh
customresourcedefinition.apiextensions.k8s.io/clustertriggerauthentications.keda.sh
customresourcedefinition.apiextensions.k8s.io/scaledjobs.keda.sh
customresourcedefinition.apiextensions.k8s.io/scaledobjects.keda.sh
customresourcedefinition.apiextensions.k8s.io/triggerauthentications.keda.sh

deployment.apps/keda-admission-webhooks           2/2     2            2           6m54s
deployment.apps/keda-operator                     2/2     2            2           6m54s
deployment.apps/keda-operator-metrics-apiserver   2/2     2            2           6m54s
pod/keda-admission-webhooks-...                   1/1     Running   0
pod/keda-operator-...                             1/1     Running   0
pod/keda-operator-metrics-apiserver-...           1/1     Running   0
service/keda-admission-webhooks                   ClusterIP ... 443/TCP,8080/TCP
service/keda-operator                             ClusterIP ... 9666/TCP,8080/TCP
service/keda-operator-metrics-apiserver           ClusterIP ... 443/TCP,8080/TCP
poddisruptionbudget.policy/keda-admission-webhooks           1 N/A 1
poddisruptionbudget.policy/keda-operator                     1 N/A 1
poddisruptionbudget.policy/keda-operator-metrics-apiserver   1 N/A 1
```

Detailed restored deployment/API readiness:

```text
NAME                              READY   UP-TO-DATE   AVAILABLE   AGE     IMAGES
keda-operator                     2/2     2            2           6m56s   mcr.microsoft.com/oss/v2/kedacore/keda:2.17.3-3
keda-operator-metrics-apiserver   2/2     2            2           6m57s   mcr.microsoft.com/oss/v2/kedacore/keda-metrics-apiserver:2.17.3-3
keda-admission-webhooks           2/2     2            2           6m57s   mcr.microsoft.com/oss/v2/kedacore/keda-admission-webhooks:2.17.3-3
available=True reason=Passed message=all checks passed   # v1beta1.external.metrics.k8s.io

deployment "keda-operator" successfully rolled out
deployment "keda-operator-metrics-apiserver" successfully rolled out
deployment "keda-admission-webhooks" successfully rolled out
```

### 4.5 ScaledObject smoke test scope decision

A post-reenable ScaledObject smoke test was not run:

```text
ScaledObject smoke after re-enable skipped: iteration78 already proved KEDA scaling; iteration84 is bounded to CRUD/profile state and Kubernetes runtime surface removal/restoration.
```

This is sufficient for `workload-autoscaler-keda-crud` because the branch under test is lifecycle enable/disable/re-enable and resource absence/presence, while `workload-autoscaler-keda-runtime` already carries the functional scaling pass.

## 5. Verdict and model/map changes

Verdict: **PASS** for `workload-autoscaler-keda-crud`.

Evidence resolving the branch:

- Enable/create persisted `workloadAutoScalerProfile.keda.enabled=true` and installed KEDA CRDs, deployments, services/PDBs, pods, and `v1beta1.external.metrics.k8s.io` APIService with `Available=True`.
- `az aks update --disable-keda` succeeded and persisted `workloadAutoScalerProfile.keda.enabled=false`.
- After disable, KEDA CRDs were absent, kube-system KEDA runtime resources were absent, the three KEDA deployments returned NotFound, and the external metrics APIService returned NotFound.
- `az aks update --enable-keda` succeeded and persisted `workloadAutoScalerProfile.keda.enabled=true` again.
- After re-enable, the same six KEDA CRDs, three 2/2 KEDA deployments, pods/services/PDBs, and external metrics APIService `Available=True` were restored, with all three deployments successfully rolled out.

Model updates performed:

- Added evidence `iteration84-keda-disable-reenable-crud-staging` to `outputs/e2e-capability-model.json`.
- Changed `Scenario_Keda_CRUD` result from `unknown` to `pass` and attached this artifact.
- Changed the KEDA CRUD judgment to `pass` with observed path `keda.resources.present=true` and `keda.resources.absentAfterDisable=true`.

Knowledge-map update performed:

- Updated the Workload autoscaler row and high-density probe section in `outputs/input-expectation-knowledge-map.md` so KEDA CRUD is no longer listed as an open KEDA gap. VPA residuals remain unknown; KEDA upgrade/OS variants remain separate untested branches.

Validation command:

```bash
cd /app/projects/aks-rp-e2e/capability-model
bun src/validate.ts ../outputs/e2e-capability-model.json
```

Validator result after model update: exit 0; `workload-autoscaler-keda-crud` reports `status: pass` and is removed from `unknownFeatureIds`.

## 6. Cleanup

The remote script installed a trap and requested asynchronous deletion of the new staging resource group:

```text
CLEANUP_COMMAND az group delete -n keda-crud-84-202605200425 --yes --no-wait
```

The command returned no error in the captured ssh output. Because this was `--no-wait`, deletion completion was not blocked on in this iteration.
