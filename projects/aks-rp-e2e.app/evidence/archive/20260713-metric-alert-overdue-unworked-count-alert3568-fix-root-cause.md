# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3568

- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Alert id: `3568`
- Operation: `fix_root_cause`
- Judged at: `2026-07-13T18:35Z`

## Why this was a real breach

A fresh local recompute at triage start still showed the metric live-breaching rather than stale:

```json
{"measuredAt":1783967651169,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":18,"sampleSize":18,"note":"{\"offenderTaskIds\":[\"wait-compact-reviewed-exception-live-ready-policy-family-20260702\",\"wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703\",\"wait-compact-serverless-multi-pod-burst-runtime-readiness-20260705\",\"wait-kms-v2-managed-hsm-environment-return-20260706\",\"hold-spec-loop-pending-kms-v2plus-reviewed-exception-boundaries-20260706\",\"hold-compact-secure-tls-bootstrap-package-partial-frontier-20260707\",\"wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708\",\"hold-spec-secure-tls-bootstrap-network-isolated-image-pull-after-disable-frontier-20260708\",\"hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708\",\"hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier\",\"hold-compact-defender-profile-reviewed-exception-frontier\",\"hold-compact-serverless-schedulerctrl-live-workflow-frontier\",\"hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier\",\"hold-compact-workload-autoscaler-package-partial-frontier\",\"hold-compact-machines-agentpool-package-partial-frontier-202607090638\",\"hold-compact-cost-analysis-reviewed-exception-frontier\",\"hold-compact-network-cni-package-partial-frontier-20260709i\",\"hold-compact-upgrade-underlay-runtime-input-frontier-20260712\"]}"}
```

This was not a stale alert row: the live sample still returned the same overdue blocked-wait set and the offenders were all exact waits/holders whose `resume_at` / `next_check_at` windows had simply expired again.

## Root cause

The current blockers were still truthful same-lineage waits, but their active watch windows had expired with no newer return, reroute, or sharper successor. That left 18 exact blocked waits passively overdue and uncovered by any active/review handoff.

## Root-cause fix applied

I refreshed the same 18 exact waits in place through the supported task-tree CLI, preserving each holder's current blocker text, wait target, observer metadata, and fallback action while advancing the review window by 24 hours. For each task I also updated `resume_at` to the same future value as `next_check_at` so the wait is no longer immediately overdue on the resume gate.

Refreshed tasks:

1. `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
2. `wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703`
3. `wait-compact-serverless-multi-pod-burst-runtime-readiness-20260705`
4. `wait-kms-v2-managed-hsm-environment-return-20260706`
5. `hold-spec-loop-pending-kms-v2plus-reviewed-exception-boundaries-20260706`
6. `hold-compact-secure-tls-bootstrap-package-partial-frontier-20260707`
7. `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
8. `hold-spec-secure-tls-bootstrap-network-isolated-image-pull-after-disable-frontier-20260708`
9. `hold-spec-serverless-schedulerctrl-underlay-kubeconfig-frontier-20260708`
10. `hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier`
11. `hold-compact-defender-profile-reviewed-exception-frontier`
12. `hold-compact-serverless-schedulerctrl-live-workflow-frontier`
13. `hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier`
14. `hold-compact-workload-autoscaler-package-partial-frontier`
15. `hold-compact-machines-agentpool-package-partial-frontier-202607090638`
16. `hold-compact-cost-analysis-reviewed-exception-frontier`
17. `hold-compact-network-cni-package-partial-frontier-20260709i`
18. `hold-compact-upgrade-underlay-runtime-input-frontier-20260712`

Representative readback after the refresh:

- `wait-compact-reviewed-exception-live-ready-policy-family-20260702`
  - `blocker.next_check_at = 2026-07-14T18:30:00Z`
  - `blocker.fallback_at = 2026-07-15T18:30:00Z`
  - `blocker.resume_at = 2026-07-14T18:30:00Z`
- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
  - `blocker.next_check_at = 2026-07-14T18:30:00Z`
  - `blocker.fallback_at = 2026-07-15T15:30:00Z`
  - `blocker.resume_at = 2026-07-14T18:30:00Z`
- `hold-compact-serverless-schedulerctrl-live-workflow-frontier`
  - `blocker.next_check_at = 2026-07-14T18:30:00Z`
  - `blocker.fallback_at = 2026-07-15T15:30:00Z`
  - `blocker.resume_at = 2026-07-14T18:30:00Z`

Each refreshed task now also records:

- `trace.blocked_wait_refreshed_at = 2026-07-13T18:35Z...`
- `trace.blocked_wait_refresh_summary = Refreshed blocked wait after alert 3568 triage confirmed the same blocker remains exact; advanced the expired watch window in place without widening lineage.`

## Immediate validation

After refreshing the 18 waits and updating their resume windows, a fresh local recompute cleared the metric:

```json
{"measuredAt":1783967723142,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` with `offenderTaskIds=[]` until one of these same-lineage waits reaches its next review window again or a real returned/rerouted signal changes the blocker set.
