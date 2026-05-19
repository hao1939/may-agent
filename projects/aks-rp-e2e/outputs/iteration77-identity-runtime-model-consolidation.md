# Iteration 77 — Identity/OIDC runtime model consolidation

**Date:** 2026-05-19  
**Scope:** local model/knowledge-map consolidation only. No staging, `az`, cluster creation, or cloud probe was run.  
**Inputs read:** `outputs/iteration76-workload-identity-oidc-runtime-staging.md`, `outputs/input-expectation-knowledge-map.md`, and `outputs/e2e-capability-model.json`.

## 1. Iteration76 evidence summary

Iteration76 executed the selected Workload Identity + OIDC runtime probe in staging on Kubernetes `1.34` using create-time public CLI enablement:

- `identity.oidcIssuer.enabled=true`
- `identity.workloadIdentity.enabled=true`
- `identity.runtime.os=linux`
- `identity.kubernetesVersion.branch=gte-1.34-default-enabled`

Observed evidence in `outputs/iteration76-workload-identity-oidc-runtime-staging.md`:

- ARM state persisted `oidcIssuerProfile.enabled=true` with a non-empty issuer URL.
- ARM state persisted `securityProfile.workloadIdentity.enabled=true`.
- OIDC discovery document fetch returned HTTP `200` and contained the expected issuer/JWKS URI shape.
- JWKS fetch returned HTTP `200` and contained RSA signing key fields.
- A Linux pod with Workload Identity labels/annotations received expected `AZURE_*` environment variables and a projected token file.
- The projected token decoded with the expected issuer/audience/subject.
- Cleanup deletion was initiated asynchronously, but post-delete issuer document cleanup was not verified.

Iteration76 explicitly did **not** test Windows token projection, Workload Identity disable/re-enable, signing-key rotation, post-delete issuer cleanup, or Kubernetes `1.33` explicit-enable runtime.

## 2. Before/after model representation

### Before consolidation

The model had broad feature IDs marked `pass` by iteration76 judgments:

- `workload-identity-runtime-token-projection` had `identity.runtime.os=both` and expected Linux token projection, Windows token projection, and disable/re-enable lifecycle. Iteration76 linked a passing judgment to this broad feature even though only the Linux branch was observed.
- `oidc-issuer-default-enabled-runtime` expected persisted issuer, discovery, JWKS, signing-key rotation, and post-delete document deletion. Iteration76 linked a passing judgment to this broad feature even though only persisted issuer/discovery/JWKS were observed.
- `oidc-issuer-v133-explicit-enable-runtime` remained unknown, but it was grouped next to the broad default-enabled runtime feature.

That representation validated structurally, but it risked hiding residual branches because the summary no longer listed Windows token projection, disable/re-enable lifecycle, signing-key rotation, or post-delete cleanup as unknown feature IDs.

### After consolidation

`outputs/e2e-capability-model.json` now splits the branch-partial evidence into precise feature IDs:

Passed iteration76-covered branches:

- `workload-identity-runtime-token-projection-linux`
- `oidc-issuer-default-enabled-discovery-jwks-runtime`

Residual unknown branches:

- `workload-identity-runtime-token-projection-windows`
- `workload-identity-disable-reenable-lifecycle`
- `oidc-issuer-default-enabled-signing-key-rotation`
- `oidc-issuer-default-enabled-post-delete-cleanup`
- `oidc-issuer-v133-explicit-enable-runtime`

The iteration76 evidence remains linked to the passed Linux/default-discovery branches. It is also cited in the unknown residual judgments as negative scope evidence: those branches are unknown because iteration76 named them as non-goals, not because they failed.

## 3. Explicit branch status after consolidation

| Branch | Model feature ID | Status | Evidence / rationale |
|---|---|---|---|
| Linux workload identity token projection | `workload-identity-runtime-token-projection-linux` | **Pass** | Backed by iteration76 Linux pod env vars, projected token file, and decoded issuer/audience/subject. |
| Windows workload identity token projection | `workload-identity-runtime-token-projection-windows` | **Unknown** | Explicit non-goal in iteration76; no Windows pod/pool/token projection was run. |
| Workload Identity disable/re-enable lifecycle | `workload-identity-disable-reenable-lifecycle` | **Unknown** | Explicit non-goal in iteration76; create-time enablement was tested, not lifecycle toggling. |
| OIDC default-enabled discovery/JWKS on Kubernetes `1.34` | `oidc-issuer-default-enabled-discovery-jwks-runtime` | **Pass** | Backed by iteration76 persisted issuer URL, discovery HTTP 200, and JWKS HTTP 200 with RSA key fields. |
| OIDC signing-key rotation | `oidc-issuer-default-enabled-signing-key-rotation` | **Unknown** | Explicit non-goal in iteration76; current JWKS was observed but rotation was not forced or waited for. |
| OIDC post-delete issuer cleanup | `oidc-issuer-default-enabled-post-delete-cleanup` | **Unknown** | Explicit non-goal in iteration76; deletion was initiated asynchronously, but issuer document deletion was not verified. |
| OIDC v1.33 explicit-enable runtime branch | `oidc-issuer-v133-explicit-enable-runtime` | **Unknown** | Not run; iteration76 used Kubernetes `1.34`. |

## 4. Knowledge-map update

`outputs/input-expectation-knowledge-map.md` now records:

- Identity runtime input branches for `identity.runtime.os` and `identity.kubernetesVersion.branch`.
- Identity/OIDC expectation variables for Linux/Windows token projection, disable/re-enable lifecycle, discovery, JWKS, signing-key rotation, and post-delete cleanup.
- A feature-matrix row separating API-state evidence from the passed Linux/default OIDC runtime branch.
- An updated “Next high-density probes” section that no longer lists the completed Linux/default-discovery identity probe as the top next run.

## 5. Validator result

Command run:

```bash
cd /app/projects/aks-rp-e2e/capability-model
bun src/validate.ts ../outputs/e2e-capability-model.json
```

Exit: `0`.

Important post-consolidation summary:

```json
{
  "passedIdentityOidcBranches": [
    "workload-identity-runtime-token-projection-linux",
    "oidc-issuer-default-enabled-discovery-jwks-runtime"
  ],
  "unknownIdentityOidcBranches": [
    "workload-identity-runtime-token-projection-windows",
    "workload-identity-disable-reenable-lifecycle",
    "oidc-issuer-default-enabled-signing-key-rotation",
    "oidc-issuer-default-enabled-post-delete-cleanup",
    "oidc-issuer-v133-explicit-enable-runtime"
  ]
}
```

## 6. Recommended next cloud probe

After consolidation, the next recommended cloud probe is **Combined KEDA/VPA runtime**, not another identity/OIDC run.

Rationale:

- The selected high-density identity Linux/default-discovery probe from iteration75 is now closed with precise pass branches.
- Residual identity/OIDC branches remain visible unknowns but are narrower lifecycle/parity/version edges.
- KEDA/VPA runtime still offers higher next value by upgrading `outputs/iteration61-workload-autoscaler-staging.md` from profile persistence to controller/workload behavior across multiple model features.

Do not run another cloud probe until the KEDA/VPA input paths, expected runtime assertions, and non-goals are explicitly scoped.
