# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (2026-07-10)

- Alert id: `3300`
- Judged at: `2026-07-10T15:08:00Z`
- Chosen operation: `waiting_with_evidence`
- Metric row at triage: current `29`, threshold `0`, target `0`, priority `P0`
- Owner: `app-ops`

## Current measurement is real

The metric implementation in `projects/aks-rp-e2e.app/scripts/project-metrics.ts` defines `aks-rp-e2e.process.unpublished-change-count` as `unpublishedGitChangeCount(projectDir)`.

That helper runs:

- `git status --porcelain=v1 --branch` in `/app/projects/aks-rp-e2e`
- counts each tracked status line
- adds any `ahead N` divergence from the branch header

Fresh checks in this session produced:

```text
## dev...origin/dev
 M features/cluster-autoscaler/compact/staging.diagnostics.json
 M features/cluster-autoscaler/compact/staging.plan.json
 M features/cluster-autoscaler/compact/staging.summary.md
 M features/gpu/compact/staging.diagnostics.json
 M features/gpu/compact/staging.plan.json
 M features/gpu/compact/staging.summary.md
 M features/net-integration/compact/staging.diagnostics.json
 M features/net-integration/compact/staging.plan.json
 M features/net-integration/compact/staging.summary.md
 M features/net-integration/specs/net-integration-outbound-udr.json
 M features/network-cni/specs/network-cni-vm-prerelease-calico-eno-migration-matrix.json
 M features/rp-cluster-lifecycle/compact/staging.diagnostics.json
 M features/rp-cluster-lifecycle/compact/staging.plan.json
 M features/rp-cluster-lifecycle/compact/staging.summary.md
 M features/rp-nodepool-lifecycle/compact/staging.diagnostics.json
 M features/rp-nodepool-lifecycle/compact/staging.plan.json
 M features/rp-nodepool-lifecycle/compact/staging.summary.md
 M features/rp-nodepool-lifecycle/specs/rp-nodepool-lifecycle-multi-agentpool-runner.json
 M features/rp-nodepool-lifecycle/specs/rp-nodepool-lifecycle-rollback.json
 M features/rp-nodepool-lifecycle/tests/rp-nodepool-lifecycle-multi-agentpool-runner.test.ts
 M features/rp-nodepool-lifecycle/tests/rp-nodepool-lifecycle-multi-agentpool-runner.ts
 M model/knowledge-map/model.json
 M model/knowledge-map/views/evidence-index.md
 M model/knowledge-map/views/evidence-matrix.json
 M model/knowledge-map/views/graph-view.json
 M model/knowledge-map/views/model.generated.md
 M model/knowledge-map/views/path-summary.json
 M model/knowledge-map/views/status-summary.json
```

That is `28` tracked modifications and `0` ahead commits, which exactly matches a fresh local metric sample:

```json
{"measuredAt":1783695415104,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":28}
```

So the alert is live, not stale.

## Current unpublished surface is already represented by active domain work

The task tree now shows a broader exact compact/publication frontier than the older `12`-count note.

### Active compact holders currently explain most dirty compact files

Current tree evidence shows these active compact holders in the frontier:

- `compact-feature-cluster-autoscaler`
- `compact-feature-net-integration`
- `compact-feature-rp-cluster-lifecycle`
- `compact-feature-rp-nodepool-lifecycle`

And the current focus packet explicitly lists those same four active compact features as the bounded 12–24h mission.

Those holders match these dirty compact artifact families now present in the repo:

- `features/cluster-autoscaler/compact/staging.*`
- `features/net-integration/compact/staging.*`
- `features/rp-cluster-lifecycle/compact/staging.*`
- `features/rp-nodepool-lifecycle/compact/staging.*`

The frontier also includes GPU compact review context (`domain/reconcile-compact-package-partial-gpu-current-head-20260710`), which matches the dirty `features/gpu/compact/staging.*` slice.

### Remaining dirty spec/model files are still attributable, not orphaned

The current non-compact portion of the diff consists of:

- `features/net-integration/specs/net-integration-outbound-udr.json`
- `features/network-cni/specs/network-cni-vm-prerelease-calico-eno-migration-matrix.json`
- `features/rp-nodepool-lifecycle/specs/rp-nodepool-lifecycle-multi-agentpool-runner.json`
- `features/rp-nodepool-lifecycle/specs/rp-nodepool-lifecycle-rollback.json`
- `features/rp-nodepool-lifecycle/tests/rp-nodepool-lifecycle-multi-agentpool-runner.test.ts`
- `features/rp-nodepool-lifecycle/tests/rp-nodepool-lifecycle-multi-agentpool-runner.ts`
- `model/knowledge-map/model.json`
- `model/knowledge-map/views/evidence-index.md`
- `model/knowledge-map/views/evidence-matrix.json`
- `model/knowledge-map/views/graph-view.json`
- `model/knowledge-map/views/model.generated.md`
- `model/knowledge-map/views/path-summary.json`
- `model/knowledge-map/views/status-summary.json`

These are consistent with the live bounded publication/writeback frontier rather than a measurement bug:

- the task tree still preserves the exact net-integration outbound-UDR blocked/writeback family;
- the tree still preserves the exact network-cni matrix frontier for `spec.network-cni.vm-prerelease-calico-eno-migration-matrix`;
- current focus explicitly says repo-local convergence now spans compact/spec/model closure and state alignment, not just one compact package.

### The previous ahead-commit wait remains relevant process context, but is not part of the current 28-count sample

`wait-shared-azure-devops-auth-capable-runtime-provider-response-20260709` still exists as the exact blocked family for auth-capable origin/dev publication and artifact recovery. However, the current live repo sample is `ahead 0`, so today’s breach is dominated by tracked repo-local modifications rather than an unpublished local commit.

## Judgment

Choose `waiting_with_evidence`.

Why this is not `resolve_stale`:
- fresh repo state and a fresh metric run both return `28`, so the alert is current.

Why this is not `calibrate_metric`:
- threshold `0` is still correct because any unpublished repo-local change is, by definition, not yet visible to the pipeline.

Why this is not `fix_root_cause` from app-ops in this session:
- the current 28-file surface is already carried by active/review/repo-local domain work owned by `aks-explorer`;
- app-ops should not publish or rewrite those domain slices by hand just to clear a metric;
- there is no safe app-ops-owned one-step repair that would truthfully reduce the count without taking over domain publication decisions.

Why this is not `upgrade_or_escalate`:
- the process already contains exact active holders and an exact shared wait for the auth-capable publication family, so this is not an unowned emergency.

## Required next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if any of these happen:

1. one of the active compact holders publishes or replaces its exact current dirty slice;
2. the GPU review leaf closes and its compact artifacts are either published or removed from the dirty surface;
3. the net-integration / network-cni / rp-nodepool-lifecycle spec-model writeback frontier lands as a bounded publication or exact hold.
