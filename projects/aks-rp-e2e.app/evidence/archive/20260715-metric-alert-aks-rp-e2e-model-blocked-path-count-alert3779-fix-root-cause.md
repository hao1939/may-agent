# Metric alert triage — `aks-rp-e2e.model.blocked-path-count` — alert `3779`

- Metric id: `aks-rp-e2e.model.blocked-path-count`
- Alert id: `3779`
- Judged at: `2026-07-15T19:30:06Z`
- Chosen operation: `fix_root_cause`

## Judgment

The breach was real but fixable by app-ops without unsafe runtime writes. The domain model still had ten `status=blocked` paths whose exact wait contracts were already evident in spec/model `nextAction` or spec-side `resumeCondition` language, but those paths were missing normalized `resumeCondition` / `retestCondition` fields in `model/knowledge-map/model.json`. Because the metric intentionally counts only blocked paths that still lack that exact wait representation, the immediate root cause of the alert was model-contract drift rather than a new AKS product decision.

## Change made

Added explicit `resumeCondition` and `retestCondition` fields to these ten blocked model paths in `/app/projects/aks-rp-e2e/model/knowledge-map/model.json`:

1. `path.net-integration.multinic-mixed`
2. `path.secops-identity-binding-system-assigned`
3. `path.net-integration.multinic-dualstack`
4. `path.app-monitoring.appmonitoring-vm-prerelease`
5. `path.ccp.tunnelfront-konnectivity-migration`
6. `path.cluster-autoscaler.vm-prerelease-spot`
7. `path.fleet.auto-upgrade-generate-matrix`
8. `path.localdns.windows-nodepool`
9. `path.network-cni.vm-prerelease-calico-eno-migration-matrix`
10. `path.secops-fips.automatic-sku`

Those wait contracts were derived from already-present accepted source material:

- spec-side `resumeCondition` fields where they already existed,
- path `nextAction` / `statusReason` text when it already named the exact reopen trigger,
- and existing accepted evidence summaries that already preserved the blocker class and reopen surface.

No path status was relaxed, no blocked path was closed, and no threshold/priority calibration was changed.

## Verification

### Baseline before fix

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.model.blocked-path-count
```

Result before the model repair:

- `10`

### After fix

Same recompute after adding the missing normalized wait fields:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.model.blocked-path-count
```

Result after the model repair:

- `0`

### Current counted set after repair

A direct recompute of the metric filter over `model/knowledge-map/model.json` now returns no remaining blocked paths without exact wait fields:

- `count 0`

## Why this is `fix_root_cause`

- **Not `calibrate_metric`**: the metric contract was already correct.
- **Not `resolve_stale`**: the pre-fix recompute still returned `10`.
- **Not `waiting_with_evidence`**: a safe, owner-controlled model repair existed now.
- **Not `document_exception`**: these were not accepted permanent exceptions; they were missing normalized wait contracts.
- **Not `upgrade_or_escalate`**: no destructive action or human-only decision was required to represent the existing exact waits truthfully.

## Next validation

Validate on the next `metrics-snapshot`. If the runtime metric remains above zero after this checked-in model repair is incorporated, investigate snapshot/source drift rather than reopening the same blocked-path representation issue.
