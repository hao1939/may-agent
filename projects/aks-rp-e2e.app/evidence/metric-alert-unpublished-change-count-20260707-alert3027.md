# Metric alert triage — aks-rp-e2e.process.unpublished-change-count (alert 3027)

- Alert id: `3027`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-07T13:13:10Z`
- Chosen operation: `waiting_with_evidence`

## Current measurement

Direct checks during this triage confirm the breach is still real:

- runtime metric row reports `current = 6`, `threshold = 0`, `target = 0`, `priority = P0`, updated at `1783454645733`
- the latest snapshot transition is `0 -> 6`, so this is a fresh active breach rather than a stale recovered row
- current domain-repo status in `/app/projects/aks-rp-e2e` shows exactly six modified tracked paths and no ahead marker on `dev...origin/dev`
- `projects/aks-rp-e2e.app/scripts/project-metrics.ts` implements this metric as `unpublishedGitChangeCount(projectDir)`, which counts each dirty tracked status line plus any `[ahead N]` branch marker; the current git status therefore explains the measured `6` directly

## Current dirty surface

The unpublished tracked changes are exactly:

- `features/fleet/compact/staging.diagnostics.json`
- `features/fleet/compact/staging.summary.md`
- `features/workload-autoscaler/compact/staging.diagnostics.json`
- `features/workload-autoscaler/compact/staging.plan.json`
- `features/workload-autoscaler/compact/staging.summary.md`
- `runner/feature-compact.ts`

Current diffs show one coherent compact-frontier classification slice rather than random residue:

- `runner/feature-compact.ts` adds exact blocked-frontier bucketing for source-equivalent feature-path / blocked-gate cases so they are preserved as `source-equivalent-evidence-ceiling-frontier` instead of being merged into a generic repo-local eligibility blocker
- `features/workload-autoscaler/compact/staging.{diagnostics,plan,summary}` regenerate around that new split-frontier classification, replacing the prior `repo-local-spec-metadata-eligibility-gap` wording with exact preserved frontiers for `spec.vpa.cert-renewal-runtime` and `spec.workload-autoscaler.keda-upgrade-survival`
- `features/fleet/compact/staging.{diagnostics,summary}` make a narrower wording repair that cites the authoritative spec JSON as the source of the preserved adjacent compact observation for the hubless Fleet RP API lifecycle blocker

## Why this is waiting, not a root-cause fix from this session

This alert is real, but this triage should not publish or revert the slice yet:

1. runtime `sessions` still shows an active `aks-explorer` planner session for project `aks-rp-e2e` (`s_project_planner_planning_update_20260707200445_6hxnvk`, status `running`) reacting to the same current frontier
2. the six dirty files are a single in-progress compact-frontier rewrite whose durable checkpoint depends on whether the planner keeps this exact slice or folds it into broader task-tree reconciliation
3. the branch is not ahead of `origin/dev`, so there is no simple "push unpublished commit" fix; the breach is uncommitted tracked churn
4. forcing a commit or revert from this alert session would race the active owner planning lane and could publish a misleadingly partial compact-state checkpoint

## Concrete state change made by this triage

This triage records the accepted wait judgment in:

- `projects/aks-rp-e2e.app/evidence/metric-alert-unpublished-change-count-20260707-alert3027.md`

That durable note replaces investigation-only context with an explicit owner judgment: the `6`-change breach is real, narrowly scoped to one compact-frontier rewrite slice, and intentionally left waiting until the active owner planning lane settles the same slice.

## Resume condition

Re-evaluate on the next `metrics-snapshot` after one of these happens:

1. `s_project_planner_planning_update_20260707200445_6hxnvk` finishes and the same six-file slice remains stable for publication/revert review, or
2. the six files are intentionally published or cleared and the metric returns to `0`.
