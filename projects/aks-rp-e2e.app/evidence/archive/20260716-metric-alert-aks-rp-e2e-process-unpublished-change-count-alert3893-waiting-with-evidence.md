# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3893)

- Operation: `waiting_with_evidence`
- Alert id: `3893`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-16T00:37:50Z`

## Why the breach is still real

A fresh recompute from `/app/projects/aks-rp-e2e.app` still returns `3`:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json
# {"measuredAt":1784175061905,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":3}
```

The live domain-repo state at `/app/projects/aks-rp-e2e` matches that value exactly:

```bash
git status --porcelain=v1 --branch
# ## aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715...origin/aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715 [ahead 23, behind 12]
#  M package.json
#  M runner/README.md
# ?? runner/ci/queue-ado-spec-batch.ts

git rev-list --count HEAD --not --remotes=origin
# 0
```

So the current breach is not unpublished commits anymore; it is the exact three-file dirty trio still present only in the local worktree.

## Why this is not a stale or calibration-only alert

The three local files are not harmless branch-divergence noise:

- `package.json`
- `runner/README.md`
- `runner/ci/queue-ado-spec-batch.ts`

Their current blobs match local helper checkpoint commit `c3022475a` exactly, but `git branch -r --contains c3022475a` returned no remote ref. That means the content is intentional local residue, not already-published pipeline-visible content on another fetched `origin/*` ref.

So:

- not `resolve_stale`: the recompute is still `3`
- not `calibrate_metric`: the measurement is correctly identifying real local-only worktree content
- not `fix_root_cause`: publishing or discarding this slice would change domain-repo behavior and should follow the already-live review/publish chain rather than ad hoc app-ops mutation on the mixed normalization branch

## Concrete evidence accepted during triage

This triage leaves one durable acceptance artifact: this memo records the exact current owner/wait chain for the dirty trio so the alert is judged as an active wait, not an orphaned breach.

The live process representation already ties the trio to the normalization review/publication path:

1. `domain/normalize-scenario-tests-repo-frontier-20260715` remains in `review` and still owns repo-wide scenario-test normalization policy/output.
2. `verify-normalization-runner-fanout-helper-20260716-domain-followup` is `done` and recorded one combined branch plus queued Azure DevOps run `172463356` for the next three-spec normalization batch.
3. `domain/publish-normalization-batch-review-visible-20260716` remains the explicit blocked publication holder for this normalization slice until review accepts one publication-safe combined branch/head or returns a narrower successor.
4. `wait-traffic-api-proxy-enable-lifecycle-ado-run-172463356-result` is the exact wait that will observe the batch run queued from the accepted follow-up branch.

That chain means the breach is currently represented by live review/publication work and an exact pipeline-result wait; it is not an unowned repo residue.

## Why the final operation is `waiting_with_evidence`

The correct judgment is `waiting_with_evidence` because:

- the metric still breaches now (`3`),
- the three files are still only local worktree residue,
- there is already a truthful live review/publication path for the slice,
- and app-ops does not have a safer smaller change than waiting for the existing review/publish chain rather than manually publishing or discarding domain-repo content.

## Next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if either of these happens:

1. `domain/normalize-scenario-tests-repo-frontier-20260715` receives a review decision that accepts or narrows the normalization publication slice; or
2. Azure DevOps run `172463356` returns and causes the normalization publication holder to publish, replace, or clear the dirty trio.
