# Metric alert triage — aks-rp-e2e.process.unpublished-change-count (alert 3031)

- Alert id: `3031`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-07T13:13:10Z`
- Chosen operation: `waiting_with_evidence`

## Current measurement

Direct checks during this triage confirm the breach is still real:

- the alert payload reports `current = 2`, `threshold = 0`, `target = 0`, `priority = P0`
- the domain repo `/app/projects/aks-rp-e2e` is on branch `dev` tracking `origin/dev` with exactly two modified tracked paths and no `[ahead N]` marker
- `projects/aks-rp-e2e.app/scripts/project-metrics.ts` computes this metric with `unpublishedGitChangeCount(projectDir)`, which counts each dirty tracked status line plus any branch-ahead marker, so the current git status explains the measured `2` directly

## Current dirty surface

The unpublished tracked changes are exactly:

- `features/traffic-alb-controller/compact/staging.summary.md`
- `features/traffic-applink/compact/staging.summary.md`

Current diffs show one coherent compact-frontier wording slice rather than random residue:

- `traffic-alb-controller/compact/staging.summary.md` narrows the remaining frontier for `spec.traffic-alb-controller.enable-lifecycle` from a generic `check-only-live-authoring-gap` to the exact `cleanup-only-authority-gap`, preserving that enablement, ALB readiness, and disable-request acceptance are already grounded while disable-to-clean-state cleanup remains unproven
- `traffic-applink/compact/staging.summary.md` splits the prior generic `check-only-live-authoring-gap` into two preserved exact frontiers: `self-contained-live-carrier-gap` for `spec.traffic-applink.cross-cluster-discovery` and `contract-mismatch-ceiling` for `spec.traffic-applink.upgrade-survival`

## Why this is waiting, not a root-cause fix from this session

This alert is real, but the owner should not publish or revert the slice from this triage session yet:

1. runtime `sessions` shows two active `aks-explorer` worker sessions on project `aks-rp-e2e`, including `s_task_reconcile-compact-loop-package-partial-unsampled-20260707-followup` and `s_task_diagnose-compact-eligibility-environment-warning-family-20260707`, both with recent `lastActivityAt` values
2. one of those active tasks explicitly exists to retarget compact loop state and durable holder/tree surfaces for unsampled package-partial parity drift, which matches the exact frontier wording changes visible in these two summaries
3. the branch is not ahead of `origin/dev`, so there is no simple push-pending-commit fix; the breach is uncommitted tracked churn inside an active compact reconciliation lane
4. forcing a commit or revert from this alert session would race the active owner work and could publish a misleadingly partial compact-state checkpoint

## Concrete state change made by this triage

This triage records the accepted wait judgment in:

- `projects/aks-rp-e2e.app/evidence/metric-alert-unpublished-change-count-20260707-alert3031.md`

That durable note replaces investigation-only context with an explicit owner judgment: the `2`-change breach is real, narrowly scoped to two compact summary frontier refinements, and intentionally left waiting until the active compact reconciliation lane settles the same slice.

## Resume condition

Re-evaluate on the next `metrics-snapshot` after one of these happens:

1. `s_task_reconcile-compact-loop-package-partial-unsampled-20260707-followup` and `s_task_diagnose-compact-eligibility-environment-warning-family-20260707` finish and the same two-file slice remains stable for publication/revert review, or
2. the two compact-summary files are intentionally published or cleared and the metric returns to `0`.
