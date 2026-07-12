# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 3420)

- Alert id: `3420`
- Judged at: `2026-07-12T17:59:41Z`
- Chosen operation: `upgrade_or_escalate`
- Metric owner: `app-ops`
- Metric priority: `P0`

## Current metric state

Runtime metric row still shows a live breach:

- metric id: `aks-rp-e2e.process.unpublished-change-count`
- `current = 22`
- `threshold = 0`
- `target = 0`
- `source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count`

Recent snapshots are flat at `22` across the last 20 samples, so this is not transient.

## Current git reconciliation

Fresh domain-repo status from `/app/projects/aks-rp-e2e`:

```text
## dev...origin/dev [ahead 3]
 M features/net-integration/packets/multinic-mixed.yaml
 M features/net-integration/specs/net-integration-multinic-mixed.json
 M features/net-integration/tests/net-integration-multinic-mixed.test.ts
 M features/net-integration/tests/net-integration-multinic-mixed.ts
 M features/net-integration/tests/net-integration-outbound-migration-natgw-to-none.ts
 M features/rp-cluster-lifecycle/specs/rp-available-agent-pool-versions.json
 M features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-list-credentials.json
 M features/rp-cluster-lifecycle/specs/rp-cluster-lifecycle-rotate-certificates.json
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
?? features/net-integration/packets/multinic-mixed-source-pack-20260711.json
```

Reconciliation against the metric:

- `19` current worktree changes (`18` modified tracked paths + `1` untracked packet)
- `+3` unpublished local commits from `origin/dev..HEAD`
- `= 22` unpublished changes

Current unpublished commits are:

```text
a096a0317 checkpoint: tighten rp-cluster-lp-e2e no-live carriers
ec0a40639 checkpoint: land rp-cluster-lifecycle model writeback slice
30bdc6df8 app-ops: record planner slow-count waiting evidence
```

So the metric is real and current, not stale and not a measurement bug.

## Exact live slices

### Slice A — rp-cluster-lifecycle promotion/writeback surface

`14` current unpublished units are tied to the RP cluster lifecycle package-partial promotion branch:

- `3` ahead commits listed above
- `11` current modified paths in `features/rp-cluster-lifecycle/*` and `model/knowledge-map/*`

Live app task-tree context already names this family frontier. `tasks/tree.json` currently preserves an exact RP lifecycle mixed frontier whose resume condition explicitly includes:

- `spec.rp-cluster-lifecycle.list-credentials`
- `spec.rp-cluster-lifecycle.rotate-certificates`
- `spec.rp.available-agent-pool-versions`
- `spec.rp.operation-status-polling`

That means the family is visible, but the repo still contains unpublished local commits and writeback files that pipeline runs cannot see.

### Slice B — net-integration mixed frontier surface

`5` current unpublished units are tied to the live net-integration frontier:

- `features/net-integration/packets/multinic-mixed.yaml`
- `features/net-integration/specs/net-integration-multinic-mixed.json`
- `features/net-integration/tests/net-integration-multinic-mixed.test.ts`
- `features/net-integration/tests/net-integration-multinic-mixed.ts`
- `features/net-integration/tests/net-integration-outbound-migration-natgw-to-none.ts`
- plus untracked packet `features/net-integration/packets/multinic-mixed-source-pack-20260711.json`

Live app task-tree context already preserves this exact frontier too. `tasks/tree.json` resume text explicitly references:

- `spec.net-integration.multinic-mixed`
- `spec.net-integration.outbound-migration-natgw-to-none`

Again, the work is represented, but it is still unpublished relative to the pipeline.

## Why this is `upgrade_or_escalate`

Do **not** choose `fix_root_cause` here.

App-ops cannot safely clear this metric inside alert triage because the remaining work spans active domain slices plus three unpublished local commits in the domain repo. The only direct closure actions are:

1. push the three local commits to `origin/dev`, and/or
2. publish or revert the active domain worktree slices.

The first action is blocked in the current runtime. Fresh push verification failed:

```text
/app/.state/.local/bin/git-credential-azdevops: line 28: az: command not found
fatal: could not read Username for 'https://dev.azure.com/msazure/CloudNativeCompute/_git/aks-e2e-spec-runner': No such device or address
```

That is an authentication/runtime capability problem, not a safe local app-ops repair.

The second action is domain publication judgment, not app process orchestration. The dirty net-integration and RP-cluster-lifecycle files correspond to live domain frontiers, so app-ops should not blindly commit or revert them from metric triage.

This alert also meets the manual's escalation conditions:

- priority is `P0`
- the value has repeated across many owner sessions without recovery
- the safe fix now requires human/runtime credential help or an explicit publication decision

## Exact escalation request

Human/May decision needed:

1. restore a usable authenticated push path for `/app/projects/aks-rp-e2e` (current blocker: `az` unavailable to `git-credential-azdevops`), **or**
2. direct the owning domain lane to publish/revert the three ahead commits by another approved path, while preserving the current active net-integration and RP-cluster-lifecycle worktree slices.

Until that happens, the metric will continue to report a real pipeline-visibility gap even though the task tree truthfully represents the active families.

## Next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count` after either:

- authenticated push capability is restored, or
- the domain owners publish/revert the ahead commits and current worktree slices.

## Revalidation at 2026-07-12T17:59:41Z

This alert was rechecked against live runtime and repo state during metric-alert triage:

- runtime `metrics.current` still reads `22` with `threshold = 0` and `priority = P0`
- the latest 10 `metric_snapshots` are all flat at `22`
- `/app/projects/aks-rp-e2e` is still `ahead 3` with `19` live worktree changes (`18` modified tracked paths + `1` untracked packet), matching the total `22`
- `git push --dry-run origin dev` still fails because `git-credential-azdevops` cannot invoke `az`

That confirms the prior `upgrade_or_escalate` judgment still stands: the breach is real, persistent across owner sessions, and not safely clearable from app-ops triage without restored publication capability or an explicit human/domain publication decision.
