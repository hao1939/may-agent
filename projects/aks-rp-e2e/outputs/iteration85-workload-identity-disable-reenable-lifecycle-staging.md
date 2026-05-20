# Iteration 85 — Workload Identity disable/re-enable lifecycle staging probe

**Feature focus:** `workload-identity-disable-reenable-lifecycle`  
**Scope:** Workload Identity lifecycle only: public/profile state plus Kubernetes azure-workload-identity webhook/runtime surface before disable, after disable, and after re-enable.  
**Non-goals:** OIDC signing-key rotation, OIDC post-delete issuer cleanup, Windows token projection, KEDA/VPA, Image Cleaner, App Routing, ManagedSystem Pool, Node Restriction.

## Preflight

### Current validator identity unknowns

First command run exactly as requested:

```bash
cd /app/projects/aks-rp-e2e && {
  echo '===== current validator identity unknowns ====='
  cd capability-model
  bun src/validate.ts ../outputs/e2e-capability-model.json | tee /tmp/iteration85-validator.txt | grep -E 'workload-identity-disable-reenable-lifecycle|workload-identity-runtime-token-projection-windows|oidc-issuer-default-enabled|oidc-issuer-v133|unknownFeatureIds|failingFeatureIds' -A50 -B5 || true
  cd ..

  echo '===== prior identity/OIDC runtime evidence ====='
  grep -n "Workload Identity\|workload identity\|OIDC\|token\|federated\|webhook\|service account\|issuer" outputs/iteration76-workload-identity-oidc-runtime-staging.md | head -160

  echo '===== identity model consolidation context ====='
  grep -n "workload-identity-disable-reenable-lifecycle\|Windows\|OIDC\|Next\|identity" outputs/iteration77-identity-runtime-model-consolidation.md | head -160

  echo '===== active CLI lifecycle flags ====='
  ssh devbox "az extension show -n aks-preview --query '{name:name,version:version,path:path}' -o json && az aks update --help | grep -i -C 3 'workload-identity\\|oidc'"
}
```

Observed validator/model state:

- `workload-identity-disable-reenable-lifecycle` is present in `unknownFeatureIds` and has status `unknown`.
- Adjacent residual identity/OIDC unknowns remain separate: `workload-identity-runtime-token-projection-windows`, `oidc-issuer-default-enabled-signing-key-rotation`, `oidc-issuer-default-enabled-post-delete-cleanup`, and `oidc-issuer-v133-explicit-enable-runtime`.
- Existing passed identity/OIDC runtime evidence includes `workload-identity-runtime-token-projection-linux` and `oidc-issuer-default-enabled-discovery-jwks-runtime` from iteration76.

Prior identity runtime evidence from `outputs/iteration76-workload-identity-oidc-runtime-staging.md`:

- Iteration76 created a staging cluster with `--enable-oidc-issuer --enable-workload-identity`.
- It observed `oidcIssuerProfile.enabled=true` and non-empty issuer URL.
- It created a federated identity credential and a labeled/annotated Linux service account.
- It observed Workload Identity mutation in a Linux pod: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_FEDERATED_TOKEN_FILE=/var/run/secrets/azure/wi/token/azure-identity-token`, token file present, and decoded token with expected issuer/audience/subject.
- Iteration76 explicitly left Workload Identity disable/re-enable lifecycle as a non-goal.

Identity model consolidation from `outputs/iteration77-identity-runtime-model-consolidation.md`:

- The broad identity feature was split into branch-accurate features.
- `workload-identity-disable-reenable-lifecycle` remains unknown because create-time enablement was tested, not lifecycle toggling.

CLI operation-shape preflight:

- Active `aks-preview` extension on devbox: `20.0.0b6`.
- `az aks update --help` exposes both lifecycle flags:
  - `--disable-workload-identity`: Disable Workload Identity addon for cluster.
  - `--enable-workload-identity`: Enable Workload Identity addon for cluster.
- The same help output exposes `--enable-oidc-issuer`; no `--disable-oidc-issuer` was selected for this run.
- Therefore the supported operation shape for this probe is public CLI `az aks update --disable-workload-identity` followed by `az aks update --enable-workload-identity`, while leaving OIDC issuer enabled and treating issuer state only as context.

### Probe plan before mutation

1. Create a small disposable staging cluster with OIDC issuer and Workload Identity enabled at create time.
2. Record initial ARM/profile state: `securityProfile.workloadIdentity.enabled=true`; record OIDC issuer only as context.
3. Get kubeconfig and record the Kubernetes Workload Identity runtime surface:
   - `azure-workload-identity-system` namespace objects,
   - webhook deployment/pods/service/endpoints/configmap if present,
   - mutating webhook configuration(s) containing workload identity / azure-wi,
   - basic readiness.
4. Disable Workload Identity with public CLI `az aks update --disable-workload-identity`.
5. Record ARM/profile state after disable and Kubernetes runtime surface cleanup/deactivation. Precisely classify retained objects if any remain.
6. Re-enable Workload Identity with public CLI `az aks update --enable-workload-identity`.
7. Record ARM/profile state and Kubernetes runtime surface restoration.
8. Run a cheap minimal post-reenable mutation smoke if reliable; otherwise bound the conclusion to lifecycle/runtime surface and cite iteration76 for functional Linux token projection.
9. Delete the disposable staging resource group with `--no-wait` and record cleanup output.

## Execution evidence

### Run identifiers and execution host

Execution was run from `/app/projects/aks-rp-e2e` through `ssh devbox`. The first collection used the wrong namespace assumption (`azure-workload-identity-system`) and found the mutating webhook points at `kube-system/azure-wi-webhook-webhook-service`; a focused rerun below collected the correct AKS-managed `kube-system` surface. Both disposable resource groups were deleted with `--no-wait`.

Primary rerun identifiers:

```text
ITERATION85B_VARS RG=wi-life-85b-202605200503 CL=wi85b0503 LOC=eastus2 VM=Standard_D4_v3 KUBECONFIG=/tmp/kubeconfig-wi-life-85b-202605200503
```

### CLI/staging context

```json
{
  "name": "aks-preview",
  "path": "/home/hayua/.azure/cliextensions/aks-preview",
  "version": "20.0.0b6"
}
```

`az aks update --help` exposed the public lifecycle flags used in this probe:

```text
--disable-workload-identity : (PREVIEW) Disable Workload Identity addon for cluster.
--enable-oidc-issuer        : Enable OIDC issuer.
--enable-workload-identity  : (PREVIEW) Enable Workload Identity addon for cluster.
```

### Create: OIDC issuer and Workload Identity enabled

Commands:

```bash
az group create -n wi-life-85b-202605200503 -l eastus2 \
  --query '{name:name,location:location,provisioningState:properties.provisioningState}' -o json
az aks create -g wi-life-85b-202605200503 -n wi85b0503 --location eastus2 \
  --node-count 2 --node-vm-size Standard_D4_v3 --enable-managed-identity \
  --enable-oidc-issuer --enable-workload-identity --generate-ssh-keys \
  --query '{name:name,provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,oidcIssuerProfile:oidcIssuerProfile,securityProfile:securityProfile}' -o json
az aks show -g wi-life-85b-202605200503 -n wi85b0503 \
  --query '{name:name,provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,oidcIssuerProfile:oidcIssuerProfile,securityProfile:securityProfile}' -o json
az aks get-credentials -g wi-life-85b-202605200503 -n wi85b0503 \
  --file /tmp/kubeconfig-wi-life-85b-202605200503 --overwrite-existing
kubectl get nodes -o wide
```

Observed create/show state:

```json
{
  "kubernetesVersion": "1.34",
  "name": "wi85b0503",
  "oidcIssuerProfile": {
    "enabled": true,
    "issuerUrl": "https://eastus2.oic.prod-aks.azure.com/72f988bf-86f1-41af-91ab-2d7cd011db47/c8ec23ab-4587-4bab-9c69-7ced8d1a330b/"
  },
  "provisioningState": "Succeeded",
  "securityProfile": {
    "workloadIdentity": { "enabled": true }
  }
}
```

Node/runtime context:

```text
aks-nodepool1-42855611-vmss000000 Ready v1.34.7 Ubuntu 22.04.5 LTS containerd://1.7.31-1
aks-nodepool1-42855611-vmss000001 Ready v1.34.7 Ubuntu 22.04.5 LTS containerd://1.7.31-1
```

### Enabled runtime surface before disable

The expected upstream namespace `azure-workload-identity-system` was absent on this AKS build; the managed webhook runs in `kube-system` and is selected with `azure-workload-identity.io/system=true`.

```text
Error from server (NotFound): namespaces "azure-workload-identity-system" not found
```

`kube-system` Workload Identity webhook surface after create:

```text
deployment.apps/azure-wi-webhook-controller-manager   2/2     2            2           mcr.microsoft.com/oss/v2/azure/workload-identity/webhook:v1.6.0-alpha.1
pod/azure-wi-webhook-controller-manager-55d7b5489b-f9ppv   1/1     Running   0   10.244.0.197
pod/azure-wi-webhook-controller-manager-55d7b5489b-kqnx6   1/1     Running   0   10.244.0.225
service/azure-wi-webhook-webhook-service   ClusterIP   10.0.91.133   443/TCP
endpoints/azure-wi-webhook-webhook-service   10.244.0.197:9443,10.244.0.225:9443
secret/azure-wi-webhook-server-cert                             Opaque             3
secret/sh.helm.release.v1.aks-managed-workload-identity.v1      helm.sh/release.v1 1
```

Readiness/image and webhook configuration:

```text
NAME                                  READY   AVAILABLE   IMAGES
azure-wi-webhook-controller-manager   2       2           mcr.microsoft.com/oss/v2/azure/workload-identity/webhook:v1.6.0-alpha.1

deployment "azure-wi-webhook-controller-manager" successfully rolled out

mutatingwebhookconfiguration.admissionregistration.k8s.io/azure-wi-webhook-mutating-webhook-configuration
azure-wi-webhook-mutating-webhook-configuration labels={"admissions.enforcer/disabled":"true","app.kubernetes.io/managed-by":"Helm","azure-workload-identity.io/system":"true","helm.toolkit.fluxcd.io/name":"workload-identity-adapter-helmrelease","kubernetes.azure.com/managedby":"aks"}
mutation.azure-workload-identity.io clientService=kube-system/azure-wi-webhook-webhook-service failurePolicy=Fail objectSelector={"azure.workload.identity/use":"true"}

wi_kubesystem_counts deployments=1 pods=2 services=1 matching_secrets=2 matching_webhooks=1
```

### Disable: public profile state false and runtime surface removed

Command:

```bash
az aks update -g wi-life-85b-202605200503 -n wi85b0503 --disable-workload-identity \
  --query '{name:name,provisioningState:provisioningState,oidcIssuerProfile:oidcIssuerProfile,securityProfile:securityProfile}' -o json
az aks show -g wi-life-85b-202605200503 -n wi85b0503 \
  --query '{name:name,provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,oidcIssuerProfile:oidcIssuerProfile,securityProfile:securityProfile}' -o json
```

Observed state after disable:

```json
{
  "kubernetesVersion": "1.34",
  "name": "wi85b0503",
  "oidcIssuerProfile": {
    "enabled": true,
    "issuerUrl": "https://eastus2.oic.prod-aks.azure.com/72f988bf-86f1-41af-91ab-2d7cd011db47/c8ec23ab-4587-4bab-9c69-7ced8d1a330b/"
  },
  "provisioningState": "Succeeded",
  "securityProfile": {
    "workloadIdentity": { "enabled": false }
  }
}
```

Runtime cleanup immediately after disable:

```text
Error from server (NotFound): namespaces "azure-workload-identity-system" not found
# kube-system azure-wi resources: no matching deployment/pod/service/endpoint/configmap/secret rows
NAME   READY   AVAILABLE   IMAGES
No resources found in kube-system namespace.
No resources found in kube-system namespace.
# matching mutating webhook configurations: none
Error from server (NotFound): deployments.apps "azure-wi-webhook-controller-manager" not found
wi_kubesystem_counts deployments=0 pods=0 services=0 matching_secrets=0 matching_webhooks=0
```

After an additional 120 seconds, the disabled surface remained absent:

```text
Error from server (NotFound): namespaces "azure-workload-identity-system" not found
# kube-system azure-wi resources: no matching rows
NAME   READY   AVAILABLE   IMAGES
No resources found in kube-system namespace.
No resources found in kube-system namespace.
# matching mutating webhook configurations: none
Error from server (NotFound): deployments.apps "azure-wi-webhook-controller-manager" not found
wi_kubesystem_counts deployments=0 pods=0 services=0 matching_secrets=0 matching_webhooks=0
```

### Re-enable: public profile true and runtime surface restored

Command:

```bash
az aks update -g wi-life-85b-202605200503 -n wi85b0503 --enable-workload-identity \
  --query '{name:name,provisioningState:provisioningState,oidcIssuerProfile:oidcIssuerProfile,securityProfile:securityProfile}' -o json
az aks show -g wi-life-85b-202605200503 -n wi85b0503 \
  --query '{name:name,provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,oidcIssuerProfile:oidcIssuerProfile,securityProfile:securityProfile}' -o json
```

Observed state after re-enable:

```json
{
  "kubernetesVersion": "1.34",
  "name": "wi85b0503",
  "oidcIssuerProfile": {
    "enabled": true,
    "issuerUrl": "https://eastus2.oic.prod-aks.azure.com/72f988bf-86f1-41af-91ab-2d7cd011db47/c8ec23ab-4587-4bab-9c69-7ced8d1a330b/"
  },
  "provisioningState": "Succeeded",
  "securityProfile": {
    "workloadIdentity": { "enabled": true }
  }
}
```

Restored runtime surface:

```text
deployment.apps/azure-wi-webhook-controller-manager   2/2     2            2           mcr.microsoft.com/oss/v2/azure/workload-identity/webhook:v1.6.0-alpha.1
pod/azure-wi-webhook-controller-manager-55d7b5489b-5rhdg   1/1     Running   0   10.244.1.102
pod/azure-wi-webhook-controller-manager-55d7b5489b-nmp87   1/1     Running   0   10.244.0.177
service/azure-wi-webhook-webhook-service   ClusterIP   10.0.120.181   443/TCP
endpoints/azure-wi-webhook-webhook-service   10.244.0.177:9443,10.244.1.102:9443
secret/azure-wi-webhook-server-cert                              Opaque             3
secret/sh.helm.release.v1.aks-managed-workload-identity.v1       helm.sh/release.v1 1
secret/sh.helm.release.v1.aks-managed-workload-identity.v2       helm.sh/release.v1 1

NAME                                  READY   AVAILABLE   IMAGES
azure-wi-webhook-controller-manager   2       2           mcr.microsoft.com/oss/v2/azure/workload-identity/webhook:v1.6.0-alpha.1

deployment "azure-wi-webhook-controller-manager" successfully rolled out

mutatingwebhookconfiguration.admissionregistration.k8s.io/azure-wi-webhook-mutating-webhook-configuration
mutation.azure-workload-identity.io clientService=kube-system/azure-wi-webhook-webhook-service failurePolicy=Fail objectSelector={"azure.workload.identity/use":"true"}

wi_kubesystem_counts deployments=1 pods=2 services=1 matching_secrets=3 matching_webhooks=1
```

### Post-reenable Linux token-projection smoke

This was intentionally a minimal webhook/mutation smoke, not a full Azure token exchange or Windows parity probe. It used a dummy client ID only to prove the re-enabled webhook mutates labeled pods and projects the Kubernetes service-account token. Iteration76 remains the fuller Linux federated-identity context with decoded issuer/audience/subject.

Commands (pod manifest applied inline on devbox):

```bash
kubectl create ns wi-smoke-85b
kubectl create sa wi-smoke-sa -n wi-smoke-85b
kubectl annotate sa wi-smoke-sa -n wi-smoke-85b \
  azure.workload.identity/client-id=00000000-0000-0000-0000-000000000000 --overwrite
kubectl apply -f <inline pod manifest with label azure.workload.identity/use=true>
kubectl wait --for=condition=Ready pod/wi-smoke-pod -n wi-smoke-85b --timeout=180s
kubectl logs wi-smoke-pod -n wi-smoke-85b
```

Observed mutation and token-file projection:

```text
pod/wi-smoke-pod condition met
wi-smoke-pod   1/1     Running   0   10.244.1.201   aks-nodepool1-42855611-vmss000000

AZURE_CLIENT_ID=00000000-0000-0000-0000-000000000000
AZURE_TENANT_ID=72f988bf-86f1-41af-91ab-2d7cd011db47
AZURE_FEDERATED_TOKEN_FILE=/var/run/secrets/azure/wi/token/azure-identity-token
AZURE_AUTHORITY_HOST=https://login.microsoftonline.com/

kube-api-access-qk5wz projected={...serviceAccountToken...}
azure-workload-identity-reserved-057b5221fda0ff337600324a44ef66 projected={"defaultMode":420,"sources":[{"serviceAccountToken":{"audience":"api://AzureADTokenExchange","expirationSeconds":3600,"path":"token/azure-identity-token"}}]}

AZURE_AUTHORITY_HOST=https://login.microsoftonline.com/
AZURE_CLIENT_ID=00000000-0000-0000-0000-000000000000
AZURE_FEDERATED_TOKEN_FILE=/var/run/secrets/azure/wi/token/azure-identity-token
AZURE_TENANT_ID=72f988bf-86f1-41af-91ab-2d7cd011db47
TOKEN_EXISTS=yes
1593
```

## Cleanup

Two disposable resource groups were created during the iteration: the initial namespace-assumption run and the corrected kube-system rerun. Both were submitted for asynchronous deletion:

```text
az group delete -n wi-life-85-202605200450 --yes --no-wait
EXIT_CODE=0 for: az group delete -n wi-life-85-202605200450 --yes --no-wait
ITERATION85_CLEANUP_REQUESTED RG=wi-life-85-202605200450

az group delete -n wi-life-85b-202605200503 --yes --no-wait
EXIT_CODE=0 for: az group delete -n wi-life-85b-202605200503 --yes --no-wait
ITERATION85B_CLEANUP_REQUESTED RG=wi-life-85b-202605200503
```

## Model and map updates

Updated because the evidence clearly resolves `workload-identity-disable-reenable-lifecycle`:

- `outputs/e2e-capability-model.json`
  - Added evidence `iteration85-workload-identity-disable-reenable-lifecycle-staging`.
  - Replaced the residual unknown lifecycle testcase/judgment with pass evidence.
  - Added `identity.operation=disable-reenable-update` to distinguish this branch from idempotent update.
  - `workload-identity-disable-reenable-lifecycle` no longer appears in `unknownFeatureIds` after validation.
- `outputs/input-expectation-knowledge-map.md`
  - Added a Workload Identity disable/re-enable lifecycle pass row and moved that residual out of the identity unknown list.

Validator command:

```bash
cd /app/projects/aks-rp-e2e/capability-model
bun src/validate.ts ../outputs/e2e-capability-model.json
```

Validator summary excerpt after update:

```json
{
  "failingFeatureIds": [
    "app-routing-default-domain",
    "paf-throttling",
    "managedsystem-pool-cli-create-cluster",
    "managedsystem-pool-cli-add-existing",
    "virtualmachines-agentpool-cli-add-multi-sku",
    "app-routing-default-domain-tls-secret"
  ],
  "unknownFeatureIds": [
    "workload-autoscaler-vpa-inplace-update-runtime",
    "workload-autoscaler-vpa-ha-leader-election-runtime",
    "workload-autoscaler-vpa-cert-renewal-runtime",
    "workload-autoscaler-vpa-upgrade-survival-runtime",
    "workload-autoscaler-vpa-helm-release-runtime",
    "workload-autoscaler-vpa-runtime",
    "image-cleaner-runtime-lifecycle",
    "workload-identity-runtime-token-projection-windows",
    "oidc-issuer-default-enabled-signing-key-rotation",
    "oidc-issuer-default-enabled-post-delete-cleanup",
    "oidc-issuer-v133-explicit-enable-runtime",
    "bootstrap-profile-managed-acr-lifecycle",
    "bootstrap-profile-byo-acr-lifecycle",
    "app-routing-default-domain-istio",
    "app-routing-default-domain-tls-lifecycle",
    "managedsystem-runtime-restrictions",
    "managedsystem-disable-migration",
    "virtualmachines-mixed-sku-rest-scale",
    "virtualmachines-autoscaled-vms-crud",
    "machines-agentpool-api-crud",
    "machines-agentpool-nap-default-pool-cleanup",
    "node-restriction-tag-only-patch-shape"
  ]
}
```

## Verdict

**PASS** for `workload-identity-disable-reenable-lifecycle` on staging Kubernetes `1.34` using the public AKS CLI lifecycle surface while keeping OIDC issuer enabled.

What this resolves:

- Public `--disable-workload-identity` is accepted independently of OIDC issuer disablement.
- ARM/profile state changes from `securityProfile.workloadIdentity.enabled=true` to `false` while `oidcIssuerProfile.enabled=true` and `issuerUrl` remain present.
- Disable removes the AKS-managed Workload Identity runtime surface: kube-system `azure-wi-webhook-controller-manager` deployment/pods/service/endpoints/secrets and the `azure-wi-webhook-mutating-webhook-configuration` are absent immediately and remain absent after 120 seconds.
- Public `--enable-workload-identity` restores `securityProfile.workloadIdentity.enabled=true`, restores the kube-system azure-wi deployment/pods/service/endpoints/secrets and mutating webhook, and rollout is successful.
- A cheap Linux smoke pod after re-enable is mutated with `AZURE_*` env vars and receives the projected federated token file.

What remains separate and untested:

- Windows Workload Identity token projection.
- OIDC signing-key rotation.
- OIDC issuer post-delete cleanup.
- Kubernetes `1.33` explicit-enable OIDC runtime behavior.
