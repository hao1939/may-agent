# Metric alert triage — aks-rp-e2e.process.unpublished-change-count (alert 2974)

- Alert id: `2974`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-07T13:13:10Z`
- Chosen operation: `waiting_with_evidence`

## Current measurement

Direct checks during this triage confirm the breach is still real:

- runtime metric row reports `current = 76`, `threshold = 0`, `target = 0`, `priority = P0`, updated at `1783437978747`
- the latest ten snapshots are `76, 76, 76, 90, 90, 90, 90, 90, 89, 89`, measured between `1783435097568` and `1783437978747`, so this is an active but slightly shrinking breach rather than a stale row
- current domain-repo status in `/app/projects/aks-rp-e2e` shows **76 modified tracked paths** and no ahead/behind divergence against `origin/dev`
- `scripts/project-metrics.ts` implements this metric as `unpublishedGitChangeCount(projectDir)`, which counts each dirty tracked status line plus any `[ahead N]` branch marker; the current git status therefore explains the measured `76` directly

## Current dirty surface

The current unpublished tracked changes in `/app/projects/aks-rp-e2e` are entirely compact-loop writeback artifacts spread across staging diagnostics, plans, and summaries:

- `features/aad-rbac/compact/staging.diagnostics.json`
- `features/aad-rbac/compact/staging.plan.json`
- `features/aad-rbac/compact/staging.summary.md`
- `features/app-routing/compact/staging.diagnostics.json`
- `features/app-routing/compact/staging.plan.json`
- `features/app-routing/compact/staging.summary.md`
- `features/bootstrap-profile/compact/staging.diagnostics.json`
- `features/bootstrap-profile/compact/staging.summary.md`
- `features/egress-lockdown/compact/staging.diagnostics.json`
- `features/egress-lockdown/compact/staging.plan.json`
- `features/egress-lockdown/compact/staging.summary.md`
- `features/gpu/compact/staging.diagnostics.json`
- `features/gpu/compact/staging.plan.json`
- `features/gpu/compact/staging.summary.md`
- `features/jwt-authenticator/compact/staging.diagnostics.json`
- `features/jwt-authenticator/compact/staging.plan.json`
- `features/jwt-authenticator/compact/staging.summary.md`
- `features/machines-agentpool/compact/staging.diagnostics.json`
- `features/machines-agentpool/compact/staging.plan.json`
- `features/machines-agentpool/compact/staging.summary.md`
- `features/network-cni/compact/staging.diagnostics.json`
- `features/network-cni/compact/staging.plan.json`
- `features/network-cni/compact/staging.summary.md`
- `features/node-http-proxy/compact/staging.diagnostics.json`
- `features/node-http-proxy/compact/staging.plan.json`
- `features/node-http-proxy/compact/staging.summary.md`
- `features/oidc-issuer/compact/staging.diagnostics.json`
- `features/oidc-issuer/compact/staging.summary.md`
- `features/ossku-migration/compact/staging.diagnostics.json`
- `features/ossku-migration/compact/staging.plan.json`
- `features/ossku-migration/compact/staging.summary.md`
- `features/planned-maintenance/compact/staging.diagnostics.json`
- `features/planned-maintenance/compact/staging.plan.json`
- `features/planned-maintenance/compact/staging.summary.md`
- `features/private-cluster/compact/staging.diagnostics.json`
- `features/private-cluster/compact/staging.plan.json`
- `features/private-cluster/compact/staging.summary.md`
- `features/rp-cluster-lifecycle/compact/staging.diagnostics.json`
- `features/rp-cluster-lifecycle/compact/staging.plan.json`
- `features/rp-cluster-lifecycle/compact/staging.summary.md`
- `features/rp-nodepool-lifecycle/compact/staging.diagnostics.json`
- `features/rp-nodepool-lifecycle/compact/staging.plan.json`
- `features/rp-nodepool-lifecycle/compact/staging.summary.md`
- `features/secops/compact/staging.diagnostics.json`
- `features/secops/compact/staging.plan.json`
- `features/secops/compact/staging.summary.md`
- `features/secure-tls-bootstrap/compact/staging.diagnostics.json`
- `features/secure-tls-bootstrap/compact/staging.summary.md`
- `features/serverless-schedulerctrl/compact/staging.diagnostics.json`
- `features/serverless-schedulerctrl/compact/staging.summary.md`
- `features/serverless/compact/staging.diagnostics.json`
- `features/serverless/compact/staging.plan.json`
- `features/serverless/compact/staging.summary.md`
- `features/storage-csi/compact/staging.diagnostics.json`
- `features/storage-csi/compact/staging.plan.json`
- `features/storage-csi/compact/staging.summary.md`
- `features/traffic-alb-controller/compact/staging.diagnostics.json`
- `features/traffic-alb-controller/compact/staging.plan.json`
- `features/traffic-alb-controller/compact/staging.summary.md`
- `features/traffic-applink/compact/staging.diagnostics.json`
- `features/traffic-applink/compact/staging.plan.json`
- `features/traffic-applink/compact/staging.summary.md`
- `features/trusted-access/compact/staging.diagnostics.json`
- `features/trusted-access/compact/staging.plan.json`
- `features/trusted-access/compact/staging.summary.md`
- `features/virtualmachines-agentpool/compact/staging.diagnostics.json`
- `features/virtualmachines-agentpool/compact/staging.plan.json`
- `features/virtualmachines-agentpool/compact/staging.summary.md`
- `features/windows/compact/staging.diagnostics.json`
- `features/windows/compact/staging.plan.json`
- `features/windows/compact/staging.summary.md`
- `features/workload-autoscaler/compact/staging.diagnostics.json`
- `features/workload-autoscaler/compact/staging.plan.json`
- `features/workload-autoscaler/compact/staging.summary.md`
- `features/workload-identity/compact/staging.diagnostics.json`
- `features/workload-identity/compact/staging.summary.md`

## Why this remains waiting

This breach is real, but it is not safely fixable from this triage session:

1. Runtime `sessions` still shows three current `aks-explorer` sessions running against project `aks-rp-e2e`: one `workflow:project-planner` session and two `workflow:task-worker` sessions.
2. The entire dirty surface is active compact-loop writeback churn spread across many feature families, not one settled publication slice.
3. The branch is not ahead of `origin/dev`, so there is no simple "push unpublished commit" fix; the current breach is uncommitted tracked churn.
4. Forcing a checkpoint, revert, or publish from this alert session would collapse multiple active owner-side changes into one misleading hygiene action while work is still live.

## Concrete state change made by this triage

This triage refreshes the durable owner judgment in:

- `projects/aks-rp-e2e.app/evidence/metric-alert-unpublished-change-count-20260707-alert2974.md`

That evidence replaces the earlier stale `32`-change snapshot with the current `76`-change active compact-write surface and preserves the explicit wait condition instead of pretending this is a stale or safely fixable alert.

## Resume condition

Re-evaluate on the next `metrics-snapshot` after one of these happens:

1. the active planner/task-worker sessions finish and the remaining compact writebacks settle into one truthful publishable slice, or
2. the 76 dirty tracked files are intentionally published or cleared and the metric drops back to `0`.
