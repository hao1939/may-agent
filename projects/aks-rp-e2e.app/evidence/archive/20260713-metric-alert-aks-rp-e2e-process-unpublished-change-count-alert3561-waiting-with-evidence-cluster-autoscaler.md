# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3561)

- Alert id: `3561`
- Judged at: `2026-07-13T16:55:00Z`
- Chosen operation: `waiting_with_evidence`
- Metric row at triage: current `11`, threshold `0`, target `0`, priority `P0`
- Owner: `app-ops`

## Current measurement is real

Fresh direct recompute from `/app/projects/aks-rp-e2e.app` returned:

```json
{"measuredAt":1783961331601,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":11}
```

Fresh domain-repo state from `/app/projects/aks-rp-e2e` matches the metric exactly:

- `git rev-list --left-right --count origin/dev...HEAD` => `0 0`
- `git status --short --untracked-files=no | wc -l` => `11`
- tracked dirty files are exactly:
  - `features/cluster-autoscaler/compact/staging.diagnostics.json`
  - `features/cluster-autoscaler/compact/staging.plan.json`
  - `features/cluster-autoscaler/compact/staging.summary.md`
  - `features/cluster-autoscaler/specs/cluster-autoscaler-vm-prerelease-autoscaling-base.json`
  - `features/cluster-autoscaler/specs/cluster-autoscaler-vm-prerelease-local-storage-runtime.json`
  - `features/cluster-autoscaler/specs/cluster-autoscaler-vm-prerelease-mincount-recovery.json`
  - `features/cluster-autoscaler/specs/cluster-autoscaler-vm-prerelease-row49-overscale-node-stability.json`
  - `features/cluster-autoscaler/specs/cluster-autoscaler-vm-prerelease-row50-scale-from-zero-labels-fips.json`
  - `features/cluster-autoscaler/specs/cluster-autoscaler-vm-prerelease-service-principal.json`
  - `features/cluster-autoscaler/specs/cluster-autoscaler-vm-prerelease-spot.json`
  - `runner/feature-compact.ts`

So the breach is real and current: there is no ahead/behind component anymore, only the 11 tracked unpublished files.

## What the 11 files are

This is not anonymous drift. The dirty set is the accepted cluster-autoscaler VM-prerelease provenance-split slice created by `domain/apply-cluster-autoscaler-vm-prerelease-source-provenance-frontier-split-20260713`.

Accepted repo-local evidence already explains the slice:

- `../aks-rp-e2e/evidence/archive/domain-apply-cluster-autoscaler-vm-prerelease-source-provenance-frontier-split-20260713.md`
- the memo records the exact quartet/trio frontier split, the 7 spec metadata edits, the `runner/feature-compact.ts` logic change, and the regenerated 3 compact outputs.

The compact-facing holder still reflects the same feature family:

- `hold-compact-cluster-autoscaler-vm-prerelease-environment-heptet-frontier-20260710`

And there is now one active exact publication task already carrying the intended next action:

- `domain/publish-cluster-autoscaler-vm-prerelease-frontier-split-20260713`

That live task's goal is to review the current dirty diff, run repo-local checks, commit the intended changes on `dev`, and push them to `origin/dev`.

## Why the metric is still open

The current runtime still cannot complete publication safely from this session.

### Direct push capability check still fails

```text
/app/.state/.local/bin/git-credential-azdevops: line 28: az: command not found
fatal: could not read Username for 'https://dev.azure.com/msazure/CloudNativeCompute/_git/aks-e2e-spec-runner': No such device or address
```

So even if the accepted 11-file slice were committed locally, this runtime cannot currently prove pipeline visibility by pushing to `origin/dev`.

### Full domain check is also currently red for an unrelated existing failure

```text
Scenario test --check mode must be read-only.
Use the explicit check-result write gate for durable check artifacts.
- features/rp-nodepool-lifecycle/tests/rp-nodepool-lifecycle-multi-agentpool-runner.ts:353: check-mode branch writes durable test result artifacts
```

That check failure is outside the 11-file cluster-autoscaler slice, but it means this triage session cannot truthfully claim a clean publication path from the current repo state.

## Why `waiting_with_evidence` is the correct operation

Choose `waiting_with_evidence`.

- Not `resolve_stale`: fresh recompute still returns `11`.
- Not `calibrate_metric`: threshold `0` remains correct because unpublished repo-local domain changes are still invisible to pipeline runs.
- Not `downgrade_priority`: this is still a real pipeline-visibility gap.
- Not `fix_root_cause`: there is already one active exact domain publication task for this slice, but this session cannot safely finish publication because direct push auth is unavailable in the current runtime and `bun run check` is red on an unrelated pre-existing file.
- Not `upgrade_or_escalate`: the alert is serious but it already has a concrete active owner action (`domain/publish-cluster-autoscaler-vm-prerelease-frontier-split-20260713`) rather than an unowned emergency.
- Not `document_exception`: this is active unpublished work, not an accepted long-term exception.

## Exact wait, observer, and fallback

### Wait
Wait for `domain/publish-cluster-autoscaler-vm-prerelease-frontier-split-20260713` to resolve one of two truthful outcomes:

1. publish the accepted 11-file cluster-autoscaler frontier-split slice to `origin/dev`, or
2. record the exact blocker proving why publication still cannot happen from the available runtime.

### Observer
`app-ops` rechecks via:

- the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`,
- `bun run task-tree show domain/publish-cluster-autoscaler-vm-prerelease-frontier-split-20260713`,
- `git rev-list --left-right --count origin/dev...HEAD`, and
- `git status --short --untracked-files=no` in `/app/projects/aks-rp-e2e`.

### Fallback
If the publish task exits blocked or the next snapshot still breaches with the same 11-file surface, refresh the alert against the task's blocker evidence and keep one exact publication/auth wait rather than reopening generic unpublished-change diagnosis.

## Required next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner when `domain/publish-cluster-autoscaler-vm-prerelease-frontier-split-20260713` completes and either publishes the slice or returns exact blocker evidence.