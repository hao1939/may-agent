# Iteration 81 — App Routing DefaultDomainCertificate TLS owner escalation packet

**Date:** 2026-05-20  
**Scope:** owner-ready escalation packet and model/map bookkeeping only. No staging, Azure, cluster, or cloud probe was run in this iteration.  
**Primary evidence:** `outputs/iteration70-app-routing-defaultdomain-tls-staging.md` and `outputs/iteration80-app-routing-tls-source-hypothesis.md`

## TL;DR verdict

Iteration70 used a **valid customer-side `DefaultDomainCertificate` CR/input** that matches handwritten e2ev3 intent and source-visible CRD/controller requirements. The observed failure is therefore classified as a **valid-input App Routing default-domain TLS-secret provisioning failure** with suspected operator/default-domain certificate-supply or CCP/underlay configuration involvement.

Do **not** launch another blind customer-cluster-only rerun. A rerun is useful only if it collects CCP `app-routing-operator` diagnostics plus underlay `default-domain-svc` diagnostics, or if an App Routing owner supplies a concrete missing precondition/fix to validate.

## Evidence bundle

Project artifacts:

- `outputs/iteration70-app-routing-defaultdomain-tls-staging.md` — staging repro: default domain enabled, CRD present, `DefaultDomainCertificate` accepted, but no `default/default-domain-tls` Secret or `Available=True` after ~28 minutes; HTTPS 200 used nginx fake fallback certificate.
- `outputs/iteration80-app-routing-tls-source-hypothesis.md` — source-first comparison: iteration70 CR shape/name/namespace/target secret/wait ordering match handwritten e2ev3 and source-visible CRD/controller requirements; decision is owner escalation before rerun.

Relevant source paths inspected on `devbox:/home/hayua/rp` in iteration80:

- `test/e2ev3/sigs/traffic/plans/approuting/default_domain.go`
- `test/e2ev3/sigs/traffic/plans/approuting/steps/create_default_domain_certificate.go`
- `test/e2ev3/sigs/traffic/plans/approuting/steps/wait_for_default_domain_certificate.go`
- `test/e2ev3/sigs/traffic/plans/approuting/steps/collect_diagnostics.go`
- `bazel-rp/external/gazelle++go_deps+test_e2ev3_com_github_azure_aks_app_routing_operator/api/v1alpha1/defaultdomaincertificate_types.go`
- `bazel-rp/external/gazelle++go_deps+test_e2ev3_com_github_azure_aks_app_routing_operator/config/crd/bases/approuting.kubernetes.azure.com_defaultdomaincertificates.yaml`
- `bazel-rp/external/gazelle++go_deps+test_e2ev3_com_github_azure_aks_app_routing_operator/pkg/controller/defaultdomaincert/default_domain_cert_controller.go`
- `bazel-rp/external/gazelle++go_deps+test_e2ev3_com_github_azure_aks_app_routing_operator/pkg/config/config.go`
- `bazel-rp/external/gazelle++go_deps+test_e2ev3_com_github_azure_aks_app_routing_operator/pkg/controller/controller.go`
- `bazel-rp/ccp/control-plane-core/charts/kube-control-plane/charts/app-routing-operator/templates/deployment.yaml`

## Minimal repro contract

Preconditions observed in staging:

1. App Routing default domain is enabled and persisted:
   - `webAppRouting.enabled=true`
   - `webAppRouting.defaultDomain.enabled=true`
   - generated domain assigned, e.g. `*.eastus2.aksapp.io`
2. Customer cluster contains CRD:
   - `defaultdomaincertificates.approuting.kubernetes.azure.com/v1alpha1`

Customer input applied:

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

Expected from handwritten e2ev3/source contract:

- Secret `default/default-domain-tls` is created as a Kubernetes TLS Secret.
- `DefaultDomainCertificate/default-domain-cert` reaches condition `Available=True`.
- TLS Ingress using `secretName: default-domain-tls` can serve managed default-domain TLS, not an nginx fallback certificate.

Observed in iteration70:

- CR creation succeeded: `defaultdomaincertificate.approuting.kubernetes.azure.com/default-domain-cert created`.
- After 60 polling attempts over ~28 minutes (`18:26:28Z` to `18:54:10Z`), the CR never reached `Available=True`.
- `default/default-domain-tls` remained `NotFound`.
- Final CR diagnostics showed spec only, no status conditions, and no events.
- `curl -vk https://test.<domain>/` returned HTTP `200`, but the served certificate was `CN=Kubernetes Ingress Controller Fake Certificate` with `SSL_VERIFY=18`; this proves backend/fallback reachability only, not managed TLS success.

## Why this is not currently a probe-input correction

Iteration80 source comparison found:

- handwritten e2ev3 uses `defaultDomainCertName = "default-domain-cert"` and `defaultDomainSecretName = "default-domain-tls"`;
- the handwritten path creates and waits for `DefaultDomainCertificate` before creating/testing the TLS Ingress;
- `CreateDefaultDomainCertificate.Do` constructs the same `metadata.name`, `metadata.namespace`, and `spec.target.secret` shape used by iteration70;
- `WaitForDefaultDomainCertificate.Do` waits for condition `Available=True`;
- CRD validation requires `spec.target` with a Kubernetes DNS-label-style secret name, which `default-domain-tls` satisfies;
- source-visible controller behavior should generate/upsert the target Secret and then set `Available=True`.

The failure shape — accepted CR, no target Secret, no status, no events — fits source-side possibilities such as the default-domain reconciler not processing the CR, certificate source/service/config unavailability, operator crash/config/RBAC issues, or operator image/chart/config mismatch. It does not currently fit malformed customer input.

## Owner questions

1. Is iteration70's CR shape complete for the current staging App Routing operator?
2. Should default-domain certificate material be available automatically after `az aks approuting enable --enable-default-domain` persists enabled state and installs the CRD?
3. Which `app-routing-operator` image/chart version owns the `DefaultDomainCertificate` flow in current staging?
4. What logs, metrics, Kubernetes events, or status conditions indicate default-domain certificate generation/fetch failure?
5. Is there a known staging precondition, rollout, configuration issue, or fix required for default-domain TLS-secret provisioning?

## Diagnostic rerun gate

A rerun is allowed only if at least one of these is true:

1. The rerun can collect CCP `app-routing-operator` diagnostics:
   - pod image;
   - command/args, especially default-domain flags;
   - env/config relevant to default-domain certificate source/client/zone;
   - pod phase/readiness/restarts;
   - logs from before and after the `DefaultDomainCertificate` creation.
2. The rerun can collect underlay `default-domain-svc` diagnostics:
   - pod/service status;
   - logs covering certificate material fetch/generation requests;
   - errors returned to the operator or MSI/default-domain connector path.
3. An App Routing/default-domain owner supplies a concrete missing precondition, expected operator version, fixed build, configuration change, or corrected CR/namespace convention to validate.

A customer-cluster-only rerun that repeats CLI enablement, CR creation, `kubectl get secret`, and `curl -k` without CCP/underlay diagnostics is not recommended; it would likely reproduce the same missing-secret symptom without identifying the failing component.

## Resume conditions for a focused rerun

Resume with a corrected/diagnostic staging rerun only when one of the following is available:

- owner confirms the CR is missing a required field/annotation/namespace/secret convention and provides the exact corrected manifest;
- owner identifies a staging rollout/configuration/fix and asks for validation against a known expected operator/chart version;
- access or delegation is available to collect CCP `app-routing-operator` and underlay `default-domain-svc` pod image/args/env/status/logs during the repro;
- source inspection identifies a concrete chart flag/value mismatch that can be verified from live CCP pod arguments and logs.

Until then, the durable project status for this branch is: **`fail / owner-diagnostics-needed` for valid-input DefaultDomainCertificate TLS-secret provisioning**, not `probe-input-wrong`.

## Capability-model note

This iteration added `outputs/iteration80-app-routing-tls-source-hypothesis.md` as source-analysis evidence to the App Routing TLS-secret failure branch in `outputs/e2e-capability-model.json`. The observed result remains **fail**; the source evidence only refines the diagnosis from generic TLS-secret failure to valid-input failure requiring owner/CCP diagnostics.
