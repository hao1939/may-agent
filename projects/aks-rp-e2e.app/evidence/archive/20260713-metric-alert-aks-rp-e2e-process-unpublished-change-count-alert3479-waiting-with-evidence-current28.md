# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3479)

- Alert id: `3479`
- Judged at: `2026-07-13T17:59:41Z`
- Chosen operation: `waiting_with_evidence`
- Metric row at triage: current `28`, threshold `0`, target `0`, priority `P0`
- Owner: `app-ops`

## Current measurement is real

Fresh recompute from `/app/projects/aks-rp-e2e.app` returned:

```json
{"measuredAt":1783925872287,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":28}
```

The metric implementation still defines this signal as the domain repo unpublished count:

- `projects/aks-rp-e2e.app/scripts/project-metrics.ts` => `value: unpublishedGitChangeCount(projectDir)`
- `projects/aks-rp-e2e.app/scripts/register-project-metrics.ts` => threshold `0`, priority `P0`, because unpublished domain repo changes are not visible to pipeline runs

Fresh domain-repo state from `/app/projects/aks-rp-e2e` explains the value exactly:

- `git rev-list --left-right --count origin/dev...HEAD` => `1 1`
- `git status --short --untracked-files=no` => `27` tracked modified files

So the current breach is still real: the metric counts the ahead component plus tracked dirty files, which is `1 + 27 = 28`.

## Exact unpublished surface

Current tracked unpublished files are:

```text
 M features/net-integration/compact/staging.diagnostics.json
 M features/net-integration/compact/staging.plan.json
 M features/net-integration/compact/staging.summary.md
 M features/net-integration/specs/net-integration-multinic-standard.json
 M features/net-integration/specs/net-integration-natgw-v2-migration-v2-to-none.json
 M features/net-integration/specs/net-integration-outbound-migration-natgw-to-none.json
 M features/net-integration/specs/net-integration-outbound-migration-none-to-lb.json
 M features/net-integration/specs/net-integration-outbound-udr.json
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
 M runner/feature-compact.ts
```

Focused diffstat over those files confirms coherent domain/project work rather than app-runtime noise:

```text
27 files changed, 597 insertions(+), 659 deletions(-)
```

## Publication is blocked by branch divergence, not by a stale auth claim

The old `az: command not found` explanation is no longer the controlling story.
Current dry-run publication check now fails because local `dev` diverged from `origin/dev`:

```text
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
* 341f14342 checkpoint: self-contain net-integration no-live carriers
* a096a0317 checkpoint: tighten rp-cluster-lp-e2e no-live carriers
```

## Why `waiting_with_evidence` is correct now

Choose `waiting_with_evidence`.

- Not `resolve_stale`: fresh recompute still returns `28`.
- Not `calibrate_metric`: threshold `0` remains correct because unpublished domain-repo state is still invisible to pipeline runs.
- Not `downgrade_priority`: the breach is still a real pipeline-visibility gap.
- Not `fix_root_cause`: clearing the metric now requires a domain-repo integrate/publish/rebase/revert decision across a diverged `dev` branch while changes span net-integration, rp-cluster-lifecycle, model projection, and runner files. App-ops should not publish or revert that mixed AKS domain state from metric triage.
- Not `upgrade_or_escalate`: the problem is serious but currently bounded and already represented; the next move is a known publication/reconciliation step rather than an unknown destructive or policy emergency.
- Not `document_exception`: this is active unpublished work, not an accepted long-term exception.

## Exact wait, observer, and fallback

### Wait
Wait for the domain publication boundary to be reconciled truthfully:

1. integrate local `dev` with remote `origin/dev`, and
2. publish, rebase, or revert the current 27-file residue so pipeline-visible repo state matches intended local truth.

### Existing represented work
The current project state already shows this is represented domain work rather than orphaned metric noise:

- blocked holder `hold-compact-net-integration-package-partial-frontier`
- blocked holder `hold-compact-rp-cluster-lifecycle-package-partial-frontier`
- active domain checkpoint task `domain/resolve-mixed-knowledge-map-projection-checkpoint-frontier-20260713`

Those holders explain why app-ops should keep one process wait rather than force an app-side publication decision.

### Observer
`app-ops` rechecks via:

- the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`,
- `git rev-list --left-right --count origin/dev...HEAD`, and
- `git status --short --untracked-files=no` in `/app/projects/aks-rp-e2e`.

### Fallback
If the next snapshot still breaches at the same mixed residue after the current domain checkpoint/publication work has had a chance to act, reopen this as stronger publication-closure action with the corrected blocker story: non-fast-forward divergence plus mixed unpublished domain state, not missing `az`.

## Required next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if `/app/projects/aks-rp-e2e` is rebased/merged against `origin/dev` and the current residue is either published or truthfully cleared.
