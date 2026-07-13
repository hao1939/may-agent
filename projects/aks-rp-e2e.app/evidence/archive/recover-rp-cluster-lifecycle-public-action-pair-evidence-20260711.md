# Recover — rp-cluster-lifecycle public-action pair evidence — 2026-07-11

Task: `domain/recover-rp-cluster-lifecycle-public-action-pair-evidence-20260711`
Attempt: `a_domain_recover-rp-cluster-lifecycle-public-action-pair-evidence-20260711_20260711001227`

## Why this recovery exists

The prior worker review concluded that the bounded public-action pair should be split into narrower promotion reviews, but the declared evidence file was missing from the **app workspace** during planning review.

This note recreates the durable app-workspace evidence and rechecks the pair conclusion against the current repo, source packet, accepted app artifacts, and current model/view state.

## Pair under review

- `spec.rp-cluster-lifecycle.list-credentials`
- `spec.rp-cluster-lifecycle.rotate-certificates`

## Sources used

### Domain repo files

- `features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-list-credentials.json`
- `features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-rotate-certificates.json`
- `features/rp-cluster-lifecycle/tests/rp-cluster-lifecycle-list-credentials.ts`
- `features/rp-cluster-lifecycle/tests/rp-cluster-lifecycle-rotate-certificates.ts`
- `features/rp-cluster-lifecycle/packets/api-quartet.yaml`
- `model/knowledge-map/model.json`
- `model/knowledge-map/views/path-summary.json`
- `evidence/archive/review-rp-cluster-lifecycle-public-action-promotion-pair-20260711.md`
- `evidence/archive/rp-cluster-lifecycle-api-quartet-public-official-references-20260701.md`
- `evidence/archive/20260630-rp-cluster-lifecycle-api-quartet-public-official-references.md`
- `evidence/archive/domain-classify-rp-cluster-lifecycle-residual-promotion-quartet-20260710.md`

### App-workspace evidence and task history

- `.state/spec-loop/artifacts/28392278640/aks-rp-e2e-28392278640-spec-test-results/test-results/single-rp-cluster-lifecycle-list-credentials_840128/artifacts/rp-cluster-lifecycle-list-credentials/spec-runner/result.json`
- `.state/spec-loop/artifacts/28392400441/aks-rp-e2e-28392400441-spec-test-results/test-results/single-rp-cluster-lifecycle-rotate-certificates_048982/artifacts/rp-cluster-lifecycle-rotate-certificates/spec-runner/result.json`
- `.state/spec-loop/artifacts/28392278640/aks-rp-e2e-28392278640-spec-test-results/workflow-metadata.json`
- `.state/spec-loop/artifacts/28392400441/aks-rp-e2e-28392400441-spec-test-results/workflow-metadata.json`
- `tasks/archive/done-leaves-20260629181226991.json`
- `agents/owner/last-session.md`

## Recovered factual state

### 1) Public-contract support is still strong for both specs

`features/rp-cluster-lifecycle/packets/api-quartet.yaml` still classifies both members as `publicContractStatus: official-reference`.

The public-official-reference notes still support that classification:

- `list-credentials`
  - public `listClusterAdminCredential`
  - public `listClusterUserCredential`
  - `CredentialResults.kubeconfigs[]`
  - `server-fqdn` on both actions
  - `format` semantics on user credentials
- `rotate-certificates`
  - public `rotateClusterCertificates`
  - long-running action semantics
  - disruptive operational behavior documented in Learn

So the pair still belongs to the same broad **public ManagedCluster action** family.

### 2) The current model/view still under-represents live evidence for both

Current repo-local path summaries still show both as draft / live-behavior-unknown:

- `path.rp-cluster-lifecycle.list-credentials`
  - `status: draft`
  - `postureSummary: live-behavior-unknown`
- `path.rp-cluster-lifecycle.rotate-certificates`
  - `status: draft`
  - `postureSummary: live-behavior-unknown`

But the two paths are not in the same exact repo-local condition:

- `list-credentials` already carries richer normalized linkage notes in `model.json`.
- `rotate-certificates` still reads more like a wiring-restoration carrier in both `model.json` and `path-summary.json`.

That asymmetry still argues against keeping them bundled as one promotion decision.

### 3) The missing app-workspace fact from the rejected review: both specs already have accepted single-spec pass artifacts

The earlier pair-review note said there was no accepted durable live artifact for either member. That is no longer a safe conclusion once the app-workspace evidence is recovered.

#### `spec.rp-cluster-lifecycle.list-credentials`

Recovered app artifact:

- run id: `28392278640`
- workflow loop key: `verify-spec-rp-cluster-lifecycle-list-credentials-a_verify-spec-rp-cluster-lifecycle-list`
- result path: `.state/spec-loop/artifacts/28392278640/aks-rp-e2e-28392278640-spec-test-results/test-results/single-rp-cluster-lifecycle-list-credentials_840128/artifacts/rp-cluster-lifecycle-list-credentials/spec-runner/result.json`

Recovered result facts:

- `status: passed`
- `summary: List credentials: 3/3 claims passed`
- audited cluster:
  - resource group: `rg-test-001-credentials-840128`
  - cluster: `aks-test-001-credentials-840128`
  - apiVersion: `2026-03-02-preview`
- claim assertions passed:
  - `admin-creds-returned` — `HTTP 200, kubeconfigs=1`
  - `user-creds-returned` — `HTTP 200, kubeconfigs=1`
  - `kubeconfig-valid` — `value length=13164`

Recovered accepted-task history:

- `tasks/archive/done-leaves-20260629181226991.json` records the spec-loop review as accepted terminal pass for this spec.

#### `spec.rp-cluster-lifecycle.rotate-certificates`

Recovered app artifact:

- run id: `28392400441`
- workflow loop key: `verify-spec-rp-cluster-lifecycle-rotate-certificates-a_verify-spec-rp-cluster-lifecycle-ro`
- result path: `.state/spec-loop/artifacts/28392400441/aks-rp-e2e-28392400441-spec-test-results/test-results/single-rp-cluster-lifecycle-rotate-certificates_048982/artifacts/rp-cluster-lifecycle-rotate-certificates/spec-runner/result.json`

Recovered result facts:

- `status: passed`
- `summary: Rotate certs: 3/3 claims passed`
- audited cluster:
  - resource group: `rg-test-001-ertificates-048982`
  - cluster: `aks-test-001-ertificates-048982`
  - apiVersion: `2026-03-02-preview`
- claim assertions passed:
  - `rotation-accepted` — `HTTP 204`
  - `rotation-completes` — `provisioningState=Succeeded`
  - `cluster-healthy` — `powerState=Running`

Recovered accepted-task history:

- `tasks/archive/done-leaves-20260629181226991.json` records the spec-loop review as accepted terminal pass for this spec.

## Reassessment of the earlier pair conclusion

## What is still supported

The **split** conclusion is still supported.

These two specs should **not** remain one combined promotion review because:

1. their current repo-local maturity differs;
2. `list-credentials` and `rotate-certificates` carry different exact promotion questions;
3. each already has a distinct accepted single-spec run id and exact claim evidence;
4. keeping them paired would blur whether the remaining work is:
   - promotion/model reconciliation for `list-credentials`, or
   - promotion/model reconciliation for `rotate-certificates`.

## What is no longer fully supported

The stronger earlier claim — **“neither spec should be promoted yet because no accepted live artifact exists”** — is **not supported after recovery**.

Recovered app artifacts show both specs already have accepted single-spec pass evidence in app-owned spec-loop history.

So the truthful updated conclusion is:

- **do not keep the pair together**, but
- **split them because each now deserves its own narrow promotion review**, not because both still lack accepted live evidence.

## Planner-ready next-step recommendations

The planner should create **two separate bounded review leaves** and should not reopen broader `rp-cluster-lifecycle` work.

### A) Separate review leaf for `spec.rp-cluster-lifecycle.list-credentials`

Recommended review scope:

- use the recovered accepted pass artifact from run `28392278640`
- compare it against:
  - `features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-list-credentials.json`
  - `features/rp-cluster-lifecycle/tests/rp-cluster-lifecycle-list-credentials.ts`
  - `features/rp-cluster-lifecycle/packets/api-quartet.yaml`
  - `model/knowledge-map/model.json`
  - `model/knowledge-map/views/path-summary.json`

Exact review question:

- Is the recovered accepted pass evidence enough to promote `spec.rp-cluster-lifecycle.list-credentials`, or is there one remaining bounded model/evidence reconciliation step?

Exact next-step expectation if not promoted:

- state the one remaining blocker precisely, limited to `list-credentials` only.

### B) Separate review leaf for `spec.rp-cluster-lifecycle.rotate-certificates`

Recommended review scope:

- use the recovered accepted pass artifact from run `28392400441`
- compare it against:
  - `features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-rotate-certificates.json`
  - `features/rp-cluster-lifecycle/tests/rp-cluster-lifecycle-rotate-certificates.ts`
  - `features/rp-cluster-lifecycle/packets/api-quartet.yaml`
  - `model/knowledge-map/model.json`
  - `model/knowledge-map/views/path-summary.json`

Exact review question:

- Is the recovered accepted pass evidence enough to promote `spec.rp-cluster-lifecycle.rotate-certificates`, or is there one remaining bounded model/evidence reconciliation step?

Exact next-step expectation if not promoted:

- state the one remaining blocker precisely, limited to `rotate-certificates` only.

## Recommendation summary

- **Do not keep `list-credentials` and `rotate-certificates` together as one promotion pair.**
- **Split them into two narrower promotion reviews.**
- The reason for the split is now stronger and more specific than in the rejected review:
  - both members already have recovered accepted pass artifacts,
  - but each now needs a separate promotion decision against current model/view posture.

## Bottom line

Recovered app-workspace evidence shows:

- `spec.rp-cluster-lifecycle.list-credentials` has accepted pass evidence from run `28392278640`
- `spec.rp-cluster-lifecycle.rotate-certificates` has accepted pass evidence from run `28392400441`

Therefore the prior “no accepted live evidence exists” rationale is stale.

The durable conclusion that remains true is narrower:

- **split the pair now**, and
- review `list-credentials` and `rotate-certificates` as separate promotion leaves without reopening broader `rp-cluster-lifecycle` maintenance, operation-status, or package-partial work.
