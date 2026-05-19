# Iteration 76 — Workload Identity + OIDC runtime token/discovery staging probe

**Date:** 2026-05-19  
**Feature focus:** AKS OIDC issuer runtime discovery/JWKS and Workload Identity Linux pod token projection  
**Staging target:** `devbox:/home/hayua/rp` via `ssh devbox` and Azure CLI `aks-preview`  
**Verdict:** PASS for Linux workload identity runtime token projection and PASS for the Kubernetes >=1.34 OIDC runtime discovery/JWKS branch. Windows token projection, signing-key rotation, post-delete issuer cleanup, and workload identity disable/re-enable were explicit non-goals and remain unknown sub-branches.

## Probe intent and non-goals

Intent copied from iteration75 probe selection:

- Primary coverage:
  - Linux workload identity token projection.
  - OIDC issuer discovery document reachability.
  - OIDC JWKS reachability/structure.
- Exact non-goals for this first runtime pass:
  - Windows token projection.
  - OIDC signing-key rotation.
  - Post-delete issuer cleanup/document deletion.
  - Combining the run with KEDA/VPA, App Routing, or other feature probes.
  - Workload identity disable/re-enable lifecycle.

## Exact cluster/API inputs

- Resource group: `wi-runtime-76-20260519`
- Cluster: `wi76`
- Location: `eastus2`
- Enablement path used: create-time public CLI enablement.
- Cluster input flags:
  - `--enable-managed-identity`
  - `--enable-oidc-issuer`
  - `--enable-workload-identity`
- Modeled input state:
  - `identity.oidcIssuer.enabled=true`
  - `identity.workloadIdentity.enabled=true`
  - `identity.runtime.os=linux` for the runtime pod branch. The model feature still has a broader `both` OS source contract; Windows was intentionally not run.
  - `identity.kubernetesVersion.branch=gte-1.34-default-enabled` for the selected OIDC runtime branch.
- Observed Kubernetes version: `1.34`.

## Devbox environment/context check

Command:

```bash
ssh devbox 'az account show --query "{name:name,id:id,tenantId:tenantId}" -o json && az extension show -n aks-preview --query "{name:name,version:version}" -o json'
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
  "version": "20.0.0b6"
}
```

## Cluster create and ARM persisted state

Command:

```bash
ssh devbox 'set -euo pipefail
RG=wi-runtime-76-20260519
CLUSTER=wi76
LOC=eastus2
az group create -n "$RG" -l "$LOC" --query "{name:name,location:location,provisioningState:properties.provisioningState}" -o json
az aks create -g "$RG" -n "$CLUSTER" --location "$LOC" --node-count 1 --enable-managed-identity --enable-oidc-issuer --enable-workload-identity --generate-ssh-keys --query "{id:id,name:name,location:location,provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,oidcIssuerProfile:oidcIssuerProfile,securityProfile:securityProfile}" -o json
az aks show -g "$RG" -n "$CLUSTER" --query "{provisioningState:provisioningState,kubernetesVersion:kubernetesVersion,oidcIssuerProfile:oidcIssuerProfile,securityProfile:securityProfile}" -o json'
```

Resource group result:

```json
{
  "location": "eastus2",
  "name": "wi-runtime-76-20260519",
  "provisioningState": "Succeeded"
}
```

Create output excerpt:

```json
{
  "id": "/subscriptions/26fe00f8-9173-4872-9134-bb1d2e00343a/resourcegroups/wi-runtime-76-20260519/providers/Microsoft.ContainerService/managedClusters/wi76",
  "kubernetesVersion": "1.34",
  "location": "eastus2",
  "name": "wi76",
  "oidcIssuerProfile": {
    "enabled": true,
    "issuerUrl": "https://eastus2.oic.prod-aks.azure.com/72f988bf-86f1-41af-91ab-2d7cd011db47/98bd4b4c-2565-42d8-aab8-8a8b64520263/"
  },
  "provisioningState": "Succeeded",
  "securityProfile": {
    "workloadIdentity": {
      "enabled": true
    }
  }
}
```

Follow-up `az aks show` confirmed:

```json
{
  "kubernetesVersion": "1.34",
  "oidcIssuerProfile": {
    "enabled": true,
    "issuerUrl": "https://eastus2.oic.prod-aks.azure.com/72f988bf-86f1-41af-91ab-2d7cd011db47/98bd4b4c-2565-42d8-aab8-8a8b64520263/"
  },
  "provisioningState": "Succeeded",
  "securityProfile": {
    "workloadIdentity": {
      "enabled": true
    }
  }
}
```

## OIDC discovery and JWKS evidence

Command:

```bash
ssh devbox 'set -euo pipefail
RG=wi-runtime-76-20260519
CLUSTER=wi76
ISSUER=$(az aks show -g "$RG" -n "$CLUSTER" --query oidcIssuerProfile.issuerUrl -o tsv)
echo "ISSUER=$ISSUER"
python3 - <<PY
import json, urllib.request, os
issuer=os.environ.get("ISSUER") or "$ISSUER"
for name,url in [("discovery", issuer.rstrip("/")+"/.well-known/openid-configuration")]:
    with urllib.request.urlopen(url, timeout=30) as r:
        body=r.read(); print(name, "status", r.status, "bytes", len(body)); data=json.loads(body); print(json.dumps({k:data.get(k) for k in ["issuer","jwks_uri","response_types_supported","subject_types_supported","id_token_signing_alg_values_supported"]}, indent=2))
        jwks_uri=data["jwks_uri"]
with urllib.request.urlopen(jwks_uri, timeout=30) as r:
    body=r.read(); print("jwks status", r.status, "bytes", len(body)); jwks=json.loads(body); print(json.dumps({"keys_count": len(jwks.get("keys",[])), "first_key_fields": sorted(jwks.get("keys", [{}])[0].keys()) if jwks.get("keys") else []}, indent=2))
PY'
```

Observed output:

```text
ISSUER=https://eastus2.oic.prod-aks.azure.com/72f988bf-86f1-41af-91ab-2d7cd011db47/98bd4b4c-2565-42d8-aab8-8a8b64520263/
discovery status 200 bytes 439
```

Discovery body excerpt:

```json
{
  "issuer": "https://eastus2.oic.prod-aks.azure.com/72f988bf-86f1-41af-91ab-2d7cd011db47/98bd4b4c-2565-42d8-aab8-8a8b64520263/",
  "jwks_uri": "https://eastus2.oic.prod-aks.azure.com/72f988bf-86f1-41af-91ab-2d7cd011db47/98bd4b4c-2565-42d8-aab8-8a8b64520263/openid/v1/jwks",
  "response_types_supported": [
    "id_token"
  ],
  "subject_types_supported": [
    "public"
  ],
  "id_token_signing_alg_values_supported": [
    "RS256"
  ]
}
```

JWKS result:

```text
jwks status 200 bytes 1720
```

JWKS structure excerpt:

```json
{
  "keys_count": 2,
  "first_key_fields": [
    "alg",
    "e",
    "kid",
    "kty",
    "n",
    "use"
  ]
}
```

## Kubernetes service account / federated identity / pod setup

Command:

```bash
ssh devbox 'set -euo pipefail
RG=wi-runtime-76-20260519
CLUSTER=wi76
NS=wi-runtime
SA=wi-sa
IDENT=wi76-uai
FED=wi76-fic
TENANT=$(az account show --query tenantId -o tsv)
ISSUER=$(az aks show -g "$RG" -n "$CLUSTER" --query oidcIssuerProfile.issuerUrl -o tsv)
az aks get-credentials -g "$RG" -n "$CLUSTER" --overwrite-existing >/tmp/wi76-getcreds.log
cat /tmp/wi76-getcreds.log
az identity create -g "$RG" -n "$IDENT" -l eastus2 --query "{name:name,clientId:clientId,principalId:principalId,id:id}" -o json
CLIENT_ID=$(az identity show -g "$RG" -n "$IDENT" --query clientId -o tsv)
az identity federated-credential create -g "$RG" --identity-name "$IDENT" -n "$FED" --issuer "$ISSUER" --subject "system:serviceaccount:$NS:$SA" --audiences api://AzureADTokenExchange --query "{name:name,issuer:issuer,subject:subject,audiences:audiences}" -o json
kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -
kubectl create serviceaccount "$SA" -n "$NS" --dry-run=client -o yaml | kubectl apply -f -
kubectl annotate serviceaccount "$SA" -n "$NS" azure.workload.identity/client-id="$CLIENT_ID" --overwrite
kubectl label serviceaccount "$SA" -n "$NS" azure.workload.identity/use=true --overwrite || true
kubectl get sa "$SA" -n "$NS" -o yaml | sed -n "1,80p"'
```

Observed identity and federated credential:

```json
{
  "clientId": "c8a102f9-d53b-4849-bd00-696a401a2108",
  "id": "/subscriptions/26fe00f8-9173-4872-9134-bb1d2e00343a/resourcegroups/wi-runtime-76-20260519/providers/Microsoft.ManagedIdentity/userAssignedIdentities/wi76-uai",
  "name": "wi76-uai",
  "principalId": "1e24e25d-a249-49a0-8cfb-9519a3f3cfa0"
}
```

```json
{
  "audiences": [
    "api://AzureADTokenExchange"
  ],
  "issuer": "https://eastus2.oic.prod-aks.azure.com/72f988bf-86f1-41af-91ab-2d7cd011db47/98bd4b4c-2565-42d8-aab8-8a8b64520263/",
  "name": "wi76-fic",
  "subject": "system:serviceaccount:wi-runtime:wi-sa"
}
```

Observed Kubernetes service account excerpt:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  annotations:
    azure.workload.identity/client-id: c8a102f9-d53b-4849-bd00-696a401a2108
  labels:
    azure.workload.identity/use: "true"
  name: wi-sa
  namespace: wi-runtime
```

## Linux pod token-projection evidence

A first completed pod confirmed the projected env vars and token file path/size, but my inline Python token decoder was malformed by shell quoting. I therefore ran a second live pod and decoded the token from the devbox side. The first pod still produced useful positive projection evidence:

```text
AZURE_CLIENT_ID=c8a102f9-d53b-4849-bd00-696a401a2108
AZURE_TENANT_ID=72f988bf-86f1-41af-91ab-2d7cd011db47
AZURE_FEDERATED_TOKEN_FILE=/var/run/secrets/azure/wi/token/azure-identity-token
AZURE_AUTHORITY_HOST=https://login.microsoftonline.com/
TOKEN_FILE_EXISTS=yes
TOKEN_FILE_BYTES=1574
```

Second live-pod command:

```bash
ssh devbox 'set -eo pipefail
NS=wi-runtime
SA=wi-sa
kubectl delete pod wi-token-probe-live -n "$NS" --ignore-not-found=true >/dev/null
cat > /tmp/wi76-pod-live.yaml <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: wi-token-probe-live
  namespace: wi-runtime
  labels:
    azure.workload.identity/use: "true"
spec:
  serviceAccountName: wi-sa
  restartPolicy: Never
  containers:
  - name: probe
    image: mcr.microsoft.com/cbl-mariner/base/core:2.0
    command: ["/bin/sh", "-c", "sleep 600"]
EOF
kubectl apply -f /tmp/wi76-pod-live.yaml
kubectl wait --for=condition=Ready pod/wi-token-probe-live -n "$NS" --timeout=240s
kubectl get pod wi-token-probe-live -n "$NS" -o wide
kubectl exec -n "$NS" wi-token-probe-live -- /bin/sh -c "env | grep ^AZURE_ | sort; echo TOKEN_FILE_EXISTS=\$(test -f \"\$AZURE_FEDERATED_TOKEN_FILE\" && echo yes || echo no); echo TOKEN_FILE_BYTES=\$(wc -c < \"\$AZURE_FEDERATED_TOKEN_FILE\"); cat \"\$AZURE_FEDERATED_TOKEN_FILE\"" > /tmp/wi76-token-evidence.txt
sed -n "1,8p" /tmp/wi76-token-evidence.txt
TOKEN=$(tail -n 1 /tmp/wi76-token-evidence.txt)
TOKEN="$TOKEN" python3 - <<PY
import os, json, base64
tok=os.environ["TOKEN"].strip(); parts=tok.split(".")
def dec(s):
    s += "="*((4-len(s)%4)%4)
    return json.loads(base64.urlsafe_b64decode(s.encode()))
h=dec(parts[0]); p=dec(parts[1])
print("TOKEN_DOT_COUNT", len(parts)-1)
print("TOKEN_HEADER", json.dumps({k:h.get(k) for k in ["alg","kid","typ"]}, sort_keys=True))
print("TOKEN_PAYLOAD", json.dumps({k:p.get(k) for k in ["aud","iss","sub"]}, sort_keys=True))
PY
kubectl describe pod wi-token-probe-live -n "$NS" | sed -n "1,180p"'
```

Observed live pod status:

```text
NAME                  READY   STATUS    RESTARTS   AGE   IP             NODE                                NOMINATED NODE   READINESS GATES
wi-token-probe-live   1/1     Running   0          2s    10.244.0.173   aks-nodepool1-40542640-vmss000000   <none>           <none>
```

Projected env/token evidence:

```text
AZURE_AUTHORITY_HOST=https://login.microsoftonline.com/
AZURE_CLIENT_ID=c8a102f9-d53b-4849-bd00-696a401a2108
AZURE_FEDERATED_TOKEN_FILE=/var/run/secrets/azure/wi/token/azure-identity-token
AZURE_TENANT_ID=72f988bf-86f1-41af-91ab-2d7cd011db47
TOKEN_FILE_EXISTS=yes
TOKEN_FILE_BYTES=1581
```

Decoded token evidence:

```text
TOKEN_DOT_COUNT 2
TOKEN_HEADER {"alg": "RS256", "kid": "FB8r8Gids7NIbJu01EXmluD4yU69Rodcy5V9Mudkpfc", "typ": null}
TOKEN_PAYLOAD {"aud": ["api://AzureADTokenExchange"], "iss": "https://eastus2.oic.prod-aks.azure.com/72f988bf-86f1-41af-91ab-2d7cd011db47/98bd4b4c-2565-42d8-aab8-8a8b64520263/", "sub": "system:serviceaccount:wi-runtime:wi-sa"}
```

Pod `describe` excerpt confirmed workload identity mutation injected env vars and a projected volume:

```text
Environment:
  AZURE_CLIENT_ID:             c8a102f9-d53b-4849-bd00-696a401a2108
  AZURE_TENANT_ID:             72f988bf-86f1-41af-91ab-2d7cd011db47
  AZURE_FEDERATED_TOKEN_FILE:  /var/run/secrets/azure/wi/token/azure-identity-token
  AZURE_AUTHORITY_HOST:        https://login.microsoftonline.com/
Mounts:
  /var/run/secrets/azure/wi from azure-workload-identity-reserved-ff88286545af5ea351721f2ec98c00 (ro)
Volumes:
  azure-workload-identity-reserved-ff88286545af5ea351721f2ec98c00:
    Type:                    Projected (a volume that contains injected data from multiple sources)
    TokenExpirationSeconds:  3600
```

## Cleanup status

Command:

```bash
ssh devbox 'set -euo pipefail
RG=wi-runtime-76-20260519
kubectl delete pod wi-token-probe-live -n wi-runtime --ignore-not-found=true >/dev/null || true
az group delete -n "$RG" --yes --no-wait
echo "cleanup_delete_initiated=$?"
az group show -n "$RG" --query "{name:name,provisioningState:properties.provisioningState}" -o json || true'
```

Observed output:

```text
cleanup_delete_initiated=0
```

```json
{
  "name": "wi-runtime-76-20260519",
  "provisioningState": "Deleting"
}
```

Cleanup verdict: asynchronous resource-group deletion was successfully initiated; immediate follow-up showed the group in `Deleting` state. Because `--no-wait` was used, this artifact does not claim synchronous completion.

## Verdicts

| Model feature / branch | Verdict | Evidence | Notes |
|---|---|---|---|
| `workload-identity-runtime-token-projection` | PASS for Linux runtime token projection | ARM state persisted, federated identity credential created, service account annotated/labeled, Linux pod reached Running, `AZURE_*` env vars injected, token file existed, token decoded with expected issuer/audience/subject | The broader source feature includes Windows and disable/re-enable lifecycle; those sub-branches remain unknown/non-goals. |
| `oidc-issuer-default-enabled-runtime` | PASS for Kubernetes `1.34` discovery/JWKS runtime branch | `oidcIssuerProfile.enabled=true`, non-empty issuer URL, discovery HTTP 200, JWKS HTTP 200 with 2 keys and RSA signing fields | Signing-key rotation and post-delete issuer cleanup remain unknown/non-goals. |
| `oidc-issuer-v133-explicit-enable-runtime` | Not run | N/A | Explicit v1.33 branch was intentionally not selected. |

## Capability-model update and validation

Updated `outputs/e2e-capability-model.json` with:

- New evidence ref: `iteration76-workload-identity-oidc-runtime-staging`.
- New/updated test cases:
  - `Iteration76_WorkloadIdentity_Linux_Runtime_Staging`
  - `Iteration76_OIDC_DefaultEnabled_Runtime_Staging`
- New judgments:
  - `iteration76-workload-identity-runtime-token-projection-partial-pass`
  - `iteration76-oidc-issuer-default-enabled-runtime-partial-pass`

Validator command:

```bash
cd /app/projects/aks-rp-e2e/capability-model
bun src/validate.ts ../outputs/e2e-capability-model.json
```

Validator exit: `0`.

Important summary changes:

```json
{
  "workload-identity-runtime-token-projection": "pass",
  "oidc-issuer-default-enabled-runtime": "pass",
  "oidc-issuer-v133-explicit-enable-runtime": "unknown"
}
```

`unknownFeatureIds` no longer includes `workload-identity-runtime-token-projection` or `oidc-issuer-default-enabled-runtime`; it still includes `oidc-issuer-v133-explicit-enable-runtime`, plus unrelated unrun runtime/lifecycle gaps.

## Capability-model conclusion

Iteration76 closes the highest-density runtime bridge selected in iteration75 for the Linux/default-enabled branch: AKS staging accepts and persists OIDC issuer + workload identity at create time, serves OIDC discovery and JWKS documents, and injects Linux workload identity projected-token plumbing into a labeled pod using an annotated Kubernetes service account and matching Azure federated credential.

Do not rerun this same Linux/default-enabled probe unless the control plane or workload identity implementation changes. Future identity work should target a deliberately different branch: Windows token projection, v1.33 explicit-enable behavior, signing-key rotation, post-delete issuer cleanup, or disable/re-enable lifecycle.
