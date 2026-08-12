# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 4272)

- Operation: `waiting_with_evidence`
- Alert id: `4272`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-30T11:32:26Z`

## Current breach is real

- Runtime metric row still reads `current=26`, `threshold=0`, `target=0`, `priority=P0`.
- Fresh direct recompute from `/app/projects/aks-rp-e2e.app` returned `{"value":26}`.
- `git -C /app/projects/aks-rp-e2e status --porcelain=v1 --branch` still shows 26 tracked unpublished files while the repo is `behind 27` on `origin/dev`.

## Current unpublished contributors

```text
features/ccp-agent/compact/staging.diagnostics.json
features/ccp-agent/compact/staging.plan.json
features/ccp-agent/compact/staging.summary.md
features/ccp-agent/specs/ccp-agent-connectivity-tunnel.json
features/ccp-agent/specs/ccp-agent-lifecycle-deployment.json
features/ccp-agent/specs/ccp-connected-cluster-proxy-auth.json
features/gpu/compact/staging.diagnostics.json
features/gpu/compact/staging.summary.md
features/jwt-authenticator/compact/staging.diagnostics.json
features/jwt-authenticator/compact/staging.plan.json
features/net-integration/compact/staging.diagnostics.json
features/net-integration/compact/staging.plan.json
features/net-integration/compact/staging.summary.md
features/node-pool-config/compact/staging.diagnostics.json
features/node-pool-config/compact/staging.plan.json
features/service-platform/compact/staging.summary.md
features/traffic-alb-controller/compact/staging.diagnostics.json
features/traffic-alb-controller/compact/staging.plan.json
features/traffic-alb-controller/compact/staging.summary.md
model/knowledge-map/model.json
model/knowledge-map/views/evidence-index.md
model/knowledge-map/views/evidence-matrix.json
model/knowledge-map/views/graph-view.json
model/knowledge-map/views/model.generated.md
model/knowledge-map/views/path-summary.json
model/knowledge-map/views/status-summary.json
```

## Exact current holder map

The alert is still red, but the counted residue is no longer an unowned blob. Current task-tree evidence shows each active slice already has a live owner path:

- `ccp-agent` six-file compact/spec slice → `compact/compact-feature-ccp-agent` with live child `domain/reconcile-compact-ccp-agent-tunnelfront-approved-lineage-next-step-20260730`.
- `gpu` two-file compact slice → `hold-compact-gpu-reviewed-terminal-and-shared-owner-return-frontier-20260728` on exact approval-return condition `approval-return:shared-owner-return-family-refresh-20260710:task-hold-compact-gpu-reviewed-terminal-and-shared-owner-return-frontier-20260728`.
- `jwt-authenticator` compact residue → `compact/repair-compact-feature-jwt-authenticator-representation-8b54418fcc`.
- `net-integration` compact residue → `compact/compact-feature-net-integration-f1511202e3`.
- `node-pool-config` compact residue → `hold-compact-node-pool-config-environment-frontier-df5a8af6f1-20260730`.
- `service-platform` reviewed-terminal writeback → `domain/publish-service-platform-compact-reviewed-terminal-writeback-20260730` (`workflow: domain-task-execution`).
- `traffic-alb-controller` compact residue → parent `compact/reconcile-traffic-alb-controller-clean-origin-dev-partial-frontier-4fae089c-20260726` with live children `compact/reconcile-traffic-alb-controller-ingress-routing-rerun-ready-origin-dev-86645c57-20260726` and `compact/reconcile-traffic-alb-controller-upgrade-survival-rerun-ready-origin-dev-86645c57-20260726`.
- seven-file knowledge-map spillover → `ops/reconcile-unpublished-knowledge-map-spillover-ccp-agent-net-integration-private-cluster-20260730`.

## Why this is `waiting_with_evidence`

The threshold `0` is still correct: these 26 repo-local changes are not visible to pipeline runs until they are published or truthfully cleared.

This is not `resolve_stale`, because the fresh recompute still returns `26`.
This is not `calibrate_metric`, because the measurement matches current repo truth.
This is not `fix_root_cause`, because in the current evidence the remaining contributors are already bound to exact current domain/app holders; app-ops does not have a safe same-turn publication or cleanup action for all of them from this triage workflow.

The concrete owner-side action taken in the current runtime is to keep the new exact app-ops carrier `ops/reconcile-unpublished-knowledge-map-spillover-ccp-agent-net-integration-private-cluster-20260730` as the same-scope owner for the 7-file knowledge-map spillover while the domain-owned holders continue to drain the feature slices.

## Next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner if any of these happen first:

1. `domain/publish-service-platform-compact-reviewed-terminal-writeback-20260730` publishes its one-file slice;
2. `ops/reconcile-unpublished-knowledge-map-spillover-ccp-agent-net-integration-private-cluster-20260730` either clears the seven model/view files or hands off one narrower exact successor;
3. the active `ccp-agent`, `gpu`, `jwt-authenticator`, `net-integration`, `node-pool-config`, or `traffic-alb-controller` holders publish or clear their current compact residues.
