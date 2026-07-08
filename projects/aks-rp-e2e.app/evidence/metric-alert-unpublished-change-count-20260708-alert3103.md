# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3103)

- Alert id: `3103`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-08T18:07:00Z`
- Chosen operation: `waiting_with_evidence`

## Current measurement

This alert is still real, but the earlier explanation for alert 3103 is stale.
Fresh checks during this triage show:

- runtime `metrics` row still shows `current=1`, `threshold=0`, `target=0`, `priority=P0`, `updated_at=1783533157880`
- direct recompute from `/app/projects/aks-rp-e2e.app` using `bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json` returned `value=5` at `1783533849101`
- `scripts/project-metrics.ts` defines this metric as `unpublishedGitChangeCount(projectDir)`, which counts each non-header `git status --porcelain=v1 --branch` line plus any `[ahead N]` marker

So the alert row is not stale even though the stored metric row is older than the current repo state: the live recompute is still above threshold.

## Current repo state behind the value 5

Fresh `git status --short --branch` in `/app/projects/aks-rp-e2e` shows:

- branch: `dev...origin/dev [ahead 1]`
- tracked modified files:
  - `features/network-cni/specs/network-cni-azure-overlay-agic-vm-prerelease.json`
  - `features/network-cni/tests/network-cni-azure-overlay-agic-vm-prerelease.ts`
  - `runner/check.ts`
- untracked file:
  - `tsconfig.runner.json`

That matches the metric implementation exactly: `4` non-header status lines plus `ahead 1` equals `5` unpublished changes.

## Why this is `waiting_with_evidence`

The breach is real, but app-ops should not force a publish/revert from metric triage yet.

1. The network-cni portion of the dirty set is newly produced review output, not anonymous residue.
   - `bun run task-tree show implement-network-cni-agic-overlay-runtime-slices-20260708` now shows the task in `review` state with accepted worker evidence that it implemented the BYO AGIC runtime floor, updated the spec metadata, and wrote durable domain evidence.
2. The remaining ahead-commit publication path is still blocked by the existing shared Azure DevOps auth/runtime wait.
   - `bun run task-tree show wait-shared-azure-devops-publication-auth-capable-runtime-20260708` records the exact blocker: this runtime lacks Azure CLI, so the configured credential helper cannot authenticate to the `dev.azure.com` remote for bounded publication.
3. Two domain worker sessions are actively mutating the same domain repo right now:
   - `s_task_reconcile-spec-loop-pending-net-integration-22_retry_20260708180148`
   - `s_task_reconcile-spec-loop-pending-secops-fips-23_retry_20260708180149`
4. The remaining dirty surface is mixed across an exact review-ready network-cni slice and separate runner-hygiene edits (`runner/check.ts`, `tsconfig.runner.json`). Publishing or reverting from this triage session would risk sweeping mixed in-progress work into one checkpoint or discarding an unreviewed local lane.

## Concrete state change made by this triage

This note replaces the stale earlier `52`-count story for alert `3103` with the current exact `5`-count explanation:

- `ahead 1` unpublished commit remains blocked by the shared Azure DevOps auth wait
- `4` live worktree changes remain in the domain repo
- the network-cni pair is now represented by a concrete review task result rather than anonymous residue
- the alert therefore stays open as a real wait, not a stale or resolved signal

## Exact wait, observer, and fallback

- wait owner: `app-ops`
- waited-on condition:
  1. the current domain worker sessions stop mutating `/app/projects/aks-rp-e2e`, and
  2. an auth-capable runtime is available for bounded Azure DevOps publication of the ahead commit and any accepted follow-on checkpoint slice
- observer/check method:
  - next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`
  - fresh `git status --porcelain=v1 --branch` in `/app/projects/aks-rp-e2e`
  - planner review of `implement-network-cni-agic-overlay-runtime-slices-20260708`
  - existing blocked wait `wait-shared-azure-devops-publication-auth-capable-runtime-20260708`
- success condition:
  - repo state reaches `0`, or
  - the remaining unpublished surface is reduced to a smaller exact slice that can be truthfully checkpointed or kept on one explicit blocked wait
- fallback if still breaching after the running workers drain:
  - refresh repo-hygiene owner review for the residual `runner/check.ts` / `tsconfig.runner.json` lane if it remains unpublished, and
  - keep using the shared Azure DevOps auth wait rather than duplicating publication-auth blockers per file family

## Next validation

Validate on the next `metrics-snapshot` after the active `net-integration` and `secops-fips` worker sessions finish, or at the next blocked-frontier planner review of the shared Azure DevOps auth wait.