# Metric alert triage — `aks-rp-e2e.process.unpublished-change-count` (alert 4272)

- Operation: `upgrade_or_escalate`
- Alert id: `4272`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-08-02T04:52:03Z`

## Current breach is still real

- Runtime metric row still reads `current=27`, `threshold=0`, `target=0`, `priority=P0`.
- Fresh direct recompute from `/app/projects/aks-rp-e2e.app` returned `{"measuredAt":1785650789222,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":27}`.
- `/app/projects/aks-rp-e2e` currently shows 27 tracked dirty files and `git status --short --branch` reports `## dev...origin/dev [behind 251]`, so the live `27` is current worktree residue rather than unpublished local commits.

## Current unpublished contributors

```text
features/artifact-streaming/compact/staging.diagnostics.json
features/artifact-streaming/compact/staging.plan.json
features/artifact-streaming/compact/staging.summary.md
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
features/node-pool-config/compact/staging.diagnostics.json
features/node-pool-config/compact/staging.plan.json
features/node-pool-config/specs/node-pool-config-custom-ca.json
features/node-pool-config/tests/node-pool-config-custom-ca.test.ts
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

## What is still correctly represented

Current task-tree evidence still gives exact live holders for 25 of the 27 contributors:

- **artifact-streaming three-file compact slice** → `compact/compact-feature-artifact-streaming-25331d0bdc` (`phase=waiting`) with fresh owner evidence that the current `features/artifact-streaming/compact/staging.summary.md` and `staging.diagnostics.json` are the exact authorities for the next repair, plus a running owner attempt started `2026-08-02T06:07:39Z`.
- **ccp-agent six-file compact/spec slice** → `compact/compact-feature-ccp-agent` (`phase=waiting`) with child `domain/reconcile-compact-ccp-agent-tunnelfront-approved-lineage-next-step-20260730`.
- **gpu two-file compact slice** → `hold-compact-gpu-reviewed-terminal-and-shared-owner-return-frontier-20260728` (`phase=waiting`) on exact shared owner-return conditions.
- **jwt-authenticator two-file compact slice** → `compact/compact-feature-jwt-authenticator-c1f399c68a` (`phase=waiting`) on the exact owner-return wait.
- **traffic-alb-controller three-file compact slice** → parent `compact/reconcile-traffic-alb-controller-clean-origin-dev-partial-frontier-4fae089c-20260726` with live child waits for ingress-routing and upgrade-survival.
- **knowledge-map seven-file spillover** → `ops/reconcile-unpublished-knowledge-map-spillover-ccp-agent-net-integration-private-cluster-20260730` with child `domain/reconcile-clean-origin-dev-knowledge-map-slice-ccp-net-private-20260730` dependency-blocked on the feature holders above.
- **node-pool-config compact pair** → `hold-compact-node-pool-config-environment-frontier-df5a8af6f1-20260730` truthfully carries the compact `staging.diagnostics.json` and `staging.plan.json` wait.

## Why this remains escalation, not another waiting refresh

Two of the 27 counted files are still **not** represented by any exact current holder input or scoped path in the live task tree:

- `features/node-pool-config/specs/node-pool-config-custom-ca.json`
- `features/node-pool-config/tests/node-pool-config-custom-ca.test.ts`

A fresh search through `.state/tasks/tree.json` again found no live task input mentioning `node-pool-config-custom-ca` or `node-pool-config-custom-ca.test.ts`. The current node-pool-config holders still cover other scopes (`kubereserved`, `skip-gpu-driver`, and a master-validation product-issue wait), so the frontier still does not fully explain all 27 contributors.

Because of that uncovered residue, this is still not truthfully `waiting_with_evidence`. This is also not `fix_root_cause` in the current workflow turn:

- the same custom-ca owner gap was already escalated in `evidence/archive/20260801-metric-alert-aks-rp-e2e-process-unpublished-change-count-alert4272-upgrade-or-escalate.md`;
- the metric has since increased from `24` to `27` because artifact-streaming compact residue reappeared while the custom-ca gap remained unresolved;
- this workflow turn still has no safe control-plane write tool to create or repair the missing holder task, and app-ops must not edit `.state/tasks/tree.json` directly.

## Escalation requested

The controller or owner path with task-tree write authority still needs one of these concrete process actions:

1. create one exact live holder for the unrepresented `node-pool-config-custom-ca` spec/test residue, or
2. truthfully clear those two files from `/app/projects/aks-rp-e2e` if they are stale spillover rather than intended work.

Until one of those happens, the P0 metric should remain open because the repo still has pipeline-invisible changes and the current task frontier still does not fully explain them.

## Next validation

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.unpublished-change-count`, or sooner after either:

1. a controller/owner task-tree update creates an exact carrier for the two `node-pool-config-custom-ca` files; or
2. those two files are published or cleared and the direct recompute drops below `27`.
