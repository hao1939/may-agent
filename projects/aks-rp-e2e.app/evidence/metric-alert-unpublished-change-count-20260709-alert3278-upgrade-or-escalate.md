# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3278)

- Alert id: `3278`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-09T11:43:09Z`
- Chosen operation: `upgrade_or_escalate`

## Current measurement

Fresh checks during this triage show the alert is still real:

- runtime metric row says `current=1`, `threshold=0`, `target=0`, `priority=P0`
- direct recompute from `/app/projects/aks-rp-e2e.app` via `bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json` returned `value=1`
- `scripts/project-metrics.ts` defines this metric as `unpublishedGitChangeCount(projectDir)`, which counts dirty worktree entries plus any branch `[ahead N]` marker from `git status --porcelain=v1 --branch`

## Exact repo state behind the breach

Fresh `git status --porcelain=v1 --branch` in `/app/projects/aks-rp-e2e` now shows only:

```text
## dev...origin/dev [ahead 1]
```

There are no remaining modified or untracked files in the domain repo. The entire measured breach is the one unpublished local commit:

- `64eb19b43` — `fix: untrack stray evidence files + fix formatter warnings`

`git show --stat --summary 64eb19b43` confirms that this commit removed two policy-illegal tracked `evidence/archive/*` files from git history and fixed formatting drift in:

- `runner/scenario-lib/arm-rest.ts`
- `runner/vitest-runtime/shared-clusters.ts`

So the metric dropped from the earlier dirty-worktree breach to a smaller, truthful residual: **one ahead commit not yet visible to the pipeline**.

## Why this is not `fix_root_cause`

The remaining fix is to publish that one commit to the authoritative Azure DevOps ref. App-ops cannot safely do that from this runtime because the required git credential path is broken here.

Direct checks fail:

```text
/app/.state/.local/bin/git-credential-azdevops: line 28: az: command not found
fatal: could not read Username for 'https://dev.azure.com/msazure/CloudNativeCompute/_git/aks-e2e-spec-runner': No such device or address
```

This failure occurs on both:

- `git push --dry-run origin HEAD:dev`
- `git ls-remote --heads origin dev`

That means the alert is real, the owner-visible next action is known, but the final publication step requires an auth-capable environment outside this session.

## Escalation decision

Escalate this alert against the existing shared publication-auth blocker rather than downgrading or resolving it.

- exact blocker: the current runtime cannot authenticate to the Azure DevOps remote because the configured credential helper depends on `az`, which is unavailable here
- exact action needed from human / auth-capable runtime: publish commit `64eb19b43` from `/app/projects/aks-rp-e2e` to `origin/dev`, or provide a runtime where `git push` to that remote is functional
- exact reason escalation is required: the remaining metric value is no longer mixed local churn; it is a single known commit that cannot be made pipeline-visible without external publication capability

## Why this is `upgrade_or_escalate`

I did not choose `resolve_stale` because the live recompute still returns `1`.
I did not choose `waiting_with_evidence` because the blocking condition is not merely internal concurrent work; it now requires external auth/tooling capability to complete the last step safely.
I did not choose `calibrate_metric` or `downgrade_priority` because the metric is accurate and still measures a real pipeline-visibility gap.

The correct owner action is therefore to escalate the final publication step with exact evidence and the exact decision needed.

## Next validation

Validate at the next `metrics-snapshot` after an auth-capable runtime publishes commit `64eb19b43` to `origin/dev`, or sooner by re-running:

```bash
cd /app/projects/aks-rp-e2e && git status --porcelain=v1 --branch
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json
```
