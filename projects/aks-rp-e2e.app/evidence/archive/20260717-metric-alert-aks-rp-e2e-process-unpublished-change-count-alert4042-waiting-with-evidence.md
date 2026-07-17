# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 4042)

- Date: 2026-07-17
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Alert id: `4042`
- Chosen operation: `waiting_with_evidence`

## Current metric truth

Runtime DB now shows the alert is still real but smaller than the original alert payload:

- `metrics.current = 3`
- `threshold = 0`
- `priority = P0`
- `updated_at = 1784319421962`

Direct recompute from the metric source command also returns `3`:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json
# => {"measuredAt":1784319808347,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":3}
```

So this is **not** a stale or already-recovered alert.

## Exact current contributors

Replaying the metric visibility logic against the live `/app/projects/aks-rp-e2e` worktree shows exactly three contributors and zero local-only commits:

```text
INVISIBLE  D features/cluster-autoscaler/tests/cluster-autoscaler-vm-prerelease-profile-matrix.ts :: deleted
INVISIBLE  M features/secops/compact/staging.diagnostics.json :: new-blob:9769b94eeae8
INVISIBLE  M features/secops/compact/staging.summary.md :: new-blob:c958d0ac6ad5
INVISIBLE_COUNT 3
LOCAL_ONLY_COMMITS 0
UNPUBLISHED_TOTAL 3
```

All other current dirty files are branch-convergence residue whose current blobs already exist on some fetched `origin/*` ref and therefore do not contribute to this metric.

## Why this is `waiting_with_evidence`

The remaining contributors already have exact active/blocked owners in the live project state, and app-ops should not override those domain publication decisions from metric triage.

### 1. Cluster-autoscaler deletion is already under an active exact publication task

Live task-tree state now carries the cluster-autoscaler publication slice on:

- task id: `domain/checkpoint-cluster-autoscaler-vm-prerelease-autoscaling-base-source-snapshot-portability-slice-20260717`
- owner: `aks-explorer`
- state: `active`
- goal: publish only the remaining row-124 autoscaling-base/source-snapshot portability residue
- acceptance explicitly includes the `paired plain-carrier deletion`

Runtime sessions confirm that exact task is already running:

- session id: `s_task_domain_checkpoint-cluster-autoscaler-vm-prerelease-autoscaling-base-source-snapshot-portability-_g-base-source-snapshot-portability-slice-20260717_20260717202242`
- agent: `aks-explorer`
- status: `running`
- startedAt: `1784319794587`
- lastActivityAt: `1784319957072`

So the deleted `cluster-autoscaler-vm-prerelease-profile-matrix.ts` path is not unowned drift; it is already inside an exact in-flight checkpoint task.

### 2. The secops pair is already held by an exact blocked frontier with review windows

Live task-tree state shows:

- task id: `hold-compact-secops-package-partial-frontier-20260714`
- owner: `aks-explorer`
- state: `blocked`
- outputs include:
  - `features/secops/compact/staging.summary.md`
  - `evidence/archive/ops-apply-secops-compact-eight-carrier-live-holder-writeback-20260717.md`
  - `evidence/archive/ops-apply-apply-secops-compact-eight-carrier-live-holder-writeback-20260717-state-repair.md`

The latest accepted writeback evidence says the holder is intentionally blocked on the exact eight-carrier secops frontier and must not reopen an unchanged broad rerun. Its current wait contract is explicit:

- `next_check_at = 2026-07-18T18:30:00Z`
- `fallback_at = 2026-07-18T18:58:10.320Z`
- `resume_condition`: resume only when one of the exact represented secops carriers materially changes or sharpens into a same-lineage successor

That means the two secops files are real unpublished changes, but they are already represented by one truthful blocked holder with observer/fallback timing.

## Judgment

I am choosing `waiting_with_evidence` because the alert is still breaching **now**, but the remaining `3` unpublished contributors are already accounted for by:

1. one exact **running** cluster-autoscaler publication task, and
2. one exact **blocked** secops compact holder with fresh 2026-07-18 review/fallback windows.

This is not `resolve_stale` because the metric still recomputes to `3`.
This is not `fix_root_cause` because the remaining publication decisions are already in exact domain-owned motion and are not safe to preempt from this triage step.
This is not `upgrade_or_escalate` because the work is already actively owned and the metric is decreasing (`7 → 6 → 3`) rather than abandoned.

## Next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if either of these happens first:

1. `domain/checkpoint-cluster-autoscaler-vm-prerelease-autoscaling-base-source-snapshot-portability-slice-20260717` completes and publishes or replaces its slice with a narrower blocker.
2. `hold-compact-secops-package-partial-frontier-20260714` changes state or its next blocked-frontier review runs after `2026-07-18T18:30:00Z`.
