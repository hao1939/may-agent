# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3878)

- Operation: `calibrate_metric`
- Alert id: `3878`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-16T00:37:50Z`

## Why calibration was necessary

The persisted metric row and direct recompute both reported `20`, but the live
repo state showed a clean worktree and a branch that was only divergent from its
configured upstream:

```bash
cd /app/projects/aks-rp-e2e && git status --porcelain=v1 --branch
# ## aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715...origin/aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715 [ahead 20, behind 12]
```

That raw `ahead 20` was not equivalent to `20` invisible pipeline changes.
Prior branch-visibility reconciliation already proved that part of the stack was
published elsewhere:

- `8` ahead commits were already contained by some `origin/*` ref, so they were
  branch-convergence residue rather than unpublished work.
- the update-tags successor audit proved local commit `45cde6da9` is
  content-equivalent to already-published commit `916ddd183` and validated by
  Azure DevOps run `172413760`.

So the old sampler was overcounting branch topology drift as unpublished change
risk.

## Concrete calibration applied

I changed `scripts/project-metrics.ts` so
`unpublishedGitChangeCount(projectDir)` now computes:

1. dirty status entries from `git status --porcelain=v1`; plus
2. commits reachable from `HEAD` that are **not contained by any fetched
   `origin/*` ref** using `git rev-list --count HEAD --not --remotes=origin`.

This removes false positives from commits that are already pipeline-visible on a
published origin branch but not yet merged onto the current tracking branch.

I also updated `scripts/register-project-metrics.ts` to document the calibrated
intent, and added regression coverage in `scripts/project-metrics.test.ts` for a
repo that is ahead of its upstream by two commits where one commit is already
published on a different `origin/*` ref.

## Verification

After the code change, direct recompute returned:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json
# {"measuredAt":1784165260854,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":12}
```

That matches the already-audited split of the current branch backlog:

- `8` commits already visible on some `origin/*` ref → no longer counted
- `12` commits still local-only relative to every fetched `origin/*` ref → still counted

The metric is still breached after calibration, but it is now measuring the
remaining invisible change backlog rather than upstream-divergence noise.

## Next validation

Validate on the next `metrics-snapshot` for
`aks-rp-e2e.process.unpublished-change-count`, or sooner by rerunning:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json
```
