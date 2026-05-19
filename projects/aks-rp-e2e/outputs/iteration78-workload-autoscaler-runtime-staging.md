# Iteration 78 — Workload Autoscaler Runtime Staging Probe

**Date:** 2026-05-19  
**Feature focus:** workload autoscaler runtime behavior for KEDA + overlay VPA  
**Execution host:** `devbox:/home/hayua/rp` via `ssh devbox` from `/app/projects/aks-rp-e2e`  
**Status:** completed; KEDA runtime passed; VPA component/recommendation sub-branch passed; grouped VPA runtime remains partial/unknown for non-goal branches

## Source/e2ev3-derived scope before cloud execution

### Local model precheck

The required first local inspection command was run before remote source inspection. The current capability model has first-class entries for:

- `workload-autoscaler-keda-profile-state`: passed by `iteration61-workload-autoscaler-staging`; profile persistence only.
- `workload-autoscaler-keda-runtime`: unknown source-derived branch for KEDA resource presence and workload scaling.
- `workload-autoscaler-keda-crud`: unknown source-derived branch for disable/re-enable lifecycle.
- `workload-autoscaler-vpa-profile-state`: passed by `iteration61-workload-autoscaler-staging`; profile persistence only.
- `workload-autoscaler-vpa-runtime`: unknown grouped source-derived branch for VPA Helm/components/recommendations/in-place/HA/cert behavior.

`outputs/iteration61-workload-autoscaler-staging.md` was also printed by that command and confirms only public CLI/API profile persistence: `az aks update --enable-keda` persisted `workloadAutoScalerProfile.keda.enabled=true`; `az aks update --enable-vpa` persisted `workloadAutoScalerProfile.verticalPodAutoscaler.enabled=true` while preserving KEDA.

### Handwritten/source paths inspected

Remote source inspection on devbox used:

```bash
ssh devbox 'cd /home/hayua/rp && grep -RIn --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.state "Scenario_Keda\|KEDA\|Scenario_Overlay_VPA\|VerticalPodAutoscaler\|VPA" . | head -200'
ssh devbox 'cd /home/hayua/rp && for f in test/e2ev3/sigs/autoscale/keda/plans/keda.go test/e2ev3/sigs/autoscale/keda/plans/keda_variants.go test/e2ev3/sigs/ccp/plans/overlayvpa.go; do echo ==== $f ====; sed -n "1,260p" $f; done'
ssh devbox 'cd /home/hayua/rp && sed -n "260,620p" test/e2ev3/sigs/autoscale/keda/plans/keda.go && sed -n "200,620p" test/e2ev3/sigs/ccp/plans/overlayvpa.go'
ssh devbox 'cd /home/hayua/rp && sed -n "1,380p" test/e2ev3/sigs/autoscale/keda/plans/keda_resource_validator.go && grep -RIn "type VerifyVpaComponents\|type VerifyVpaRecommendations\|type VerifyVpaInplaceUpdate\|type CreateVpaObjects\|type VerifyVpaHAReplicas\|type VerifyVpaVersions\|type VerifyVpaCertRenewal" test/e2ev3/sigs/ccp/handlers | head -80'
ssh devbox 'cd /home/hayua/rp && for f in test/e2ev3/sigs/ccp/handlers/verify_vpa_components.go test/e2ev3/sigs/ccp/handlers/create_vpa_objects.go test/e2ev3/sigs/ccp/handlers/verify_vpa_recommendations.go test/e2ev3/sigs/ccp/handlers/verify_vpa_inplace_update.go test/e2ev3/sigs/ccp/handlers/verify_vpa_ha_replicas.go test/e2ev3/sigs/ccp/handlers/verify_vpa_versions.go; do echo ==== $f ====; sed -n "1,240p" $f; done'
```

Key source intent found:

- `test/e2ev3/sigs/autoscale/keda/plans/keda.go`
  - `Scenario_Keda` creates a cluster with `mc.Properties.WorkloadAutoScalerProfile.Keda.Enabled=true`, uses a 4-core VM claim/fallback `Standard_D4s_v3`, validates KEDA resources, then validates autoscaling.
  - `validateAutoScaling` creates `default/cron-tests-deployment` with one replica, creates `keda.sh/v1alpha1` `ScaledObject` `cron-tests-scaledobject`, and waits for scale-up to 4 replicas and scale-down to 1 replica.
  - `Scenario_Keda_CRUD` separately toggles KEDA false/true and validates resource absence/presence.
  - `Scenario_Keda_Upgrade` separately validates survival through cluster/agent-pool upgrade.
- `test/e2ev3/sigs/autoscale/keda/plans/keda_resource_validator.go`
  - For Kubernetes 1.33–1.35 (`validateKeda_v2_17`), expected runtime resources include external metrics APIService, KEDA CRDs (`scaledobjects.keda.sh`, `scaledjobs.keda.sh`, trigger authentication CRDs, CloudEventSource CRDs), deployments `keda-operator`, `keda-operator-metrics-apiserver`, `keda-admission-webhooks`, services, service accounts, PDBs, roles/clusterroles/bindings, and `keda-admission` validating webhook.
- `test/e2ev3/sigs/ccp/plans/overlayvpa.go`
  - `Scenario_Overlay_VPA_*` creates clusters with `mc.Properties.WorkloadAutoScalerProfile.VerticalPodAutoscaler.Enabled=true` and feature `VPAPreview`.
  - It checks Helm release `overlay-vpa`, VPA pods (`vpa-admission-controller`, `vpa-recommender`, `vpa-updater`), CRDs/service, component versions, HA replicas/leader election for Kubernetes >=1.34, cert renewal where applicable, test workloads and VPA objects, recommendations, in-place update for Kubernetes >=1.34, upgrade, and repeats post-upgrade checks.
- `test/e2ev3/sigs/ccp/handlers/*.go`
  - `VerifyVpaComponents` requires CRDs `verticalpodautoscalers.autoscaling.k8s.io`, `verticalpodautoscalercheckpoints.autoscaling.k8s.io`, and service `kube-system/vpa-webhook`.
  - `VerifyVpaRecommendations` requires each VPA object to have non-empty `status.recommendation.containerRecommendations[0].target.cpu` and `.target.memory`.
  - `VerifyVpaInplaceUpdate` requires pods to retain UID while resources change; this is a distinct stronger branch.
  - `VerifyVpaHAReplicas` expects recommender/updater replica counts when HA is in scope.

### Input paths tested in this iteration

- `workloadAutoScalerProfile.keda.enabled=true` and `workloadAutoScalerProfile.verticalPodAutoscaler.enabled=true` together on one staging AKS cluster.
- Public CLI create-time path using active `aks-preview` (`az aks create --enable-keda --enable-vpa`) rather than the handwritten internal MC mutator path.
- Kubernetes runtime path through live Kubernetes resources after `az aks get-credentials`.
- KEDA functional path: KEDA CRDs/controllers present; cron `ScaledObject` scales a Deployment up and down.
- VPA bounded functional path: overlay VPA CRDs/service/deployments present; a small workload receives VPA recommendations.

### Expectation paths in scope

- `workload-autoscaler-keda-runtime`
  - KEDA profile persisted in ARM.
  - KEDA core runtime resources present and ready.
  - KEDA `ScaledObject` can drive workload scale-up and scale-down.
- `workload-autoscaler-vpa-runtime` bounded sub-branch
  - VPA profile persisted in ARM.
  - VPA CRDs/service and core deployments are present and ready.
  - A VPA object for a live workload gets CPU and memory recommendations.

### Explicit non-goals

- `workload-autoscaler-keda-crud`: KEDA disable/re-enable lifecycle is **not** tested unless a safe path is identified and separately scoped. The CLI exposes `--disable-keda`, but combining lifecycle toggles with this runtime probe risks hiding runtime failures; it remains unknown/non-goal here.
- `Scenario_Keda_Upgrade` and all upgrade survival paths.
- KEDA OS SKU variant coverage (`Mariner`, `AzureLinux`, `Flatcar`) beyond the default Linux pool used by this run.
- VPA Windows/ARM64/OS-SKU matrix coverage.
- VPA upgrade/post-upgrade behavior.
- VPA cert renewal.
- VPA HA/leader-election branch as a verdict unless the selected Kubernetes version and observed replicas make it unambiguous; otherwise it remains a source-derived branch not closed by this bounded run.
- Full VPA in-place update branch as a verdict unless stable UID-with-resource-change evidence is collected; recommendation/component evidence alone must not be claimed as full in-place success.
- Image Cleaner, Node Restriction, App Routing TLS, Identity/OIDC residuals, bootstrap profile, NAP/VM agent pool, upgrade/HA/cert-renewal branches, or unrelated autoscaler features.

## Staging execution plan

The staging run will use exact devbox commands in this shape:

```bash
az account show --query '{name:name,id:id,tenantId:tenantId}' -o json
az extension show -n aks-preview --query '{name:name,version:version,path:path}' -o json
az aks create --help | grep -i -C 2 'enable-keda\|enable-vpa'
az aks update --help | grep -i -C 2 'enable-keda\|enable-vpa\|disable-keda'
az group create -n <rg> -l eastus2
az aks create -g <rg> -n <cluster> --location eastus2 --node-count 2 --node-vm-size Standard_D4s_v3 --enable-managed-identity --generate-ssh-keys --enable-keda --enable-vpa
az aks show -g <rg> -n <cluster> --query '{provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,workloadAutoScalerProfile:workloadAutoScalerProfile}' -o json
az aks get-credentials -g <rg> -n <cluster> --overwrite-existing
kubectl ... # KEDA and VPA runtime checks/workloads
az group delete -n <rg> --yes --no-wait
```

## Staging commands and observed output

### Environment and CLI context

Commands:

```bash
az account show --query '{name:name,id:id,tenantId:tenantId}' -o json
az extension show -n aks-preview --query '{name:name,version:version,path:path}' -o json
az aks create --help | grep -i -C 2 'enable-keda\|enable-vpa'
az aks update --help | grep -i -C 2 'enable-keda\|enable-vpa\|disable-keda'
```

Observed:

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

The active CLI help exposes `--enable-keda`, `--enable-vpa`, and `--disable-keda`; `--disable-keda` was not used because KEDA CRUD was a non-goal for this runtime pass.

### Cluster create and profile state

First attempt used the source fallback VM size `Standard_D4s_v3` and failed before cluster creation:

```text
RG=wa-runtime-78-202605192032
CL=wa782032
ERROR: (BadRequest) The VM size of Standard_D4s_v3 is not allowed in your subscription in location 'eastus2'.
```

Cleanup was started for that empty/failed resource group:

```bash
az group delete -n wa-runtime-78-202605192032 --yes --no-wait || true
```

The successful run used an allowed 4-core sibling, `Standard_D4_v3`:

```bash
RG=wa-runtime-78b-202605192033
CL=wa78b2033
VM=Standard_D4_v3
az group create -n "$RG" -l eastus2 --query '{name:name,location:location,provisioningState:properties.provisioningState}' -o json
az aks create -g "$RG" -n "$CL" --location eastus2 --node-count 2 --node-vm-size "$VM" --enable-managed-identity --generate-ssh-keys --enable-keda --enable-vpa --query '{name:name,provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,workloadAutoScalerProfile:workloadAutoScalerProfile}' -o json
az aks show -g "$RG" -n "$CL" --query '{name:name,provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,workloadAutoScalerProfile:workloadAutoScalerProfile}' -o json
az aks get-credentials -g "$RG" -n "$CL" --overwrite-existing
kubectl version || true
kubectl get nodes -o wide
```

Observed create/show state:

```json
{
  "kubernetesVersion": "1.34",
  "name": "wa78b2033",
  "provisioningState": "Succeeded",
  "workloadAutoScalerProfile": {
    "keda": { "enabled": true },
    "verticalPodAutoscaler": {
      "addonAutoscaling": "Unspecified",
      "enabled": true
    }
  }
}
```

Observed Kubernetes server and nodes:

```text
Client Version: v1.29.3
Server Version: v1.34.7
NAME                                STATUS   ROLES    AGE    VERSION   INTERNAL-IP   OS-IMAGE
aks-nodepool1-71863013-vmss000000   Ready    <none>   111s   v1.34.7   10.224.0.4    Ubuntu 22.04.5 LTS
aks-nodepool1-71863013-vmss000001   Ready    <none>   112s   v1.34.7   10.224.0.5    Ubuntu 22.04.5 LTS
```

### KEDA runtime resources and scaling

Commands/checks:

```bash
kubectl get crd | grep -E 'keda|verticalpodautoscaler'
kubectl -n kube-system get deploy,po,svc,pdb | grep -E 'keda|vpa'
kubectl -n kube-system rollout status deploy/keda-operator --timeout=10m
kubectl -n kube-system rollout status deploy/keda-operator-metrics-apiserver --timeout=10m
kubectl -n kube-system rollout status deploy/keda-admission-webhooks --timeout=10m
kubectl get crd scaledobjects.keda.sh scaledjobs.keda.sh triggerauthentications.keda.sh clustertriggerauthentications.keda.sh
kubectl get apiservice v1beta1.external.metrics.k8s.io -o jsonpath='external metrics available={range .status.conditions[?(@.type=="Available")]}{.status}{" reason="}{.reason}{" message="}{.message}{end}{"
"}'
```

Observed:

```text
cloudeventsources.eventing.keda.sh
clustercloudeventsources.eventing.keda.sh
clustertriggerauthentications.keda.sh
scaledjobs.keda.sh
scaledobjects.keda.sh
triggerauthentications.keda.sh

deployment.apps/keda-admission-webhooks           2/2     2            2
deployment.apps/keda-operator                     2/2     2            2
deployment.apps/keda-operator-metrics-apiserver   2/2     2            2
poddisruptionbudget.policy/keda-admission-webhooks           1               N/A               1
poddisruptionbudget.policy/keda-operator                     1               N/A               1
poddisruptionbudget.policy/keda-operator-metrics-apiserver   1               N/A               1

deployment "keda-operator" successfully rolled out
deployment "keda-operator-metrics-apiserver" successfully rolled out
deployment "keda-admission-webhooks" successfully rolled out
external metrics available=True reason=Passed message=all checks passed
```

The source-like KEDA workload/ScaledObject was applied. Initial image choice `mcr.microsoft.com/oss/nginx/nginx:1.25.5` was invalid in MCR and produced `ImagePullBackOff`, but it also showed KEDA/HPA changing desired replicas. The image was then corrected in place:

```bash
kubectl set image deploy/cron-tests-deployment nginx=registry.k8s.io/pause:3.9
kubectl rollout status deploy/cron-tests-deployment --timeout=5m
```

Observed corrected rollout and scaling:

```text
deployment.apps/cron-tests-deployment image updated
deployment "cron-tests-deployment" successfully rolled out
20:59:24 target=4 elapsed=0s replicas=1 ready=1 updated=1 available=1
21:00:18 target=4 elapsed=54s replicas=4 ready=4 updated=4 available=4
21:00:19 target=1 elapsed=0s replicas=4 ready=4 updated=4 available=4
21:01:13 target=1 elapsed=54s replicas=1 ready=1 updated=1 available=1
```

Final KEDA objects included:

```text
horizontalpodautoscaler.autoscaling/keda-hpa-cron-tests-scaledobject   Deployment/cron-tests-deployment   250m/1 (avg)   1   10   4
scaledobject.keda.sh/cron-tests-scaledobject   apps/v1.Deployment   cron-tests-deployment   1   10   True   False   False   Unknown   cron
```

### VPA runtime components and recommendation generation

Commands/checks:

```bash
kubectl -n kube-system rollout status deploy/vpa-admission-controller --timeout=10m
kubectl -n kube-system rollout status deploy/vpa-recommender --timeout=10m
kubectl -n kube-system rollout status deploy/vpa-updater --timeout=10m
kubectl get crd verticalpodautoscalers.autoscaling.k8s.io verticalpodautoscalercheckpoints.autoscaling.k8s.io
kubectl -n kube-system get svc vpa-webhook -o wide
kubectl -n kube-system get deploy vpa-admission-controller vpa-recommender vpa-updater -o wide
```

Observed:

```text
deployment "vpa-admission-controller" successfully rolled out
deployment "vpa-recommender" successfully rolled out
deployment "vpa-updater" successfully rolled out
NAME                                                  CREATED AT
verticalpodautoscalers.autoscaling.k8s.io             2026-05-19T20:37:03Z
verticalpodautoscalercheckpoints.autoscaling.k8s.io   2026-05-19T20:37:03Z
NAME          TYPE        CLUSTER-IP    EXTERNAL-IP   PORT(S)   AGE   SELECTOR
vpa-webhook   ClusterIP   10.0.70.234   <none>        443/TCP   24m   app=vpa-admission-controller
NAME                       READY   UP-TO-DATE   AVAILABLE   AGE   CONTAINERS             IMAGES
vpa-admission-controller   2/2     2            2           24m   admission-controller   mcr.microsoft.com/oss/v2/kubernetes/autoscaler/vpa-admission-controller:v1.5.1-6
vpa-recommender            2/2     2            2           24m   recommender            mcr.microsoft.com/oss/v2/kubernetes/autoscaler/vpa-recommender:v1.5.1-6
vpa-updater                2/2     2            2           24m   updater                mcr.microsoft.com/oss/v2/kubernetes/autoscaler/vpa-updater:v1.5.1-6
```

A bounded VPA workload was created with updateMode `Off` to prove recommendation generation without claiming in-place update:

```bash
kubectl create ns vpa-runtime --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hamster
  namespace: vpa-runtime
spec:
  replicas: 2
  selector:
    matchLabels: {app: hamster}
  template:
    metadata:
      labels: {app: hamster}
    spec:
      containers:
      - name: hamster
        image: registry.k8s.io/ubuntu-slim:0.14
        resources:
          requests: {cpu: 50m, memory: 20Mi}
        command: ["/bin/sh"]
        args: ["-c", "while true; do timeout 0.5s yes >/dev/null 2>&1 || true; sleep 0.5; done"]
---
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: hamster-vpa
  namespace: vpa-runtime
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hamster
  updatePolicy:
    updateMode: "Off"
  resourcePolicy:
    containerPolicies:
    - containerName: hamster
      minAllowed: {cpu: 1m, memory: 5Mi}
      maxAllowed: {cpu: 1, memory: 500Mi}
      controlledValues: RequestsAndLimits
EOF
```

Observed recommendation:

```text
deployment "hamster" successfully rolled out
21:01:31 elapsed=0s vpa cpu=<none> memory=<none>
21:02:04 elapsed=32s vpa cpu=<none> memory=<none>
21:02:36 elapsed=64s vpa cpu=587m memory=11500000
status:
  conditions:
  - lastTransitionTime: "2026-05-19T21:02:09Z"
    status: "True"
    type: RecommendationProvided
  recommendation:
    containerRecommendations:
    - containerName: hamster
      target:
        cpu: 587m
        memory: "11500000"
```

Final workload summary:

```text
deployment.apps/hamster   2/2     2            2           71s   hamster   registry.k8s.io/ubuntu-slim:0.14
verticalpodautoscaler.autoscaling.k8s.io/hamster-vpa   Off   587m   11500000   True   71s
```

## Runtime verdicts

- `workload-autoscaler-keda-runtime`: **PASS**. Evidence: profile persisted; KEDA CRDs/deployments/services/PDBs and external metrics APIService were ready; a cron `ScaledObject` scaled a ready Deployment from 1 to 4 replicas and back to 1.
- `workload-autoscaler-vpa-runtime`: **PARTIAL / still grouped-UNKNOWN**. Evidence supports a bounded pass for VPA components and recommendation generation: VPA CRDs, `vpa-webhook`, and admission/recommender/updater deployments were ready, and `hamster-vpa` reached `RecommendationProvided=True` with CPU/memory targets. Do **not** treat this as full source-derived VPA runtime pass because Helm-release metadata, in-place update, HA/leader-election, cert renewal, upgrade, and OS/arch matrix branches were explicit non-goals.
- `workload-autoscaler-keda-crud`: **non-goal/UNKNOWN**. The CLI exposes `--disable-keda`, but this run intentionally did not disable/re-enable the add-on.

## Cleanup status

Workload cleanup succeeded and resource group deletion was started asynchronously:

```text
scaledobject.keda.sh "cron-tests-scaledobject" deleted
deployment.apps "cron-tests-deployment" deleted
namespace "vpa-runtime" deleted
DELETE_STARTED_RG=wa-runtime-78b-202605192033
```

The failed first-attempt resource group `wa-runtime-78-202605192032` also had async deletion requested.

## Capability model / knowledge-map updates

Updated `outputs/e2e-capability-model.json`:

- Marked `Scenario_Keda` / `workload-autoscaler-keda-runtime` passed with `iteration78-workload-autoscaler-runtime-staging` evidence.
- Added `iteration78-workload-autoscaler-keda-runtime-pass` judgment.
- Added `iteration78-workload-autoscaler-vpa-runtime-bounded-pass` judgment with status `unknown` for the grouped feature, so component/recommendation evidence is durable without hiding untested VPA subbranches.
- Added `iteration78-workload-autoscaler-keda-crud-unknown` judgment.
- Added the iteration78 evidence record.

Validated with:

```bash
cd /app/projects/aks-rp-e2e/capability-model
bun src/validate.ts ../outputs/e2e-capability-model.json
```

Validator exited 0 and reported `workload-autoscaler-keda-runtime` removed from `unknownFeatureIds`, while `workload-autoscaler-keda-crud` and grouped `workload-autoscaler-vpa-runtime` remain unknown.

Updated `outputs/input-expectation-knowledge-map.md` with the KEDA runtime pass, VPA bounded evidence, and revised next recommendations.
