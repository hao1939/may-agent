# Iteration 70 — App Routing default-domain TLS/DefaultDomainCertificate staging follow-up

**Date:** 2026-05-19  
**Feature focus:** Web App Routing/App Routing default-domain TLS certificate provisioning and HTTPS traffic with a real workload/Service/Ingress  
**Staging target:** `devbox:/home/hayua/rp` using Azure CLI + `aks-preview` + `kubectl`  
**Verdict:** **FAIL for DefaultDomainCertificate TLS-secret provisioning; HTTPS route reachability only passed with nginx's fake fallback certificate.** A fresh staging cluster enabled App Routing default domain, deployed hello-world, and accepted a `DefaultDomainCertificate` CR targeting `default/default-domain-tls`. However, after 60 polling attempts from `18:26:28Z` to `18:54:10Z`, the CR never reached `Available` and `default-domain-tls` remained `NotFound`. A TLS Ingress still resolved and `curl -vk https://test.<domain>/` returned HTTP `200`, but the served certificate was `CN=Kubernetes Ingress Controller Fake Certificate` with `SSL_VERIFY=18`, so this does **not** validate managed default-domain certificate provisioning.

## Run log

Primary raw run log on devbox:

```text
/tmp/iteration70-app-routing-defaultdomain-tls-staging.log
```

Driver script used from `/home/hayua/rp` on devbox:

```bash
/tmp/app-routing70-tls.sh
```

Run window:

```text
START_UTC=2026-05-19T18:19:52Z
END_UTC=2026-05-19T18:56:06Z
```

## Docs/source preflight

Commands run on devbox from `/home/hayua/rp` included:

```bash
grep -R 'DefaultDomainCertificate\|default-domain-tls\|TestTLSTraffic\|WaitForDefaultDomainCertificate' -n \
  test/e2ev3/sigs/traffic/plans/approuting | head -160
```

Relevant source behavior:

```text
test/e2ev3/sigs/traffic/plans/approuting/default_domain.go:33: defaultDomainSecretName = "default-domain-tls"
test/e2ev3/sigs/traffic/plans/approuting/default_domain.go:74: createDefaultDomainCert = &steps.CreateDefaultDomainCertificate{
test/e2ev3/sigs/traffic/plans/approuting/default_domain.go:80: waitForDefaultDomainCert = &steps.WaitForDefaultDomainCertificate{
test/e2ev3/sigs/traffic/plans/approuting/default_domain.go:91: testTLSTraffic = new(steps.TestTLSTraffic)
test/e2ev3/sigs/traffic/plans/approuting/default_domain.go:180: // Create and wait for the DefaultDomainCertificate before creating the ingress
test/e2ev3/sigs/traffic/plans/approuting/steps/wait_for_default_domain_certificate.go:54: available := meta.FindStatusCondition(cert.Status.Conditions, approutingv1alpha1.DefaultDomainCertificateConditionTypeAvailable)
test/e2ev3/sigs/traffic/plans/approuting/steps/wait_for_default_domain_certificate.go:63: return errs.Errorf("DefaultDomainCertificate %s/%s is not yet available", w.Namespace, w.Name)
```

The manifest shape used by the e2ev3 helper is equivalent to:

```yaml
apiVersion: approuting.kubernetes.azure.com/v1alpha1
kind: DefaultDomainCertificate
metadata:
  name: default-domain-cert
  namespace: default
spec:
  target:
    secret: default-domain-tls
```

## Staging resource names

```text
SUBSCRIPTION=26fe00f8-9173-4872-9134-bb1d2e00343a
RG=approuting-tls-20260519-1819
CL=approuting70tls
LOC=eastus2
KCFG=/tmp/approuting-tls-20260519-1819-approuting70tls-kubeconfig
DOMAIN=6a0caab77ec7cb0001d55571.eastus2.aksapp.io
HOST=test.6a0caab77ec7cb0001d55571.eastus2.aksapp.io
```

## Cluster create and default-domain enablement

Commands:

```bash
az group create -n "$RG" -l "$LOC"
az aks create -g "$RG" -n "$CL" --location "$LOC" --node-count 1 --enable-managed-identity --generate-ssh-keys
az aks approuting enable -g "$RG" -n "$CL" --enable-default-domain
az aks approuting defaultdomain show -g "$RG" -n "$CL" -o json
```

Observed output:

```text
CREATE_EXIT=0
ENABLE_EXIT=0
```

Default-domain state:

```json
{
  "ingressProfile": {
    "webAppRouting": {
      "defaultDomain": {
        "domainName": "6a0caab77ec7cb0001d55571.eastus2.aksapp.io",
        "enabled": true
      },
      "enabled": true
    }
  },
  "provisioningState": "Succeeded"
}
```

`az aks approuting defaultdomain show` returned:

```json
{
  "domainName": "6a0caab77ec7cb0001d55571.eastus2.aksapp.io",
  "enabled": true
}
```

## Kube baseline and workload

Commands:

```bash
az aks get-credentials -g "$RG" -n "$CL" --file "$KCFG" --overwrite-existing
export KUBECONFIG="$KCFG"
kubectl api-resources | grep -i 'default.*domain\|app.*routing\|certificate'
kubectl get crd | grep -i 'default.*domain\|app.*routing\|certificate'
kubectl apply -f /tmp/${RG}-workload.yaml
kubectl rollout status deployment/hello-world --timeout=300s
```

Observed:

```text
CREDS_EXIT=0
defaultdomaincertificates                               approuting.kubernetes.azure.com/v1alpha1   true         DefaultDomainCertificate
defaultdomaincertificates.approuting.kubernetes.azure.com   2026-05-19T18:24:31Z
deployment.apps/hello-world created
service/hello-world created
deployment "hello-world" successfully rolled out
```

Workload became ready:

```text
NAME                          READY   UP-TO-DATE   AVAILABLE   AGE   CONTAINERS    IMAGES
deployment.apps/hello-world   1/1     1            1           11s   hello-world   mcr.microsoft.com/azuredocs/aks-helloworld:v1

NAME                             READY   STATUS    RESTARTS   AGE   IP
pod/hello-world-5cc57979-bbx28   1/1     Running   0          12s   10.244.0.136
```

## DefaultDomainCertificate CR and TLS secret wait

Manifest applied:

```yaml
apiVersion: approuting.kubernetes.azure.com/v1alpha1
kind: DefaultDomainCertificate
metadata:
  name: default-domain-cert
  namespace: default
spec:
  target:
    secret: default-domain-tls
```

Observed creation:

```text
defaultdomaincertificate.approuting.kubernetes.azure.com/default-domain-cert created
CERT_CREATED=0
```

The wait loop polled the CR and target secret 60 times. First poll:

```text
CERT_POLL=1 UTC=2026-05-19T18:26:28Z
apiVersion: approuting.kubernetes.azure.com/v1alpha1
kind: DefaultDomainCertificate
metadata:
  creationTimestamp: "2026-05-19T18:26:28Z"
  generation: 1
  name: default-domain-cert
  namespace: default
  resourceVersion: "2465"
  uid: af1bf740-097e-4988-9202-1c81d6b02b3a
spec:
  target:
    secret: default-domain-tls
Error from server (NotFound): secrets "default-domain-tls" not found
error: timed out waiting for the condition on defaultdomaincertificates/default-domain-cert
CRT_LEN=0 KEY_LEN=0 CERT_AVAILABLE=0
```

Final poll:

```text
CERT_POLL=60 UTC=2026-05-19T18:54:10Z
apiVersion: approuting.kubernetes.azure.com/v1alpha1
kind: DefaultDomainCertificate
metadata:
  creationTimestamp: "2026-05-19T18:26:28Z"
  generation: 1
  name: default-domain-cert
  namespace: default
  resourceVersion: "2465"
  uid: af1bf740-097e-4988-9202-1c81d6b02b3a
spec:
  target:
    secret: default-domain-tls
Error from server (NotFound): secrets "default-domain-tls" not found
error: timed out waiting for the condition on defaultdomaincertificates/default-domain-cert
CRT_LEN=0 KEY_LEN=0 CERT_AVAILABLE=0
CERT_AVAILABLE=0 SECRET_READY=0
```

There were no status conditions or events on the CR in final diagnostics:

```text
Name:         default-domain-cert
Namespace:    default
API Version:  approuting.kubernetes.azure.com/v1alpha1
Kind:         DefaultDomainCertificate
Spec:
  Target:
    Secret:  default-domain-tls
Events:      <none>
Error from server (NotFound): secrets "default-domain-tls" not found
```

## TLS Ingress and HTTPS traffic probe

Even though `default-domain-tls` was not provisioned, the run applied a TLS Ingress to distinguish route reachability from managed certificate provisioning:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: hello-world-tls-ingress
  namespace: default
spec:
  ingressClassName: webapprouting.kubernetes.azure.com
  tls:
  - hosts:
    - test.6a0caab77ec7cb0001d55571.eastus2.aksapp.io
    secretName: default-domain-tls
  rules:
  - host: test.6a0caab77ec7cb0001d55571.eastus2.aksapp.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: hello-world
            port:
              number: 80
```

Observed:

```text
ingress.networking.k8s.io/hello-world-tls-ingress created
INGRESS_CREATED=0
```

Ingress received the App Routing load balancer IP:

```text
NAME                                                CLASS                                HOSTS                                             ADDRESS        PORTS
ingress.networking.k8s.io/hello-world-tls-ingress   webapprouting.kubernetes.azure.com   test.6a0caab77ec7cb0001d55571.eastus2.aksapp.io   20.75.65.120   80, 443
```

Initial HTTPS probes failed before DNS propagation, then probe 3 resolved DNS and reached the workload:

```text
PROBE_POLL=3 UTC=2026-05-19T18:55:55Z
20.75.65.120
* Host test.6a0caab77ec7cb0001d55571.eastus2.aksapp.io:443 was resolved.
* IPv4: 20.75.65.120
* Connected to test.6a0caab77ec7cb0001d55571.eastus2.aksapp.io (20.75.65.120) port 443
* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384 / X25519 / RSASSA-PSS
* Server certificate:
*  subject: O=Acme Co; CN=Kubernetes Ingress Controller Fake Certificate
*  issuer: O=Acme Co; CN=Kubernetes Ingress Controller Fake Certificate
*  SSL certificate verify result: self-signed certificate (18), continuing anyway.
< HTTP/2 200
< content-type: text/html; charset=utf-8
HTTP_CODE=200
REMOTE_IP=20.75.65.120
EFFECTIVE_URL=https://test.6a0caab77ec7cb0001d55571.eastus2.aksapp.io/
SSL_VERIFY=18
CURL_EXIT=0 CURL_HTTP_CODE=200 BODY_HEAD=<!DOCTYPE html> <html xmlns="http://www.w3.org/1999/xhtml"> <head>     <link rel="stylesheet" type="text/css" href="/static/default.css">     <title>Welcome to Azure Container Serv
```

Interpretation: route/DNS/backend path worked, but TLS did **not** use the requested `default-domain-tls` secret. `curl -vk` succeeded only because verification was intentionally skipped, and curl reported the nginx fake self-signed certificate.

## Cleanup

Command:

```bash
az group delete -n "$RG" --yes --no-wait
az group show -n "$RG" --query '{name:name,provisioningState:properties.provisioningState}' -o json
```

Observed:

```text
CLEANUP_EXIT=0
{
  "name": "approuting-tls-20260519-1819",
  "provisioningState": "Deleting"
}
```

Final run summary:

```text
SUMMARY CREATE_EXIT=0 ENABLE_EXIT=0 CREDS_EXIT=0 DOMAIN=6a0caab77ec7cb0001d55571.eastus2.aksapp.io HOST=test.6a0caab77ec7cb0001d55571.eastus2.aksapp.io CERT_CREATED=0 CERT_AVAILABLE=0 SECRET_READY=0 INGRESS_CREATED=0 DNS_READY=1 CURL_EXIT=0 CURL_HTTP_CODE=200 CLEANUP_EXIT=0
```

## Verdict table

| Case | Surface/command | Observed result | Classification | Verdict |
|---|---|---|---|---|
| Source preflight | e2ev3 source grep | Scenario creates `DefaultDomainCertificate` targeting `default-domain-tls`, waits for `Available`, then tests HTTPS traffic | Source context | Pass |
| Fresh cluster create | `az aks create --node-count 1 --enable-managed-identity` | Exit `0`; cluster reached `Succeeded`, Kubernetes `1.34` | Setup | Pass |
| Enable default domain | `az aks approuting enable --enable-default-domain` | Exit `0`; persisted `webAppRouting.enabled=true`, `defaultDomain.enabled=true`, domain `6a0caab77ec7cb0001d55571.eastus2.aksapp.io` | RP/API state | Pass |
| CRD availability | `kubectl api-resources`; `kubectl get crd` | `defaultdomaincertificates.approuting.kubernetes.azure.com` present | Kubernetes API setup | Pass |
| Workload/Service | `kubectl apply`; `kubectl rollout status` | Deployment available `1/1`; pod Running; ClusterIP Service exposed port 80 | Workload setup | Pass |
| DefaultDomainCertificate create | `kubectl apply` CR targeting `default-domain-tls` | CR created; `CERT_CREATED=0` | CR submission | Pass |
| TLS secret provisioning | 60 polls of CR condition and `kubectl get secret default-domain-tls` | CR never reached `Available`; secret remained `NotFound`; no CR status conditions/events | **DefaultDomainCertificate controller behavior** | **Fail** |
| TLS Ingress | `kubectl apply` TLS Ingress referencing `default-domain-tls` | Ingress created and received LB IP `20.75.65.120` | Route setup | Pass |
| DNS | `getent hosts`; `dig +short` | `test.<domain>` resolved to `20.75.65.120` after propagation | Default-domain DNS | Pass |
| HTTPS traffic | `curl -vkL https://test.<domain>/` | Returned `HTTP/2 200`, but certificate was `Kubernetes Ingress Controller Fake Certificate`; `SSL_VERIFY=18` | Backend route reachable with fallback cert | Partial / not a TLS-secret pass |
| Cleanup | `az group delete --yes --no-wait` | Exit `0`; immediate group state `Deleting` | Cleanup | Initiated |

## Capability-model update and validation

Because this run produced a clear TLS-secret verdict, I updated `outputs/e2e-capability-model.json` with separate coverage instead of overwriting the existing HTTP traffic pass:

- expectation variable: `tls.secret.provisioned`
- feature: `app-routing-default-domain-tls-secret`
- evidence: `iteration70-app-routing-defaultdomain-tls-staging`
- test case: `AppRouting_DefaultDomain_TLS_Secret_Staging`
- judgment: `judgment-app-routing-defaultdomain-tls-secret-staging`

Validator command:

```bash
cd /app/projects/aks-rp-e2e/capability-model
bun src/validate.ts ../outputs/e2e-capability-model.json
```

Validator result: exit `0`. Summary excerpt:

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
  "blockedFeatureIds": [],
  "unknownFeatureIds": []
}
```

## Conclusion and next unblock action

The older standalone DefaultDomainCertificate/TLS-secret failure is now reproduced on staging with a fresh cluster and real workload. App Routing default-domain HTTP and backend routing are reachable, but the `DefaultDomainCertificate` controller did not provision `default/default-domain-tls` in the observed window, and HTTPS used nginx's fake self-signed fallback certificate.

**Next action:** escalate or investigate with the App Routing/default-domain certificate owner. The precise failing contract is: after `az aks approuting enable --enable-default-domain`, creating `DefaultDomainCertificate default/default-domain-cert` with `spec.target.secret=default-domain-tls` should make the CR `Available` and create a Kubernetes TLS secret; in this staging run neither happened after ~28 minutes. Repeat the scenario only after the controller/operator provisioning path or required hidden precondition is identified.
