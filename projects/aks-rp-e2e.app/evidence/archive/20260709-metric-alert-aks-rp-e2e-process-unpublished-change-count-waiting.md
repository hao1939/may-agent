# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (2026-07-09)

- Alert id: `3300`
- Judged at: `2026-07-09T11:43:09Z`
- Chosen operation: `waiting_with_evidence`
- Metric row at triage: current `12`, threshold `0`, target `0`, priority `P0`
- Owner: `app-ops`

## Current measurement is real

The metric implementation in `projects/aks-rp-e2e.app/scripts/project-metrics.ts` counts:

- each line from `git status --porcelain=v1 --branch` in `/app/projects/aks-rp-e2e`
- plus any `ahead N` branch divergence from the status header

Fresh live repo check during this triage returned:

```text
## dev...origin/dev [ahead 1]
 M features/cluster-autoscaler/compact/staging.diagnostics.json
 M features/cluster-autoscaler/compact/staging.plan.json
 M features/cluster-autoscaler/compact/staging.summary.md
 M features/network-cni/specs/network-cni-vm-prerelease-calico-eno-migration-matrix.json
 M model/knowledge-map/model.json
 M model/knowledge-map/views/evidence-index.md
 M model/knowledge-map/views/evidence-matrix.json
 M model/knowledge-map/views/graph-view.json
 M model/knowledge-map/views/model.generated.md
 M model/knowledge-map/views/path-summary.json
 M model/knowledge-map/views/status-summary.json
```

That is `11` modified tracked paths plus `1` ahead commit, which exactly explains the current metric value `12`.

## Exact attribution of the unpublished surface

### 1) Active cluster-autoscaler compact work owns 3 tracked files

`projects/aks-rp-e2e.app/tasks/tree.json` currently shows active task `compact-feature-cluster-autoscaler` with goal:

> "Generate and verify the cluster-autoscaler feature compact package, including the exact checked-in compact summary/plan/diagnostics artifact slice that currently accounts for the repo's 3 unpublished files, and either publish that coherent slice or leave an exact blocker."

Its outputs include the current dirty compact files:

- `features/cluster-autoscaler/compact/staging.plan.json`
- `features/cluster-autoscaler/compact/staging.diagnostics.json`

and its goal explicitly names the exact three-file compact slice. So 3 of the 12 unpublished changes are already truthfully represented by a live domain task, not orphaned residue.

### 2) Reviewed network-cni writeback work explains the remaining 8 tracked modifications

Current dirty files also include one `network-cni` spec plus seven maintained knowledge-map files:

- `features/network-cni/specs/network-cni-vm-prerelease-calico-eno-migration-matrix.json`
- `model/knowledge-map/model.json`
- `model/knowledge-map/views/evidence-index.md`
- `model/knowledge-map/views/evidence-matrix.json`
- `model/knowledge-map/views/graph-view.json`
- `model/knowledge-map/views/model.generated.md`
- `model/knowledge-map/views/path-summary.json`
- `model/knowledge-map/views/status-summary.json`

These align with the already-reviewed network-cni mutation/writeback packets created today:

- `projects/aks-rp-e2e/evidence/archive/align-network-cni-reviewed-writeback-20260709.md`
- `projects/aks-rp-e2e/evidence/archive/review-network-cni-ready-mutation-carriers-20260709.md`
- `projects/aks-rp-e2e/evidence/archive/writeback-network-cni-passed-artifact-trio-20260709.md`

Those packets explicitly document maintained updates to:

- `model/knowledge-map/model.json`
- `model/knowledge-map/views/path-summary.json`
- the ENO migration matrix wording / network-cni writeback surfaces

So the current remaining 8 tracked mutations are attributable to an in-flight reviewed domain writeback slice rather than a stale measurement bug.

### 3) The `ahead 1` portion is blocked on the known shared publication/auth wait

`projects/aks-rp-e2e.app/tasks/tree.json` currently holds blocked task `wait-shared-azure-devops-auth-capable-runtime-provider-response-20260709` with goal:

> "Preserve one exact shared wait for Azure DevOps auth-capable runtime/provider response needed to publish authoritative origin/dev slices and recover Azure DevOps artifacts, including unpublished commit 64eb19b43 and existing publish-after-auth compact/spec successors."

That wait is the exact current explanation for why an already-created commit can still be invisible to the Azure DevOps pipeline.

## Judgment

Choose `waiting_with_evidence`.

Why this is not `resolve_stale`:
- live git state still shows `11` modified tracked paths and `ahead 1`, so the breach is current.

Why this is not `calibrate_metric`:
- threshold `0` remains correct; the metric is measuring a real repo-to-pipeline visibility gap.

Why this is not `fix_root_cause` from app-ops in this session:
- the dirty surface is already attributed to active/reviewed domain work owned by `aks-explorer`, not hidden orphan residue;
- the remaining publication gap is already represented by the exact shared auth-capable runtime/provider wait;
- app-ops can safely preserve the process judgment here, but should not publish or reshape domain slices by hand.

## Required next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if either:

1. `compact-feature-cluster-autoscaler` publishes or replaces its exact three-file compact slice, and/or
2. the shared wait `wait-shared-azure-devops-auth-capable-runtime-provider-response-20260709` clears and the pending origin/dev-visible publication happens.

## 2026-07-10 refresh

I revalidated the same alert one owner session later and the live repo/process facts still match the earlier `waiting_with_evidence` judgment.

### Live repo count still exactly explains metric value 12

Fresh `git status --porcelain=v1 --branch` in `/app/projects/aks-rp-e2e` returned:

```text
## dev...origin/dev [ahead 1]
 M features/cluster-autoscaler/compact/staging.diagnostics.json
 M features/cluster-autoscaler/compact/staging.plan.json
 M features/cluster-autoscaler/compact/staging.summary.md
 M features/network-cni/specs/network-cni-vm-prerelease-calico-eno-migration-matrix.json
 M model/knowledge-map/model.json
 M model/knowledge-map/views/evidence-index.md
 M model/knowledge-map/views/evidence-matrix.json
 M model/knowledge-map/views/graph-view.json
 M model/knowledge-map/views/model.generated.md
 M model/knowledge-map/views/path-summary.json
 M model/knowledge-map/views/status-summary.json
```

That is still `11` tracked modifications plus `1` ahead commit, so the metric remains live and non-stale.

### Current task/wait ownership is still exact

`projects/aks-rp-e2e.app/tasks/tree.json` still shows:

- active task `compact-feature-cluster-autoscaler` with goal text explicitly saying the checked-in compact summary/plan/diagnostics slice currently accounts for the repo's `3 unpublished files` and must either be published or replaced by an exact blocker;
- blocked task `wait-shared-azure-devops-auth-capable-runtime-provider-response-20260709` still carrying the exact auth/runtime publication wait for unpublished commit `64eb19b43` and origin/dev visibility.

### The remaining reviewed writeback surface is still attributable, not orphaned

The current `network-cni` spec + knowledge-map dirty set still aligns with the reviewed writeback packets:

- `evidence/archive/align-network-cni-reviewed-writeback-20260709.md`
- `evidence/archive/review-network-cni-ready-mutation-carriers-20260709.md`
- `evidence/archive/writeback-network-cni-passed-artifact-trio-20260709.md`

Those packets document exactly why the maintained `network-cni` spec/model files changed, including the ENO migration matrix wording and accepted pass/writeback updates for the related knowledge-map surfaces.

## Refreshed judgment

Keep `waiting_with_evidence`.

Reason: the metric is still real, but the current unpublished surface is already represented by an active domain compact holder, reviewed network-cni writeback surfaces, and one exact shared human/runtime publication wait. App-ops should not falsely resolve or recalibrate a still-breaching metric, and this session does not have a safe app-ops-owned publication action that would make the repo immediately origin/dev-visible.
