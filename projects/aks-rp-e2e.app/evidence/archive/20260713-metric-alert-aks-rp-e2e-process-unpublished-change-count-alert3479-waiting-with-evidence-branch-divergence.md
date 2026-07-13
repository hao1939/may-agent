# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3479)

- Alert id: `3479`
- Judged at: `2026-07-13T02:54:00Z`
- Chosen operation: `waiting_with_evidence`
- Metric row at triage: current `19`, threshold `0`, target `0`, priority `P0`
- Owner: `app-ops`

## Current measurement is real

Fresh recompute from `/app/projects/aks-rp-e2e.app` returned:

```json
{"measuredAt":1783911284155,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":19}
```

Fresh domain-repo state from `/app/projects/aks-rp-e2e` explains the value exactly:

- `git rev-list --left-right --count origin/dev...HEAD` => `1 1`
- `git status --short --untracked-files=no` => `18` tracked modified files

The metric implementation counts the ahead component from `git status --porcelain=v1 --branch` plus each tracked dirty path, so the current breach is still real: `1 + 18 = 19`.

## Exact unpublished surface

Current tracked unpublished files are:

```text
 M features/rp-cluster-lifecycle/compact/staging.diagnostics.json
 M features/rp-cluster-lifecycle/compact/staging.plan.json
 M features/rp-cluster-lifecycle/compact/staging.summary.md
 M features/rp-cluster-lifecycle/specs/rp-available-agent-pool-versions.json
 M features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-create-get-delete.json
 M features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-maintenance-state.json
 M features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-stop-start.json
 M features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-upgrade-k8s-version.json
 M features/rp-cluster-lifecycle/specs/rp-operation-status-polling.json
 M features/rp-cluster-lifecycle/tests/rp-operation-status-polling.test.ts
 M features/rp-cluster-lifecycle/tests/rp-operation-status-polling.ts
 M model/knowledge-map/model.json
 M model/knowledge-map/views/evidence-index.md
 M model/knowledge-map/views/evidence-matrix.json
 M model/knowledge-map/views/graph-view.json
 M model/knowledge-map/views/model.generated.md
 M model/knowledge-map/views/path-summary.json
 M model/knowledge-map/views/status-summary.json
```

Focused diffstat over those files confirms coherent project/domain work rather than runtime noise:

```text
18 files changed, 399 insertions(+), 480 deletions(-)
```

## The prior auth/runtime blocker is stale, but the breach still cannot be safely cleared here

This session rechecked the earlier Azure DevOps auth/runtime claim.
With the corrected runtime path, remote read now succeeds:

```text
PATH="/app/.state/.local/bin:$PATH" git ls-remote --heads origin dev
363cda41f15f84ee720773bf1c87b7ff42a6c43d	refs/heads/dev
```

So the old `az: command not found` publication blocker is no longer the controlling reason.

However, the same dry-run publication check now fails for a different and still-real reason:

```text
PATH="/app/.state/.local/bin:$PATH" git push --dry-run origin dev
To https://dev.azure.com/msazure/CloudNativeCompute/_git/aks-e2e-spec-runner
 ! [rejected]            dev -> dev (non-fast-forward)
error: failed to push some refs to 'https://dev.azure.com/msazure/CloudNativeCompute/_git/aks-e2e-spec-runner'
hint: Updates were rejected because the tip of your current branch is behind
hint: its remote counterpart. Integrate the remote changes (e.g.
hint: 'git pull ...') before pushing again.
```

Current branch topology shows the divergence explicitly:

```text
* 363cda41f (origin/dev) checkpoint: refresh rp-cluster-lifecycle eight-file publication slice
| * 46c320565 (HEAD -> dev) checkpoint localdns ccp generated visible bundle
|/
* ecfb241e5 checkpoint: refresh rp-cluster-lifecycle no-live frontier
```

So the alert remains live, but the wait reason has narrowed from auth/runtime failure to a domain-repo publication decision: reconcile local commit `46c320565` with remote commit `363cda41f` and then decide the truthful publish/rebase/revert path for the current 18-file residue.

## Why `waiting_with_evidence` is the correct operation now

Choose `waiting_with_evidence`.

- Not `resolve_stale`: fresh recompute still returns `19`.
- Not `calibrate_metric`: threshold `0` remains correct because unpublished domain-repo state is still invisible to pipeline runs.
- Not `downgrade_priority`: this is still a real pipeline-visibility gap.
- Not `fix_root_cause`: clearing the metric now requires a domain-repo integrate-and-publish or revert decision across diverged `dev` and `origin/dev`, which app-ops should not perform from metric triage without the owning domain publication decision.
- Not `upgrade_or_escalate`: the situation is serious but currently bounded and explained; there is a known next action rather than an unknown destructive or policy emergency.
- Not `document_exception`: this is active unpublished work, not an accepted long-term exception.

## Exact wait, observer, and fallback

### Wait
Wait for one of these exact closure paths:

1. reconcile local `dev` with remote `origin/dev` after commit `363cda41f`, then publish the intended current residue so pipeline-visible repo state matches local truth, or
2. revert/supersede the current local residue if that merge/publish path is not the truthful next state.

### Observer
`app-ops` rechecks via:

- the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`,
- `git rev-list --left-right --count origin/dev...HEAD`, and
- `git status --short --untracked-files=no` in `/app/projects/aks-rp-e2e`.

### Fallback
If the next snapshot still breaches and branch divergence remains unresolved, reopen as a stronger publication-closure action in project context: the old auth/runtime explanation must not be reused, because current evidence shows the controlling blocker is non-fast-forward divergence, not missing `az`.

## Required next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if `/app/projects/aks-rp-e2e` is rebased/merged against `origin/dev` and the current residue is either published or truthfully cleared.
