# Metric alert triage — `aks-rp-e2e.model.blocked-path-count` — alert `3306`

- Metric id: `aks-rp-e2e.model.blocked-path-count`
- Alert id: `3306`
- Judged at: `2026-07-10T14:56:30Z`
- Chosen operation: `waiting_with_evidence`

## Judgment

The breach is still real and current (`10 > 9`), but the correct operation remains `waiting_with_evidence`.
The metric is already calibrated to count only blocked model paths that still lack a terminal disposition and still lack an exact `resumeCondition` or `retestCondition`. A fresh recompute still returns `10`, matching the runtime metric row exactly.

This is still a watch-lane wait rather than a stale alert or emergency because the app task tree still has active and review frontier motion that can legitimately reduce this residue. App-ops should not force-close these remaining domain-model blocked paths by hand from metric triage.

## Evidence checked

### Metric contract still matches the intended narrow scope

From `scripts/project-metrics.ts`, `blockedPathCount()` counts only model feature paths where:

- `status === "blocked"`
- `terminal !== true`
- `remediationStatus` is neither `terminal` nor `awaiting-external`
- both `resumeCondition` and `retestCondition` are still empty

From `scripts/register-project-metrics.ts`, the metric description still documents that narrowed intent and the calibrated threshold `45 → 9` from the 2026-07-08 triage.

### Fresh recompute still breaches now

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.model.blocked-path-count
```

Result:

- `10`

That matches the runtime metric row and latest snapshot, so the alert is not stale.

### Exact remaining model paths counted now

Fresh direct model inspection against `/app/projects/aks-rp-e2e/model/knowledge-map/model.json` returned these exact `10` counted paths:

1. `path.net-integration.multinic-mixed`
2. `path.secops-identity-binding-system-assigned`
3. `path.app-monitoring.appmonitoring-vm-prerelease`
4. `path.ccp.tunnelfront-konnectivity-migration`
5. `path.cluster-autoscaler.vm-prerelease-spot`
6. `path.fleet.auto-upgrade-generate-matrix`
7. `path.localdns.multipool-consistency`
8. `path.localdns.windows-nodepool`
9. `path.network-cni.vm-prerelease-calico-eno-migration-matrix`
10. `path.secops-fips.automatic-sku`

All ten still have `remediationStatus = null`, which confirms they remain actionable blocked residue rather than accepted terminal or external waits.

### Project motion still exists

Fresh `bun scripts/task-tree.ts summary` result showed live frontier work:

- `counts.active = 7`
- `counts.review = 1`
- active frontier includes:
  - `compact-feature-cluster-autoscaler`
  - `compact-feature-net-integration`
  - `compact-feature-rp-cluster-lifecycle`
  - `compact-feature-rp-nodepool-lifecycle`
  - `domain/review-net-integration-natgw-v2-byoip-prefix-current-failure-classification-20260710`
  - `ops/materialize-node-http-proxy-trusted-ca-resend-proof-and-refresh-wait-20260710`
  - `ops/repair-spec-loop-state-alignment-net-integration-natgw-v2-byoip-prefix-20260710`
- review frontier includes:
  - `domain/reconcile-compact-package-partial-gpu-current-head-20260710`

So the project is not motion-starved. There is still active and review work that can legitimately reduce blocked model residue on the next frontier update.

## Why not another operation

- **Not `resolve_stale`**: fresh recompute and the exact path list still show `10`.
- **Not `calibrate_metric`**: the metric was already narrowed to exclude exact waits and accepted terminal cases; the remaining `10` are exactly what it is supposed to surface.
- **Not `fix_root_cause`**: these remaining items are domain/model closure work rather than an app orchestration bug, and app-ops should not rewrite domain model path status by hand from metric triage.
- **Not `upgrade_or_escalate`**: this remains a `P3` watch-lane signal with ongoing task-tree motion, not a destructive-action or policy-decision emergency.
- **Not `document_exception`**: these remaining blocked paths are not accepted permanent exceptions.

## Next validation

Re-check on the next `metrics-snapshot`, or sooner if the current compact/model frontier lands and should reduce the blocked-path residue below `10`.
