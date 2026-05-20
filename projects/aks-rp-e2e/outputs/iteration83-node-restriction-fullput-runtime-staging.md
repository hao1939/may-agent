# Iteration 83 — Node Restriction full-PUT disable contract and runtime-default staging probe

**Date:** 2026-05-20  
**Feature focus:** `securityProfile.nodeRestriction` full ManagedCluster create-or-update semantics and runtime default behavior.  
**Scope guard:** Node Restriction only. This run did not combine App Routing, VPA/KEDA, Image Cleaner, or ManagedSystem work.  
**Verdict:** PASS for corrected full-PUT disable contract; PASS for runtime-default admission behavior on RBAC Kubernetes `>=1.24` using a kubelet-identity restricted-label denial.

## Preflight / payload hygiene

### Source/spec contract confirmed before cloud mutation

Inputs read before any staging mutation:

- `outputs/iteration82-post-escalation-next-probe-selection.md`
- `outputs/iteration74-node-restriction-source-spec-resolution.md`
- `outputs/iteration62-security-profile-staging.md`

Confirmed contract from iteration74:

- `securityProfile.nodeRestriction` is a ManagedCluster **full create-or-update PUT** field under `ManagedClusterSecurityProfile`.
- The ManagedCluster `PATCH` operation is tag-only (`ManagedClusters_UpdateTags` / `TagsObject`) and is not the contract for this property.
- For RBAC Kubernetes `>=1.24`, source expects:
  - explicit `securityProfile.nodeRestriction.enabled=true` to be accepted/preserved when create/update preconditions hold;
  - explicit full PUT/update with `securityProfile.nodeRestriction.enabled=false` to fail with `Node restriction is required on version 1.24.0 or above.`;
  - runtime NodeRestriction admission to be enabled for RBAC clusters on Kubernetes `>=1.24` even if the ARM profile is omitted/null.

### Iteration62 mistake explicitly excluded

Iteration62 used:

```bash
az rest --method patch \
  --url "https://management.azure.com${ID}?api-version=2025-04-02-preview" \
  --body '{"properties":{"securityProfile":{"nodeRestriction":{"enabled":true}}}}'
```

That is **not** the operation shape under test here. The expected behavior in this iteration is not inferred from tag-only PATCH. The PATCH/null result remains modeled separately as `node-restriction-tag-only-patch-shape` and is not allowed to decide the full PUT disable contract.

### Planned full PUT round trip

API version and payload path selected for the probe:

- ARM endpoint: `https://management.azure.com/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.ContainerService/managedClusters/<cluster>?api-version=2025-04-02-preview`
- API version: `2025-04-02-preview` (same public preview version used by iteration62, but with the corrected PUT shape)
- Payload path under test: `properties.securityProfile.nodeRestriction.enabled`

Payload hygiene plan before PUT:

1. Create or select a small staging RBAC cluster with Kubernetes `>=1.24` using normal public CLI cluster creation.
2. Capture a full ManagedCluster representation with `az rest --method get` at `api-version=2025-04-02-preview`.
3. Produce an enable payload by minimally modifying only `properties.securityProfile.nodeRestriction.enabled=true` in that GET body. Preserve the rest of the ManagedCluster body rather than constructing a partial cluster.
4. Submit the modified full body with `az rest --method put` to the same ManagedCluster resource URL and API version.
5. Capture a second full GET and record whether the explicit ARM profile is returned.
6. Produce a disable payload by minimally modifying the second full GET body to set `properties.securityProfile.nodeRestriction.enabled=false`.
7. Submit the disable body via full `PUT` to the same URL/API version and expect HTTP 400/BadRequest with message containing `Node restriction is required on version 1.24.0 or above`.
8. Capture final GET state to confirm the cluster is not disabled.

Runtime-default evidence plan:

- Use a RBAC Kubernetes `>=1.24` cluster whose ARM `securityProfile.nodeRestriction` profile is omitted/null before explicit PUT (the CLI-created baseline cluster).
- Prefer a customer-cluster admission probe using a kubelet/node identity if a reproducible method is available from `kubectl` access: a kubelet identity should be unable to mutate restricted Node fields when the NodeRestriction admission plugin is active.
- If the node-identity probe is blocked by customer-cluster access or credential restrictions, record the strongest accessible evidence and the remaining unobservable control-plane gap rather than converting source-only evidence into an execution pass.

## Execution evidence

### Devbox environment/context check

Command:

```bash
ssh devbox 'set -euo pipefail
cd /home/hayua/rp
az account show --query "{name:name,id:id,tenantId:tenantId}" -o json
az extension show -n aks-preview --query "{name:name,version:version,path:path}" -o json
az version --query "{azureCli:\"azure-cli\", extensions:extensions}" -o json
'
```

Observed output:

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
{
  "azureCli": "2.86.0",
  "extensions": {
    "aks-preview": "18.0.0b18",
    "virtual-wan": "1.0.1"
  }
}
```

As in earlier iterations, `az version` reports a stale duplicate `aks-preview` entry while `az extension show` reports the active extension.

### Baseline RBAC >=1.24 cluster with ARM profile omitted/null

Resource inputs:

- Subscription: `26fe00f8-9173-4872-9134-bb1d2e00343a`
- Resource group: `nr83-20260520`
- Cluster: `nr83`
- Location: `eastus2`
- Kubernetes version observed: `1.34`
- RBAC observed: `enableRbac=true` from public CLI output
- Initial ARM/API profile: public CLI showed `securityProfile.nodeRestriction=null`; direct REST GET at `2025-04-02-preview` showed `properties.securityProfile={}`.

Command:

```bash
ssh devbox 'set -euo pipefail
RG=nr83-20260520
CLUSTER=nr83
LOC=eastus2
az group create -n "$RG" -l "$LOC" --query "{name:name,location:location,provisioningState:properties.provisioningState}" -o json
az aks create -g "$RG" -n "$CLUSTER" --location "$LOC" --node-count 1 --enable-managed-identity --generate-ssh-keys --query "{id:id,name:name,location:location,provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,enableRbac:enableRbac,securityProfile:securityProfile,nodeResourceGroup:nodeResourceGroup}" -o json
az aks show -g "$RG" -n "$CLUSTER" --query "{id:id,name:name,provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,enableRbac:enableRbac,securityProfile:securityProfile,nodeResourceGroup:nodeResourceGroup}" -o json
'
```

Observed baseline output excerpts:

```json
{
  "location": "eastus2",
  "name": "nr83-20260520",
  "provisioningState": "Succeeded"
}
{
  "enableRbac": true,
  "id": "/subscriptions/26fe00f8-9173-4872-9134-bb1d2e00343a/resourcegroups/nr83-20260520/providers/Microsoft.ContainerService/managedClusters/nr83",
  "kubernetesVersion": "1.34",
  "location": "eastus2",
  "name": "nr83",
  "nodeResourceGroup": "MC_nr83-20260520_nr83_eastus2",
  "provisioningState": "Succeeded",
  "securityProfile": {
    "nodeRestriction": null
  }
}
```

Direct REST GET baseline summary at `api-version=2025-04-02-preview`:

```json
{
  "id": "/subscriptions/26fe00f8-9173-4872-9134-bb1d2e00343a/resourcegroups/nr83-20260520/providers/Microsoft.ContainerService/managedClusters/nr83",
  "name": "nr83",
  "type": "Microsoft.ContainerService/ManagedClusters",
  "location": "eastus2",
  "kubernetesVersion": "1.34",
  "provisioningState": "Succeeded",
  "securityProfile": {},
  "topKeys": [
    "eTag",
    "id",
    "identity",
    "kind",
    "location",
    "name",
    "properties",
    "sku",
    "type"
  ],
  "propKeysCount": 27
}
```

This baseline is also the runtime-default subject: RBAC, Kubernetes `1.34`, and no explicit ARM `nodeRestriction` profile before the full PUT.

### Full PUT with `securityProfile.nodeRestriction.enabled=true`

The full ManagedCluster GET body was minimally modified by removing only top-level `eTag` and setting `properties.securityProfile.nodeRestriction.enabled=true`. The rest of the ManagedCluster shape was preserved from the GET response.

Command shape:

```bash
ID=$(az aks show -g "$RG" -n "$CLUSTER" --query id -o tsv)
URL="https://management.azure.com${ID}?api-version=2025-04-02-preview"
az rest --method get --resource https://management.azure.com/ --url "$URL" -o json > /tmp/nr83/get-baseline.json
python3 - <<'PY'
import json
d=json.load(open('/tmp/nr83/get-baseline.json'))
d.pop('eTag', None)
props=d.setdefault('properties', {})
sec=props.get('securityProfile') or {}
sec['nodeRestriction']={'enabled': True}
props['securityProfile']=sec
json.dump(d, open('/tmp/nr83/put-enable.json','w'), separators=(',',':'))
PY
az rest --method put --resource https://management.azure.com/ --url "$URL" --body @/tmp/nr83/put-enable.json --headers Content-Type=application/json -o json
```

Payload summary before PUT:

```json
{
  "apiVersion": "2025-04-02-preview",
  "nodeRestriction": {
    "enabled": true
  },
  "topKeys": [
    "id",
    "identity",
    "kind",
    "location",
    "name",
    "properties",
    "sku",
    "type"
  ],
  "propKeysCount": 27,
  "removedTopLevelETag": true
}
```

PUT result excerpt:

```json
{
  "id": "/subscriptions/26fe00f8-9173-4872-9134-bb1d2e00343a/resourcegroups/nr83-20260520/providers/Microsoft.ContainerService/managedClusters/nr83",
  "name": "nr83",
  "provisioningState": "Updating",
  "kubernetesVersion": "1.34",
  "securityProfile": {
    "nodeRestriction": {
      "enabled": true
    }
  }
}
```

After the LRO completed, public CLI GET showed the explicit profile persisted:

```text
04:15:24Z state=Updating
04:15:56Z state=Updating
04:16:28Z state=Updating
04:17:00Z state=Succeeded
```

```json
{
  "kubernetesVersion": "1.34",
  "provisioningState": "Succeeded",
  "securityProfile": {
    "nodeRestriction": {
      "enabled": true
    }
  }
}
```

### Full PUT disable attempt with `securityProfile.nodeRestriction.enabled=false`

The disable payload used a fresh full REST GET after the enable operation reached `Succeeded`, removed only top-level `eTag`, and set `properties.securityProfile.nodeRestriction.enabled=false`.

Command shape:

```bash
az rest --method get --resource https://management.azure.com/ --url "$URL" -o json > /tmp/nr83/get-ready-enable.json
python3 - <<'PY'
import json
d=json.load(open('/tmp/nr83/get-ready-enable.json'))
d.pop('eTag', None)
props=d.setdefault('properties', {})
sec=props.get('securityProfile') or {}
sec['nodeRestriction']={'enabled': False}
props['securityProfile']=sec
json.dump(d, open('/tmp/nr83/put-disable.json','w'), separators=(',',':'))
PY
az rest --method put --resource https://management.azure.com/ --url "$URL" --body @/tmp/nr83/put-disable.json --headers Content-Type=application/json -o json
```

Payload summary before PUT:

```json
{
  "nodeRestriction": {
    "enabled": false
  },
  "kubernetesVersion": "1.34",
  "provisioningState": "Succeeded",
  "propKeysCount": 27,
  "removedTopLevelETag": true
}
```

Observed disable result:

```text
PUT_DISABLE_RC=1
ERROR: Bad Request({
  "code": "BadRequest",
  "details": null,
  "message": "Node restriction is required on version 1.24.0 or above.",
  "subcode": ""
 })
```

Final REST GET after the failed disable attempt confirmed the cluster was not disabled:

```json
{
  "provisioningState": "Succeeded",
  "kubernetesVersion": "1.34",
  "securityProfile": {
    "nodeRestriction": {
      "enabled": true
    }
  }
}
```

**Full-PUT disable-contract verdict:** PASS. The corrected create-or-update PUT path accepts/persists explicit enablement and rejects explicit disablement on Kubernetes `1.34` with the source-expected BadRequest message.

## Runtime-default evidence

### Customer-cluster admission probe method

The runtime-default subject was the same CLI-created RBAC Kubernetes `1.34` cluster before explicit profile enablement. At baseline, public CLI returned `securityProfile.nodeRestriction=null`, and direct REST GET returned `properties.securityProfile={}`. Source says runtime NodeRestriction should nevertheless be enabled by the kube-apiserver admission chain for RBAC clusters on `>=1.24`.

To collect customer-visible runtime evidence, I used the kubelet client identity from the node and attempted to set a restricted `node-restriction.kubernetes.io/*` label on its own Node object. With the NodeRestriction admission plugin enabled, kubelets are forbidden from modifying labels with the `node-restriction.kubernetes.io/` prefix. This probes admission behavior directly; it does not rely on ARM echoing a non-null profile.

Kubelet credential extraction setup:

```bash
az aks get-credentials -g nr83-20260520 -n nr83 --admin --overwrite-existing
NODE=$(kubectl get nodes -o jsonpath='{.items[0].metadata.name}')
cat > /tmp/nr83/kubelet-probe/pod.yaml <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: nr83-kubelet-cert-reader
  namespace: default
spec:
  restartPolicy: Never
  nodeName: $NODE
  tolerations:
  - operator: Exists
  containers:
  - name: reader
    image: mcr.microsoft.com/cbl-mariner/base/core:2.0
    command: ["/bin/sh","-c","sleep 3600"]
    securityContext:
      privileged: true
    volumeMounts:
    - name: kubelet-pki
      mountPath: /host/var/lib/kubelet/pki
      readOnly: true
  volumes:
  - name: kubelet-pki
    hostPath:
      path: /var/lib/kubelet/pki
      type: Directory
EOF
kubectl apply -f /tmp/nr83/kubelet-probe/pod.yaml
kubectl wait --for=condition=Ready pod/nr83-kubelet-cert-reader --timeout=180s
kubectl exec nr83-kubelet-cert-reader -- ls -l /host/var/lib/kubelet/pki
kubectl exec nr83-kubelet-cert-reader -- /bin/sh -c 'for f in /host/var/lib/kubelet/pki/kubelet-client-[0-9]*.pem; do cat "$f"; exit 0; done; exit 1' > /tmp/nr83/kubelet-client-current.pem
```

Observed node and kubelet certificate evidence:

```text
NAME                                STATUS   ROLES    AGE     VERSION   INTERNAL-IP   OS-IMAGE             KERNEL-VERSION      CONTAINER-RUNTIME
aks-nodepool1-27191165-vmss000000   Ready    <none>   4m43s   v1.34.7   10.224.0.4    Ubuntu 22.04.5 LTS   5.15.0-1110-azure   containerd://1.7.31-1
NODE=aks-nodepool1-27191165-vmss000000
pod/nr83-kubelet-cert-reader created
pod/nr83-kubelet-cert-reader condition met
total 8
-rw------- 1 root root 1484 May 20 04:13 kubelet-client-2026-05-20-04-13-04.pem
lrwxrwxrwx 1 root root   59 May 20 04:13 kubelet-client-current.pem -> /var/lib/kubelet/pki/kubelet-client-2026-05-20-04-13-04.pem
-rw------- 1 root root 1557 May 20 04:13 kubelet-server-2026-05-20-04-13-06.pem
lrwxrwxrwx 1 root root   59 May 20 04:13 kubelet-server-current.pem -> /var/lib/kubelet/pki/kubelet-server-2026-05-20-04-13-06.pem
F=/host/var/lib/kubelet/pki/kubelet-client-2026-05-20-04-13-04.pem
pem_has_cert True pem_has_key True pem_bytes 1484
```

Admission probe command:

```bash
SERVER=$(kubectl config view --raw --minify -o jsonpath='{.clusters[0].cluster.server}')
kubectl config view --raw --minify -o jsonpath='{.clusters[0].cluster.certificate-authority-data}' | base64 -d > /tmp/nr83/ca.crt
NODE=$(kubectl get nodes -o jsonpath='{.items[0].metadata.name}')
KUBECONFIG=/dev/null kubectl \
  --server="$SERVER" \
  --certificate-authority=/tmp/nr83/ca.crt \
  --client-certificate=/tmp/nr83/kubelet-client-current.pem \
  --client-key=/tmp/nr83/kubelet-client-current.pem \
  patch node "$NODE" --type=merge \
  -p '{"metadata":{"labels":{"node-restriction.kubernetes.io/nr83-probe":"blocked"}}}' \
  -o json
kubectl get node "$NODE" -o jsonpath='{.metadata.labels.node-restriction\.kubernetes\.io/nr83-probe}'
```

Observed runtime admission result:

```text
PATCH_RC=1
Error from server (Forbidden): nodes "aks-nodepool1-27191165-vmss000000" is forbidden: is not allowed to modify labels: node-restriction.kubernetes.io/nr83-probe
RESTRICTED_LABEL_VALUE=
```

Interpretation:

- The request authenticated with the node/kubelet client certificate strongly enough to reach Kubernetes admission/RBAC and receive a Kubernetes `Forbidden` response for the Node object.
- The rejection reason is specific to the restricted label prefix: `is not allowed to modify labels: node-restriction.kubernetes.io/nr83-probe`.
- The restricted label remained absent.
- Because the cluster was RBAC-enabled, Kubernetes `1.34`, and had omitted/null ARM `securityProfile.nodeRestriction` at baseline, this is direct customer-cluster evidence that the runtime NodeRestriction admission behavior is enabled by default independent of ARM profile echo.

Caveat: this does not expose the kube-apiserver flag list or underlay control-plane chart values. It is nevertheless a reproducible customer-cluster admission behavior test for the source-described runtime default.

**Runtime-default verdict:** PASS for RBAC Kubernetes `>=1.24` default NodeRestriction admission behavior on staging, using a kubelet identity restricted-label mutation denial as the runtime signal.

## Cleanup

Command:

```bash
ssh devbox 'set -euo pipefail
RG=nr83-20260520
az group delete -n "$RG" --yes --no-wait
echo "cleanup_started_rg=$RG at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
'
```

Observed:

```text
cleanup_started_rg=nr83-20260520 at 2026-05-20T04:19:07Z
```

## Capability-model / knowledge-map updates

Applied updates:

- `outputs/e2e-capability-model.json`
  - `node-restriction-disable-contract`: moved from unknown to pass with iteration83 full-PUT evidence.
  - `node-restriction-runtime-default`: moved from unknown to pass with iteration83 runtime admission evidence.
  - `node-restriction-tag-only-patch-shape`: left as a separate unknown/non-contract operation-shape branch; iteration83 did not rerun or reinterpret the tag-only PATCH path.
- `outputs/input-expectation-knowledge-map.md`
  - Replaced the older Node Restriction row that treated iteration62 PATCH as direct fail/unpersisted evidence.
  - Current map now distinguishes full PUT contract pass, runtime-default pass, and tag-only PATCH as separate non-contract evidence.

Validator command:

```bash
cd /app/projects/aks-rp-e2e/capability-model
bun src/validate.ts ../outputs/e2e-capability-model.json
```

Validator result: exit code `0`; `node-restriction-disable-contract` and `node-restriction-runtime-default` now report `status=pass`, while `node-restriction-tag-only-patch-shape` remains in `unknownFeatureIds` by design.
