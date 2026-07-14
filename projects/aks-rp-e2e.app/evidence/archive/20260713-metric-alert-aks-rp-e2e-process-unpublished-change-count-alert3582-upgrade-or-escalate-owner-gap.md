# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3582)

- Alert id: `3582`
- Judged at: `2026-07-13T17:42:29Z`
- Chosen operation: `upgrade_or_escalate`
- Metric row at triage: current `17`, threshold `0`, target `0`, priority `P0`
- Owner: `app-ops`

## Current measurement is real

Fresh owner-side recompute from `/app/projects/aks-rp-e2e.app` returned:

```json
{"measuredAt":1783994322651,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":17}
```

Fresh domain-repo state from `/app/projects/aks-rp-e2e` matches the recompute exactly:

- `git rev-list --left-right --count origin/dev...HEAD` => `0 0`
- `git status --short --untracked-files=no | wc -l` => `17`

Tracked dirty files are exactly:

- `features/traffic-applink/tests/traffic-applink-cross-cluster-discovery.ts`
- `features/traffic-azure-service-mesh/packets/addonv2-overlay-source-packet.yaml`
- `features/traffic-azure-service-mesh/specs/traffic-azure-service-mesh-addonv2-overlay.json`
- `features/traffic-azure-service-mesh/specs/traffic-azure-service-mesh-custom-config.json`
- `features/traffic-azure-service-mesh/specs/traffic-azure-service-mesh-egress-gateway.json`
- `features/traffic-azure-service-mesh/specs/traffic-azure-service-mesh-ingress-internal.json`
- `features/traffic-azure-service-mesh/specs/traffic-azure-service-mesh-multi-revision.json`
- `features/traffic-azure-service-mesh/specs/traffic-azure-service-mesh-vm-prerelease-addonv2-cni-matrix.json`
- `features/traffic-azure-service-mesh/specs/traffic-azure-service-mesh-vm-prerelease-addonv2-lifecycle-matrix.json`
- `features/windows/specs/windows-gpu-vm-prerelease-matrix.json`
- `model/knowledge-map/model.json`
- `model/knowledge-map/views/evidence-index.md`
- `model/knowledge-map/views/evidence-matrix.json`
- `model/knowledge-map/views/graph-view.json`
- `model/knowledge-map/views/model.generated.md`
- `model/knowledge-map/views/path-summary.json`
- `model/knowledge-map/views/status-summary.json`

So the breach is current and exact: there are 17 tracked unpublished changes not visible to pipeline runs.

## Why this is no longer a simple `waiting_with_evidence` case

This P0 alert has repeated across multiple owner sessions, but the current task-tree ownership no longer cleanly matches the dirty repo surface.

### 1) The repo diff still cites July 13 draft-family reconcile lineages

The current diffs explicitly cite:

- `domain-traffic-azure-service-mesh-mounted-source-draft-family-reconcile-20260713`
- `domain-windows-vm-prerelease-mounted-source-draft-family-reconcile-20260713`
- `domain-localdns-row55-vm-enable-disable-compact-membership-20260713`
- AppLink cross-cluster rehome wording updates

That means the mixed dirty set is not anonymous churn; it is lineage-bearing repo work.

### 2) But the current live task tree no longer has the earlier exact ASM/Windows reconcile owner leaves

Fresh task-tree grep from `/app/projects/aks-rp-e2e.app/tasks/tree.json` shows:

- `domain/traffic-azure-service-mesh-mounted-source-draft-family-reconcile-20260713` => **0** current matches
- `domain/windows-vm-prerelease-mounted-source-draft-family-reconcile-20260713` => **0** current matches

So earlier evidence that treated those dirty files as still covered by active exact domain leaves is no longer current truth.

### 3) The remaining live holders do not cover the whole 17-file dirty surface

Current live tree still carries some related blocked holders, but they do not explain the whole mixed residue:

- `hold-compact-traffic-applink-cross-cluster-self-contained-carrier-gap-20260707` is still present and does explain the single AppLink replay-file residue.
- `hold-compact-windows-eligibility-frontier-20260707` is still present, but its accepted frontier covers `windows-calico`, `windows-mixed-os-combination-virtualmachines`, `windows-node-pool-create-virtualmachines-gen2`, and `windows.runner-pipeline-harness-virtualmachines` — **not** `windows-gpu-vm-prerelease-matrix`.
- the live ASM wait found in the tree is `hold-spec-traffic-asm-ingress-internal-helm-secret-product-gap-frontier-20260707b`, which explains only one ASM branch, not the full 8-file dirty ASM authoring slice currently in the repo.

So the current task tree has some adjacent domain waits, but it does **not** currently provide one exact owner surface for most of the dirty unpublished authoring.

### 4) Shared model/view residue is mixed across multiple lineages

The current `model/knowledge-map/model.json` diff and regenerated maintained views contain evidence links and wording changes spanning:

- AppLink cross-cluster rehome,
- ASM draft-family reconcile,
- Windows VM prerelease draft-family reconcile, and
- LocalDNS row-55 enable/disable accepted pass-history alignment.

That means the 7 knowledge-map files are not one single-owner checkpointable slice either; they are mixed projection output from multiple lineages.

## Why `upgrade_or_escalate` is the correct operation

Choose `upgrade_or_escalate`.

- Not `resolve_stale`: fresh recompute still returns `17`.
- Not `calibrate_metric`: threshold `0` is still correct because unpublished repo-local changes remain invisible to pipeline runs.
- Not `downgrade_priority`: this is still a real publication-visibility breach at `P0`.
- Not `document_exception`: this is not an accepted long-term exception.
- Not `fix_root_cause`: this workflow does not provide a safe task-tree mutation path, publication path, or review-approved checkpoint decomposition for this mixed 17-file residue. App-ops cannot truthfully publish, revert, or hand-edit runtime task state from this alert-triage surface.
- Not `waiting_with_evidence`: the same alert has repeated across owner sessions, and the current repo/task-tree mismatch means passive waiting would preserve stale ownership assumptions instead of surfacing the current process gap.

## Exact escalation

Escalate in project context: the next planner / owner review must create or refresh exact publication-hygiene ownership for the current 17-file residue before this alert can truthfully clear.

### Decision needed

Choose one explicit process move for the current dirty surface:

1. create one exact owner task (or smallest exact set of tasks) that represents the current unpublished residue, including the uncovered `windows-gpu-vm-prerelease-matrix` and broader ASM/model/view writeback; or
2. split and checkpoint/revert the residue into reviewed publishable slices with exact evidence.

### Why escalation is required now

- the breach is real and repeated;
- current evidence files from earlier sessions rely on exact owner leaves that are no longer present in the live tree;
- the mixed dirty surface crosses AppLink, ASM, Windows, LocalDNS, and generated knowledge-map projection files; and
- this read/write surface can create durable evidence notes, but it cannot safely mutate runtime task state or publish the mixed repo residue.

## Required next validation

Validate at the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner when planner/project context lands an exact owner-refresh or publication-hygiene task and the repo dirty surface is recomputed.
