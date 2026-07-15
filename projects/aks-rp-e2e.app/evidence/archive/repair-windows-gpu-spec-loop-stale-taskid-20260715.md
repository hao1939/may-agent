# Windows GPU spec-loop stale taskId repair — 2026-07-15

- Attempt: `a_ops_repair-windows-gpu-spec-loop-stale-taskid-20260715_20260715053142`
- Spec: `spec.windows-gpu.vm-prerelease-matrix`
- App-owned state: `.state/spec-loop/state.json`
- App memo: `evidence/archive/repair-windows-gpu-spec-loop-stale-taskid-20260715.md`

## Baseline before repair

The controller-visible spec-loop row still pointed at an archived/non-live wait:

- before `status`: `pending`
- before `taskId`: `wait-windows-gpu-vm-prerelease-vms-source-parity-or-reframe-20260715`
- before `successorDisposition`: `windows_gpu_virtualmachines_draft_gap_wait_restored`
- before `resumeCondition`: "Resume only when reviewed same-surface evidence shows an exact current mounted Windows GPU VirtualMachines carrier for spec.windows-gpu.vm-prerelease-matrix, or when an owner-approved repo-local reframe/retirement replaces this draft-gap boundary. Do not rerun the unchanged carrier or merge it into generic Windows or GPU family waits."

Supported live read used during baseline verification:

`cd /app/projects/aks-rp-e2e.app && bun run task-tree show wait-windows-gpu-vm-prerelease-vms-source-parity-or-reframe-20260715`

Observed result: `Task not found: wait-windows-gpu-vm-prerelease-vms-source-parity-or-reframe-20260715`

## Repair applied

Updated only the app-owned spec-loop row for `spec.windows-gpu.vm-prerelease-matrix` via `workflows/lib/spec-loop-store.ts` so it now points at the live accepted successor boundary instead of the archived wait.

### Before → after

- `taskId`: `wait-windows-gpu-vm-prerelease-vms-source-parity-or-reframe-20260715` → `domain/writeback-windows-gpu-vms-legacy-retirement-20260715`
- `status`: `pending` → `pending`
- `review.classification`: `draft_gap_wait_restored_after_stale_auto_close` → `legacy_no_rerun_successor_boundary`

### Current truthful successor boundary now named in state

- live successor writeback leaf: `domain/writeback-windows-gpu-vms-legacy-retirement-20260715`
- exact prerequisite authoring leaves:
  - `domain/author-windows-gpu-vmss-prerelease-grid-20260715`
  - `domain/author-windows-gpu-vmss-prerelease-cuda-20260715`

This preserves the accepted no-unchanged-rerun posture because the spec-loop row now routes only through the successor-trio lineage and explicitly forbids rerunning the unchanged legacy VirtualMachines carrier.

## Expected verification after repair

Supported live reads should now show:

1. `cd /app/projects/aks-rp-e2e.app && bun run task-tree show domain/writeback-windows-gpu-vms-legacy-retirement-20260715`
   - live backlog domain leaf exists
   - goal rewrites the legacy `spec.windows-gpu.vm-prerelease-matrix` boundary to a truthful legacy-no-rerun posture
   - depends_on lists `domain/author-windows-gpu-vmss-prerelease-grid-20260715` and `domain/author-windows-gpu-vmss-prerelease-cuda-20260715`

2. `cd /app/projects/aks-rp-e2e.app && bun run task-tree frontier`
   - no unchanged Windows GPU rerun becomes runnable as a side effect of this repair

3. Re-read `.state/spec-loop/state.json`
   - `spec.windows-gpu.vm-prerelease-matrix.taskId = domain/writeback-windows-gpu-vms-legacy-retirement-20260715`
   - `spec.windows-gpu.vm-prerelease-matrix.status = pending`
   - `spec.windows-gpu.vm-prerelease-matrix.resumeCondition` names only the accepted successor-trio lineage and still forbids unchanged rerun
