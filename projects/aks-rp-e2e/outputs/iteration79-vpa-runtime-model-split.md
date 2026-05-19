# Iteration 79 — VPA runtime model split

**Date:** 2026-05-19  
**Scope:** local model/knowledge-map normalization only. No staging, `az`, cluster creation, or remote cloud probe was run in this iteration.

## 1. Iteration78 evidence recap

Iteration78 executed a source-scoped combined KEDA/VPA runtime probe in staging on Kubernetes `1.34` with create-time `--enable-keda --enable-vpa`.

KEDA evidence from `outputs/iteration78-workload-autoscaler-runtime-staging.md` is a runtime pass:

- `workloadAutoScalerProfile.keda.enabled=true` persisted.
- KEDA CRDs, controller/operator/metrics resources, and external metrics APIService were present/ready.
- A cron `ScaledObject` scaled a ready Deployment from 1 replica to 4 ready replicas and then back to 1 ready replica.

VPA evidence from the same artifact is strong but bounded:

- `workloadAutoScalerProfile.verticalPodAutoscaler.enabled=true` persisted.
- VPA CRDs existed.
- `vpa-webhook` service existed.
- `vpa-admission-controller`, `vpa-recommender`, and `vpa-updater` deployments rolled out and were ready.
- A bounded workload using VPA `updateMode: Off` reached recommendation generation: `hamster-vpa` produced CPU/memory recommendations.

This does **not** prove the full handwritten/source OverlayVPA contract. Iteration78 explicitly did not cover Helm release metadata, in-place update, HA/leader-election semantics, certificate renewal, upgrade survival, or OS/arch/version variants.

## 2. Before: grouped VPA runtime representation

Before this iteration, the JSON model had one broad feature:

- `workload-autoscaler-vpa-runtime`

Its expectation path mixed several independent VPA branches:

- `vpa.helmRelease.present=true`
- `vpa.components.ready=true`
- `vpa.recommendations.generated=true`
- `vpa.inplaceUpdate.observed=true`
- `vpa.haAndCertBehavior.valid=true`

Iteration78's bounded pass was attached to that grouped feature through an `unknown` judgment (`iteration78-workload-autoscaler-vpa-runtime-bounded-pass`). That preserved caution, but it still forced the durable model to represent “components/recommendations passed” only as prose inside a grouped unknown.

## 3. After: branch-accurate VPA runtime structure

I updated `outputs/e2e-capability-model.json` so the bounded pass and residual unknowns are separate first-class features.

Final branch statuses:

| Feature ID | Status | Evidence / rationale |
|---|---:|---|
| `workload-autoscaler-vpa-components-recommendations-runtime` | **pass** | Backed by iteration78: VPA CRDs/webhook/service/deployments ready and recommendation generation observed. |
| `workload-autoscaler-vpa-inplace-update-runtime` | **unknown** | Source-derived OverlayVPA branch. Iteration78 used `updateMode: Off`, so no VPA in-place update was observed. |
| `workload-autoscaler-vpa-ha-leader-election-runtime` | **unknown** | Source-derived branch. Iteration78 observed deployment readiness only; it did not validate HA replica expectations or leader-election behavior. |
| `workload-autoscaler-vpa-cert-renewal-runtime` | **unknown** | Source-derived branch. Iteration78 did not exercise webhook certificate lifetime/renewal behavior. |
| `workload-autoscaler-vpa-upgrade-survival-runtime` | **unknown** | Source-derived branch. Iteration78 did not perform a cluster upgrade. |
| `workload-autoscaler-vpa-helm-release-runtime` | **unknown** | Source-derived assertion. Iteration78 checked Kubernetes resources but did not inspect Helm release metadata. |
| `workload-autoscaler-vpa-runtime` | **unknown roll-up** | Retained only as a legacy grouped/source-intent aggregate so downstream references do not break; ranking should prefer the split branches. |

I added precise expectation variables for branches that were previously collapsed under `vpa.haAndCertBehavior.valid`:

- `vpa.haLeaderElection.valid`
- `vpa.certRenewal.valid`
- `vpa.survivesUpgrade`

I did **not** add OS/arch/version-specific VPA feature branches in this iteration. The handwritten inventory clearly says OverlayVPA has OS/arch/version variants, but the current JSON model has no existing VPA OS/arch/version input dimension; adding that dimension should be a separate source-modeling task if those variants become the next priority.

## 4. Files changed

### `outputs/e2e-capability-model.json`

Changes made:

- Added `workload-autoscaler-vpa-components-recommendations-runtime` as a passed feature/test/judgment backed by `iteration78-workload-autoscaler-runtime-staging`.
- Added visible unknown features/tests/judgments for:
  - `workload-autoscaler-vpa-inplace-update-runtime`
  - `workload-autoscaler-vpa-ha-leader-election-runtime`
  - `workload-autoscaler-vpa-cert-renewal-runtime`
  - `workload-autoscaler-vpa-upgrade-survival-runtime`
  - `workload-autoscaler-vpa-helm-release-runtime`
- Kept `workload-autoscaler-vpa-runtime` as an unknown roll-up only.
- Kept `workload-autoscaler-keda-runtime` passed.
- Kept `workload-autoscaler-keda-crud` unknown.

### `outputs/input-expectation-knowledge-map.md`

Changes made:

- Replaced the prior “VPA partial/grouped unknown” language with branch-accurate status.
- Updated next-ranked recommendations after the split.

## 5. Next recommended cloud probe

After this split, the next best cloud run is **not** another broad KEDA/VPA probe.

Recommended ranking:

1. **App Routing DefaultDomainCertificate TLS follow-up, source-hypothesis gated.** This is still the clearest active fail: API/state, DNS, HTTP, CRD creation, and fallback HTTPS are separated, but managed TLS-secret provisioning failed. Do source/controller/owner investigation first and rerun only with a concrete hypothesis.
2. **Focused VPA residual probe if autoscaler remains the priority.** Target `workload-autoscaler-vpa-inplace-update-runtime` and add cheap same-cluster checks for Helm metadata and HA/leader-election. Treat cert renewal and upgrade survival as longer-running branches that need explicit scope before inclusion.
3. **KEDA disable/re-enable CRUD or Node Restriction corrected full PUT/runtime-default probe.** KEDA CRUD is the remaining KEDA lifecycle branch; Node Restriction remains valuable after the operation-shape correction in iteration74.

## 6. Validation

Validated with:

```bash
cd /app/projects/aks-rp-e2e/capability-model
bun src/validate.ts ../outputs/e2e-capability-model.json
```

The validator exited 0. The summary shows:

- `workload-autoscaler-keda-runtime` is passed.
- `workload-autoscaler-vpa-components-recommendations-runtime` is passed.
- VPA residual branches remain in `unknownFeatureIds`: in-place update, HA/leader-election, cert renewal, upgrade survival, Helm release, plus the legacy grouped roll-up.
- `workload-autoscaler-keda-crud` remains in `unknownFeatureIds`.
