# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (2026-07-10)

- Alert id: `3300`
- Judged at: `2026-07-10T15:10:39Z`
- Chosen operation: `waiting_with_evidence`
- Metric row at triage: current `28`, threshold `0`, target `0`, priority `P0`
- Owner: `app-ops`

## Current measurement is real

The metric implementation in `projects/aks-rp-e2e.app/scripts/project-metrics.ts` defines `aks-rp-e2e.process.unpublished-change-count` as `unpublishedGitChangeCount(projectDir)`.

That helper runs `git status --porcelain=v1 --branch` in `/app/projects/aks-rp-e2e`, counts each tracked status line, and adds any `ahead N` divergence from the branch header.

Fresh checks in this session produced:

- direct recompute from `/app/projects/aks-rp-e2e.app` via `bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count --json` returned `{"measuredAt":1783695839495,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":28}`
- direct `git status --porcelain=v1 --branch` in `/app/projects/aks-rp-e2e` returned `## dev...origin/dev` plus `28` tracked modified paths and no `ahead` marker

So the alert is live, not stale.

## Current unpublished surface is already represented by active domain work

Current task-tree evidence in `projects/aks-rp-e2e.app/tasks/tree.json` shows these active compact holders in the frontier:

- `compact-feature-cluster-autoscaler`
- `compact-feature-net-integration`
- `compact-feature-rp-cluster-lifecycle`
- `compact-feature-rp-nodepool-lifecycle`

The same tree also names `domain/reconcile-compact-package-partial-gpu-current-head-20260710` as the current GPU compact review leaf.

Those active/review holders align with the current dirty compact artifact families in `/app/projects/aks-rp-e2e`:

- `features/cluster-autoscaler/compact/staging.*`
- `features/gpu/compact/staging.*`
- `features/net-integration/compact/staging.*`
- `features/rp-cluster-lifecycle/compact/staging.*`
- `features/rp-nodepool-lifecycle/compact/staging.*`

The remaining dirty spec/model files are also still attributable rather than orphaned:

- `features/net-integration/specs/net-integration-outbound-udr.json`
- `features/network-cni/specs/network-cni-vm-prerelease-calico-eno-migration-matrix.json`
- `features/rp-nodepool-lifecycle/specs/rp-nodepool-lifecycle-multi-agentpool-runner.json`
- `features/rp-nodepool-lifecycle/specs/rp-nodepool-lifecycle-rollback.json`
- `features/rp-nodepool-lifecycle/tests/rp-nodepool-lifecycle-multi-agentpool-runner.test.ts`
- `features/rp-nodepool-lifecycle/tests/rp-nodepool-lifecycle-multi-agentpool-runner.ts`
- `model/knowledge-map/model.json`
- `model/knowledge-map/views/*`

Task-tree evidence still preserves exact holders for the net-integration outbound-UDR family and the network-cni matrix family, and the current focus packet in the tree says repo-local convergence now spans compact/spec/model closure and state alignment.

## Why the correct operation is `waiting_with_evidence`

Choose `waiting_with_evidence`.

- Not `resolve_stale`: a fresh recompute still returns `28`, and direct repo state matches it.
- Not `calibrate_metric`: threshold `0` is still correct because unpublished repo-local domain changes are not visible to pipeline runs.
- Not `fix_root_cause`: app-ops should not publish, revert, or rewrite active `aks-explorer` domain slices by hand just to clear the metric, and there is no safe app-ops-only one-step repair that truthfully reduces this count.
- Not `upgrade_or_escalate`: the current breach is already carried by exact active/review holders and an existing auth-capable publication wait; this is not an unowned or human-decision emergency in this session.

This session’s concrete change is a refreshed durable evidence note that records the current `28` measurement, the exact dirty repo surface, and the exact task-tree holders that currently explain why the metric is still open.

## Required next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if any of these happen:

1. one of the active compact holders publishes or replaces its exact current dirty slice;
2. the GPU review leaf closes and its compact artifacts are either published or removed from the dirty surface;
3. the net-integration / network-cni / rp-nodepool-lifecycle spec-model writeback frontier lands as a bounded publication or exact hold.
