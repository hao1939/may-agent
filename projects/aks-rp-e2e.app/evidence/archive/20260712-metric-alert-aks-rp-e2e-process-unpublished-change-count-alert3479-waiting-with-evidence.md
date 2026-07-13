# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3479)

- Alert id: `3479`
- Judged at: `2026-07-12T17:59:41Z`
- Chosen operation: `waiting_with_evidence`
- Metric row at triage: current `12`, threshold `0`, target `0`, priority `P0`
- Owner: `app-ops`

## Current measurement is real

Runtime metric state at triage:

- metric `aks-rp-e2e.process.unpublished-change-count`
- `current = 12`
- `threshold = 0`
- `source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count`

Fresh recompute during this triage returned:

```json
{"measuredAt":1783882043767,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":12}
```

So this is not a stale alert row and not a measurement bug. The breach is live now.

## Exact unpublished surface in the domain repo

Fresh `git status --short` in `/app/projects/aks-rp-e2e` showed one unpublished local commit plus eleven tracked modified files:

```text
* 46c320565 (HEAD -> dev) checkpoint localdns ccp generated visible bundle
* ecfb241e5 (origin/dev) checkpoint: refresh rp-cluster-lifecycle no-live frontier
---
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
```

That explains the live metric exactly:

- `1` unpublished local commit ahead of `origin/dev`
- `11` tracked modified files
- total `12`

A focused diffstat over the RP cluster lifecycle slice confirmed the breach is coherent domain work, not app-runtime noise:

```text
11 files changed, 136 insertions(+), 192 deletions(-)
```

## Why this is a wait, not an app-side fix

This metric counts unpublished AKS domain-repo state in `/app/projects/aks-rp-e2e`.

App-ops can verify and route the process signal, but app-ops should not independently publish or revert AKS domain truth in feature/spec/test/compact files. The live residue is RP cluster lifecycle domain work, not app orchestration drift.

There is also a concrete runtime blocker on publication from this environment. Both remote checks failed because the Azure DevOps credential helper depends on `az`, which is unavailable here:

```text
/app/.state/.local/bin/git-credential-azdevops: line 28: az: command not found
fatal: could not read Username for 'https://dev.azure.com/msazure/CloudNativeCompute/_git/aks-e2e-spec-runner': No such device or address
```

That means this session cannot safely validate or complete a push even if the domain owner wanted to publish now.

## Why `waiting_with_evidence` is the correct operation now

Choose `waiting_with_evidence`.

- Not `resolve_stale`: fresh recompute still returns `12`.
- Not `calibrate_metric`: threshold `0` remains correct because unpublished domain changes are not visible to pipeline runs.
- Not `downgrade_priority`: this is still a real pipeline-visibility gap.
- Not `fix_root_cause`: clearing the metric would require publishing, reverting, or replacing RP cluster lifecycle domain changes in the domain repo, which app-ops should not do from this triage lane; publication is also blocked by missing Azure DevOps auth tooling.
- Not `upgrade_or_escalate`: this is a bounded known wait with an exact technical blocker, not a destructive-action or policy emergency.
- Not `document_exception`: this is active unpublished domain work, not an accepted long-term exception.

## Exact wait, observer, and fallback

### Wait
Wait for one of these exact closure paths:

1. publish the current RP cluster lifecycle domain slice so pipeline-visible repo state matches local intended state, or
2. revert/supersede the local slice if the classification is not ready, or
3. restore an auth-capable publication path for this repo and then complete the truthful publish/revert decision.

### Observer
`app-ops` rechecks via:

- the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, and
- the domain repo state in `/app/projects/aks-rp-e2e` for the eleven listed RP cluster lifecycle files plus the ahead-1 branch state.

### Fallback
If the next snapshot still breaches with the same RP cluster lifecycle residue and `az`-backed publication remains unavailable, escalate from passive wait to explicit owner/runtime repair because the repo-local domain slice will still be invisible to pipeline runs.

## Required next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if the RP cluster lifecycle slice is published, reverted, or the Azure DevOps auth/runtime path is restored before the next snapshot.
