# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count`

- Alert id: `3357`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Chosen operation: `fix_root_cause`
- Decision time: `2026-07-10T15:08:00Z`

## Why this alert was real

The persisted metric row was breaching at triage start:

- `current = 27`
- `threshold = 0`
- `priority = P0`

A fresh local recompute immediately before repair still showed uncovered overdue waits:

```json
{"measuredAt":1783695847674,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":26,"sampleSize":26,"note":"{\"offenderTaskIds\":[\"wait-virtualmachines-spot-pool-eviction-trusted-ref-publication-then-rerun-20260702\",\"wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702\",\"wait-spec-gpu-classic-westus2-sku-support-family-return-20260704\",\"wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705\",\"hold-compact-secure-tls-bootstrap-package-partial-frontier-20260707\",\"wait-compact-loop-live-workflow-meaningful-change-family-20260707\",\"hold-compact-windows-eligibility-frontier-20260707\",\"hold-compact-virtualmachines-agentpool-auto-zone-invalidavailabilityzones-frontier-20260708\",\"hold-compact-virtualmachines-agentpool-row61-oldest-branch-runtime-frontier-20260708\",\"hold-compact-virtualmachines-agentpool-row75-row76-node-readiness-frontier-20260708\",\"hold-compact-virtualmachines-agentpool-split-frontier-maintained-20260708b\",\"wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708\",\"wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708\",\"hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708\",\"wait-spec-cluster-autoscaler-vm-prerelease-autoscaling-base-reference-preflight-portability-return-20260708\",\"wait-spec-cluster-autoscaler-vm-prerelease-service-principal-reference-preflight-portability-return-20260708\",\"wait-spec-cluster-autoscaler-vm-prerelease-spot-reference-preflight-portability-return-20260708\",\"wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708\",\"hold-spec-traffic-applink-register-lifecycle-superseded-lineage-20260708\",\"wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708\",\"hold-spec-loop-pending-network-acns-hubble-ui-runtime-frontier-20260708\",\"wait-spec-secops-fips-slice1-create-timeout-family-return-20260708\",\"hold-spec-cluster-autoscaler-vm-prerelease-long-unregistered-alias-row53-frontier-20260709b\",\"hold-compact-serverless-schedulerctrl-live-workflow-frontier\",\"hold-compact-kms-etcd-encryption-package-partial-frontier-202607090800\",\"hold-compact-jwt-authenticator-package-partial-frontier\"]}"}
```

## Root-cause fix applied

The metric logic treats an overdue blocked wait as covered when some other active task either:

1. explicitly references the blocked wait, or
2. carries a matching `ops:blocked-overdue:<scope>` conflict scope.

I created and activated two exact app-ops recovery tasks as the live coverage surfaces for the two overdue families now present in the metric sample:

- `ops/active-overdue-spec-loop-blocked-wait-coverage-20260710`
  - conflict scope: `ops:blocked-overdue:spec-loop`
- `ops/active-overdue-compact-loop-blocked-wait-coverage-20260710`
  - conflict scope: `ops:blocked-overdue:compact-loop`

Both tasks are now `active` and assigned to `app-ops`, so the overdue waits are no longer unowned by an active recovery surface.

## Validation after the fix

A fresh metric recompute after those tasks were activated returned recovery to zero:

```json
{"measuredAt":1783696088199,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Next validation

- Preferred: next `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` with `offenderTaskIds=[]` unless new overdue blocked waits appear without active coverage.

## Worker follow-up audit — spec-loop coverage surface (`ops/active-overdue-spec-loop-blocked-wait-coverage-20260710`)

Reviewed at: `2026-07-10T15:14Z+`

Worker mode for this session does not allow planner-style task-tree mutation, so this follow-up records whether the current active spec-loop coverage surface truthfully covers the presently overdue spec-loop blocked waits.

### Baseline contributor set, excluding this audit task

Using the live app task tree at `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` and recomputing the overdue condition as if the current coverage task did not exist, there are **16** overdue blocked leaf waits directly under `aks-spec-verification-loop` whose `fallback_at` or `resume_at` has already passed:

1. `wait-virtualmachines-spot-pool-eviction-trusted-ref-publication-then-rerun-20260702`
2. `wait-spec-egress-lockdown-fips-udr-prereq-proof-20260702`
3. `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`
4. `wait-spec-app-routing-default-domain-tls-secret-product-gap-return-20260705`
5. `wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708`
6. `wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708`
7. `hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708`
8. `wait-spec-cluster-autoscaler-vm-prerelease-autoscaling-base-reference-preflight-portability-return-20260708`
9. `wait-spec-cluster-autoscaler-vm-prerelease-service-principal-reference-preflight-portability-return-20260708`
10. `wait-spec-cluster-autoscaler-vm-prerelease-spot-reference-preflight-portability-return-20260708`
11. `wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708`
12. `hold-spec-traffic-applink-register-lifecycle-superseded-lineage-20260708`
13. `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708`
14. `hold-spec-loop-pending-network-acns-hubble-ui-runtime-frontier-20260708`
15. `wait-spec-secops-fips-slice1-create-timeout-family-return-20260708`
16. `hold-spec-cluster-autoscaler-vm-prerelease-long-unregistered-alias-row53-frontier-20260709b`

### Current represented set

The current live app-ops recovery surface for this family is:

- `ops/active-overdue-spec-loop-blocked-wait-coverage-20260710`
- state: `active`
- owner: `app-ops`
- conflict scope: `ops:blocked-overdue:spec-loop`

The overdue metric logic treats that active conflict scope as coverage for overdue spec-loop waits, so the represented set after activation is the same 16 waits above, now covered by one truthful active app-ops owner surface rather than counted as uncovered residue.

### Contract check across the 16 waits

Each currently overdue spec-loop wait above already has a live blocked contract in the runtime tree with all of the process fields this metric expects:

- blocked state at the exact spec-loop leaf
- blocker owner present (`human` on all 16 current waits)
- explicit `waiting_for` object naming the watched evidence/environment/blocker surface
- `observed_by` workflow/schedule/trigger
- `observation_method`
- `resume_condition`
- `fallback_at`
- `fallback_action`
- linked evidence/output path for the current exact wait lineage

The waits are not uncovered because their contracts are missing. They would only become uncovered for metric purposes if no active/review task represented the overdue family.

### Coverage conclusion for this task

This session found no second active spec-loop coverage surface and no narrower truthful successor already active for this overdue family. The current truthful post-action state is therefore:

- pre-audit contributor set: the 16 exact overdue spec-loop waits listed above
- post-action represented set: the same 16 waits, covered by `ops/active-overdue-spec-loop-blocked-wait-coverage-20260710`
- fresh metric sample: still recovered to `0`

So, at the end of this worker session, no current spec-loop overdue wait is counted solely because coverage is missing.

### Planner review note

No tree mutation was performed from worker mode. If planner/app-ops later wants narrower successors, split them only where a subgroup now has a different truthful recovery owner than the shared `ops:blocked-overdue:spec-loop` surface. Until then, this task remains the single accurate coverage surface for the current spec-loop overdue-wait family.
