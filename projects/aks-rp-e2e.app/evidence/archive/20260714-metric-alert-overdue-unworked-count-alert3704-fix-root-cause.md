# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3704

- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Alert id: `3704`
- Operation: `fix_root_cause`
- Judged at: `2026-07-14T18:36Z`

## Why this was a real breach

A fresh local recompute at triage start still showed the metric live-breaching at `32`, so this was not a stale alert row:

```json
{"measuredAt":1784054063703,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":32,"sampleSize":32,"note":"{\"offenderTaskIds\":[\"wait-compact-reviewed-exception-live-ready-policy-family-20260702\",\"wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703\",\"wait-compact-serverless-multi-pod-burst-runtime-readiness-20260705\",\"wait-kms-v2-managed-hsm-environment-return-20260706\",\"hold-spec-loop-pending-kms-v2plus-reviewed-exception-boundaries-20260706\",\"hold-compact-traffic-applink-upgrade-survival-contract-mismatch-frontier-20260707\",\"hold-compact-secure-tls-bootstrap-package-partial-frontier-20260707\",\"hold-compact-storage-csi-successor-pair-and-residual-frontier-20260707\",\"hold-spec-secure-tls-bootstrap-network-isolated-image-pull-after-disable-frontier-20260708\",\"hold-spec-localdns-managed-cluster-quota-family-frontier-20260708\",\"hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708\",\"hold-compact-ccp-agent-reviewed-exception-frontier\",\"hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier\",\"hold-compact-localdns-package-partial-frontier\",\"hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier\",\"hold-compact-workload-autoscaler-package-partial-frontier\",\"wait-localdns-hosts-plugin-create-http400-body-or-surface-change-20260703\",\"hold-compact-windows-eligibility-frontier-20260707\",\"hold-compact-ccp-autoupgrader-pipeline-reviewed-exception-frontier\",\"hold-compact-ccp-metricsserver-reviewed-exception-frontier\",\"hold-compact-cost-analysis-reviewed-exception-frontier\",\"hold-compact-traffic-alb-controller-package-partial-frontier\",\"wait-localdns-create-http400-residual-family-return-20260704\",\"ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized\",\"ops/wait-compact-remediator-runtime-owner-review-return-20260709-owner-normalized\",\"hold-spec-localdns-windows-nodepool-unsupported-nonlive-evidence-ceiling-20260712\",\"hold-compact-traffic-applink-cross-cluster-self-contained-carrier-gap-20260707\",\"hold-compact-paf-throttling-reviewed-exception-frontier-owner-normalized-20260713\",\"hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier-20260713\",\"wait-compact-machines-agentpool-run-28809049156-review-20260714\",\"hold-spec-localdns-autodefault-fresh-create-136-cilium-environment-frontier-20260714\",\"hold-compact-jwt-authenticator-package-partial-frontier\"]}"}
```

The offender set broke down as:

- `21` compact-loop blocked waits
- `10` spec-loop blocked waits
- `1` project-root blocked wait

Every sampled task still existed as a blocked leaf with the same exact wait content, but all had the same expired review window (`next_check_at = 2026-07-14T18:30:00Z`).

## Root cause

The issue was process stewardship drift, not a bad blocker model: the blocked waits were still truthful same-lineage holders, but their scheduled review windows had all elapsed without a fresh blocked-wait refresh or narrower successor. Because this metric counts blocked waits whose earliest check/resume/fallback time has already passed and that lack active recovery coverage, the shared expired `next_check_at` window was the direct cause of the `32` breach.

## Fix applied

I refreshed all `32` sampled blocked waits in place through the supported task-tree write path (`bun run ./scripts/task-tree.ts refresh-blocked-wait ...`), preserving each task's existing blocker condition, wait target, observer metadata, owner, fallback time, and fallback action while moving `next_check_at` forward to `2026-07-15T00:30:00Z`.

Applied summary on each refreshed task:

> `Alert 3704 triage confirmed this same-lineage blocker remains truthful; refreshed the expired blocked-wait review window in place without widening scope.`

Representative refreshed tasks:

1. `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
2. `ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized`
3. `hold-spec-localdns-autodefault-fresh-create-136-cilium-environment-frontier-20260714`

## Immediate validation

A fresh recompute immediately after the refresh cleared the metric:

```json
{"measuredAt":1784054155789,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

Representative task readback confirms the new review window and trace update:

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
  - `blocker.next_check_at = 2026-07-15T00:30:00Z`
  - `trace.blocked_wait_refreshed_at = 2026-07-14T18:35:46.414Z`
- `ops/wait-windows-node-pool-create-owner-arbitration-return-20260709s-owner-normalized`
  - `blocker.next_check_at = 2026-07-15T00:30:00Z`
  - `trace.blocked_wait_refreshed_at = 2026-07-14T18:35:49.214Z`
- `hold-spec-localdns-autodefault-fresh-create-136-cilium-environment-frontier-20260714`
  - `blocker.next_check_at = 2026-07-15T00:30:00Z`
  - `trace.blocked_wait_refreshed_at = 2026-07-14T18:35:50.068Z`

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` with `offenderTaskIds=[]` until one of these same-lineage waits reaches its new review window or a returned/rerouted signal changes one of the blocker sets.
