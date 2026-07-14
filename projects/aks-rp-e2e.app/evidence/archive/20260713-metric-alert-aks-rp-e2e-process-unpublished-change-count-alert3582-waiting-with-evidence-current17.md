# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3582)

- Alert id: `3582`
- Judged at: `2026-07-13T17:42:29Z`
- Chosen operation: `waiting_with_evidence`
- Metric row at triage: current `8`, threshold `0`, target `0`, priority `P0`
- Owner: `app-ops`

## Current measurement is real, and worse than the alert text now says

Fresh direct recompute from `/app/projects/aks-rp-e2e.app` returned:

```json
{"measuredAt":1783980106680,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":17}
```

Fresh domain-repo state from `/app/projects/aks-rp-e2e` matches that recompute exactly:

- `git rev-list --left-right --count origin/dev...HEAD` => `0 0`
- `git status --short --untracked-files=no | wc -l` => `17`

So the open alert row is already understated, but it is **not** stale in the safe-to-resolve sense. The current breach is still real: the repo currently has 17 tracked unpublished changes that are not visible to pipeline runs.

## Exact current unpublished surface

The 17 tracked dirty files split cleanly into two represented domain slices plus generated model spillover:

### A) 1 AppLink file from an accepted draft rehome

- `features/traffic-applink/tests/traffic-applink-cross-cluster-discovery.ts`

Current diff tightens wording only: the branch is no longer described as waiting for missing exact authority; it is now described as public-surface grounded but still nonlive because it lacks a self-contained execution carrier.

That file matches accepted domain evidence already recorded in:

- `../aks-rp-e2e/evidence/archive/domain-traffic-applink-cross-cluster-upgrade-draft-rehome-20260713.md`

and the still-open exact compact wait remains:

- `hold-compact-traffic-applink-cross-cluster-self-contained-carrier-gap-20260707`

### B) 9 Azure Service Mesh draft-family reconciliation files still under active domain work

- `features/traffic-azure-service-mesh/packets/addonv2-overlay-source-packet.yaml`
- `features/traffic-azure-service-mesh/specs/traffic-azure-service-mesh-addonv2-overlay.json`
- `features/traffic-azure-service-mesh/specs/traffic-azure-service-mesh-custom-config.json`
- `features/traffic-azure-service-mesh/specs/traffic-azure-service-mesh-egress-gateway.json`
- `features/traffic-azure-service-mesh/specs/traffic-azure-service-mesh-ingress-internal.json`
- `features/traffic-azure-service-mesh/specs/traffic-azure-service-mesh-multi-revision.json`
- `features/traffic-azure-service-mesh/specs/traffic-azure-service-mesh-vm-prerelease-addonv2-cni-matrix.json`
- `features/traffic-azure-service-mesh/specs/traffic-azure-service-mesh-vm-prerelease-addonv2-lifecycle-matrix.json`
- `model/knowledge-map/model.json`

These edits are coherent. The spec/model diffs all point at the same active reconciliation note id:

- `domain-traffic-azure-service-mesh-mounted-source-draft-family-reconcile-20260713`

and the live task tree currently shows the exact active owner task:

- `domain/traffic-azure-service-mesh-mounted-source-draft-family-reconcile-20260713`

That task is still `state: active` with owner `aks-explorer`, and its goal is to reconcile the mounted-source-only ASM draft family and update repo-local traffic artifacts without live execution.

### C) 7 generated knowledge-map view files from the same accepted/active domain writeback

- `model/knowledge-map/views/evidence-index.md`
- `model/knowledge-map/views/evidence-matrix.json`
- `model/knowledge-map/views/graph-view.json`
- `model/knowledge-map/views/model.generated.md`
- `model/knowledge-map/views/path-summary.json`
- `model/knowledge-map/views/status-summary.json`

These are not anonymous extra drift. The model/view diffs regenerate the exact AppLink + ASM posture updates above:

- AppLink cross-cluster-discovery now says the authority gap is closed by accepted public Application Network references and the remaining gap is the missing self-contained execution carrier.
- ASM row 69 stays a standalone overlay/non-Cilium ceiling.
- ASM custom-config, egress-gateway, ingress-internal, and multi-revision are explicitly rehomed under the shared lifecycle carrier.
- ASM shared CNI/lifecycle matrix paths stay source-grounded draft carriers, not live verdicts.

## Why `waiting_with_evidence` is the correct operation

Choose `waiting_with_evidence`.

- Not `resolve_stale`: fresh recompute is `17`, so the breach is current.
- Not `calibrate_metric`: threshold `0` is still correct because unpublished repo-local domain changes remain invisible to pipeline runs.
- Not `downgrade_priority`: this is still a real publication-visibility gap, not harmless dashboard noise.
- Not `fix_root_cause`: the dominant residue is active AKS domain authoring owned by `aks-explorer`, and app-ops should not publish, revert, or reinterpret that domain content from alert triage while the exact ASM reconciliation task is still active.
- Not `upgrade_or_escalate`: the work is represented, owned, and bounded already; the problem is not an unowned emergency or a destructive-action decision.
- Not `document_exception`: this is live domain residue, not an accepted long-term exception.

## Exact represented waits in project state

Two exact task-tree surfaces already carry the current residue truthfully:

1. `domain/traffic-azure-service-mesh-mounted-source-draft-family-reconcile-20260713`
   - active domain owner task for the 9-file ASM + model writeback slice.
2. `hold-compact-traffic-applink-cross-cluster-self-contained-carrier-gap-20260707`
   - blocked exact compact wait for the remaining AppLink cross-cluster carrier gap tied to the single modified AppLink test file.

So the current unpublished-change breach is represented work, not anonymous repo drift.

## Exact wait, observer, and fallback

### Wait
Wait for the current represented domain frontier to settle truthfully:

1. `domain/traffic-azure-service-mesh-mounted-source-draft-family-reconcile-20260713` must either complete with accepted evidence and a publish/revert-ready residue story, or return an exact blocker; and
2. the AppLink cross-cluster residue stays behind `hold-compact-traffic-applink-cross-cluster-self-contained-carrier-gap-20260707` until a self-contained live-admissible carrier exists or accepted authority changes the boundary.

### Observer
`app-ops` rechecks via:

- the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`,
- `bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count`,
- `git rev-list --left-right --count origin/dev...HEAD`,
- `git status --short --untracked-files=no` in `/app/projects/aks-rp-e2e`, and
- the task-tree state for `domain/traffic-azure-service-mesh-mounted-source-draft-family-reconcile-20260713` and `hold-compact-traffic-applink-cross-cluster-self-contained-carrier-gap-20260707`.

### Fallback
If the next snapshot still breaches after the ASM task completes, planner/app-ops should create or refresh one exact publication-or-revert successor for the remaining represented residue instead of reopening generic unpublished-change diagnosis. If the same 17-file surface persists unchanged with no active owner transition, escalate that process gap as an app-ops repair issue.

## Required next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if `domain/traffic-azure-service-mesh-mounted-source-draft-family-reconcile-20260713` changes state and the repo-local dirty surface is recomputed.