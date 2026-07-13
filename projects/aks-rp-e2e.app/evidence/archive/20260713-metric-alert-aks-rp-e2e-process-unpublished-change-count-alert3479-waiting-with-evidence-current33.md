# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3479)

- Alert id: `3479`
- Judged at: `2026-07-13T09:00:54Z`
- Chosen operation: `waiting_with_evidence`
- Metric row at triage: current `33`, threshold `0`, target `0`, priority `P0`
- Owner: `app-ops`

## Current measurement is real

The runtime metric row still points at the direct sampler:

- `source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count`
- `projects/aks-rp-e2e.app/scripts/register-project-metrics.ts` keeps threshold `0` and priority `P0` because unpublished domain-repo changes are not visible to pipeline runs.

Fresh recompute from `/app/projects/aks-rp-e2e.app` returned:

```json
{"measuredAt":1783940295216,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":33}
```

Fresh domain-repo state from `/app/projects/aks-rp-e2e` explains the value exactly:

- `git status --porcelain=v1 --branch` => `## dev...origin/dev [ahead 1]`
- `git rev-list --left-right --count origin/dev...HEAD` => `0 1`
- `git status --short --untracked-files=no | wc -l` => `32`

So the current breach is still real: the sampler counts the ahead component plus tracked dirty files, which is `1 + 32 = 33`.

## Current unpublished surface

The dirty tracked files now span four compact families plus shared model/runner outputs:

- `aad-rbac`: 3 compact artifacts
- `localdns`: 6 files (3 compact artifacts + 3 specs)
- `net-integration`: 7 files (3 compact artifacts + 4 specs)
- `rp-cluster-lifecycle`: 6 files (`features/rp-cluster-lifecycle.yaml`, 3 compact artifacts, 1 spec, 2 tests)
- shared generated/model spillover: `model/knowledge-map/*` (7 files) and `runner/feature-compact.ts`

Focused diffstat over the new aad-rbac/localdns slice shows the increase is coherent domain writeback rather than app-runtime noise:

```text
9 files changed, 114 insertions(+), 107 deletions(-)
```

## The current blocker story changed again

The earlier branch-divergence memo is now stale. Current branch topology no longer shows the repo behind `origin/dev`; it is only ahead by one local commit:

```text
* fb9eadbc1 (HEAD -> dev) checkpoint localdns ccp generated visible bundle
* 363cda41f (origin/dev) checkpoint: refresh rp-cluster-lifecycle eight-file publication slice
```

But current dry-run publication in this runtime is still blocked by Azure DevOps auth/runtime setup:

```text
/app/.state/.local/bin/git-credential-azdevops: line 28: az: command not found
fatal: could not read Username for 'https://dev.azure.com/msazure/CloudNativeCompute/_git/aks-e2e-spec-runner': No such device or address
```

So the controlling wait is again: unpublished repo-local domain state is real, but this triage session cannot safely publish it because authenticated push capability is unavailable in the current runtime.

## Why `waiting_with_evidence` is the correct operation now

Choose `waiting_with_evidence`.

- Not `resolve_stale`: fresh recompute still returns `33`.
- Not `calibrate_metric`: threshold `0` remains correct because unpublished domain-repo state is still invisible to pipeline runs.
- Not `downgrade_priority`: this is still a real pipeline-visibility gap.
- Not `fix_root_cause`: clearing the metric would require domain-repo publication, revert, or exact checkpoint reconciliation across active AKS domain artifacts. App-ops should not publish or revert that mixed domain state from alert triage, and current runtime auth does not allow safe dry-run publication anyway.
- Not `upgrade_or_escalate`: the issue is serious but already bounded, represented, and understood; this session has exact current evidence and a known next validation path rather than an unknown destructive emergency.
- Not `document_exception`: this is active unpublished work, not an accepted long-term exception.

## Exact represented waits in project state

The current task tree still contains exact compact holders for the affected feature families:

- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-compact-localdns-package-partial-frontier`
- `hold-compact-net-integration-package-partial-frontier`
- `hold-compact-rp-cluster-lifecycle-package-partial-frontier`

Those holders show the feature-family residue is represented work, not anonymous metric noise.

## Exact wait, observer, and fallback

### Wait
Wait for one truthful closure path:

1. restore an auth-capable Azure DevOps runtime for `/app/projects/aks-rp-e2e`, then publish the intended local commit/worktree state, or
2. explicitly reconcile/revert the current mixed residue so the repo no longer carries unpublished tracked changes.

### Observer
`app-ops` rechecks via:

- the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`,
- `git status --porcelain=v1 --branch`,
- `git rev-list --left-right --count origin/dev...HEAD`, and
- `git status --short --untracked-files=no` in `/app/projects/aks-rp-e2e`.

### Fallback
If the next snapshot still breaches with the same ahead/dirty surface and the runtime still cannot authenticate `git push --dry-run origin dev`, reopen as a stronger publication-closure action using the corrected blocker story from this memo: current gap is a real unpublished domain-repo surface plus missing authenticated push capability in this runtime, not a stale branch-divergence explanation.

## Required next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if `/app/projects/aks-rp-e2e` either gains authenticated publication capability or the current 32 tracked modifications plus ahead-1 commit are truthfully cleared.