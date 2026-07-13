# Repair feature-compact cluster-autoscaler frontier projection drift — 2026-07-10

Task: `ops/repair-feature-compact-cluster-autoscaler-frontier-projection-drift-20260710`
Attempt: `a_ops_repair-feature-compact-cluster-autoscaler-frontier-projection-drift-20260710_20260710230805`

## Scope

This worker session repairs the **controller-visible** cluster-autoscaler compact frontier projection in `/app/projects/aks-rp-e2e.app/.state/feature-compact-loop/state.json` so it matches the already-normalized compact-facing holder semantics.

No tree reshaping was performed from this session. The live compact holder text was already refreshed by planner/app-ops lineage before this repair; this task fixes the remaining app-owned projection drift.

## Drift recorded before repair

### Live compact holder already named the exact seven downstream carriers

`bun run task-tree show hold-compact-cluster-autoscaler-vm-prerelease-environment-heptet-frontier-20260710` showed the holder blocker condition naming these exact seven downstream carriers:

1. `domain/queue-cluster-autoscaler-autoscaling-base-post-portability-rerun-20260710`
2. `wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708`
3. `wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708`
4. `hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708`
5. `hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708`
6. `ops/repair-ado-sp-credential-env-contract-pipeline-467665-20260710`
7. `domain/queue-cluster-autoscaler-spot-post-portability-rerun-20260710`

### Controller-visible compact loop state was still drifted

Before repair, `features.cluster-autoscaler.frontierTaskIds` in `.state/feature-compact-loop/state.json` still pointed at this drifted six-item set:

1. `hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709`
2. `hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708`
3. `hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708`
4. `ops/wait-runtime-owner-stale-workflow-run-row-closure-return-20260710`
5. `wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708`
6. `wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708`

Wrong stand-ins present before repair:

- `hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709`
- `ops/wait-runtime-owner-stale-workflow-run-row-closure-return-20260710`

Missing exact downstream carriers before repair:

- `domain/queue-cluster-autoscaler-autoscaling-base-post-portability-rerun-20260710`
- `ops/repair-ado-sp-credential-env-contract-pipeline-467665-20260710`
- `domain/queue-cluster-autoscaler-spot-post-portability-rerun-20260710`

## Repair applied

Used the existing app-local feature compact loop store helpers (`loadFeatureCompactLoopState`, `updateFeatureCompactItem`, `saveFeatureCompactLoopState`) to update only the `cluster-autoscaler` record in `.state/feature-compact-loop/state.json`.

Applied exact `frontierTaskIds`:

```json
[
  "domain/queue-cluster-autoscaler-autoscaling-base-post-portability-rerun-20260710",
  "wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708",
  "wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708",
  "hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708",
  "hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708",
  "ops/repair-ado-sp-credential-env-contract-pipeline-467665-20260710",
  "domain/queue-cluster-autoscaler-spot-post-portability-rerun-20260710"
]
```

Also preserved the compact-facing holder binding:

- `features.cluster-autoscaler.taskId = hold-compact-cluster-autoscaler-vm-prerelease-environment-heptet-frontier-20260710`

## Result

After repair:

- the compact holder and controller-visible projection both point at the same exact seven downstream carriers;
- `hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708` remains one exact member of the family rather than collapsing spec-loop scope into one shared wait;
- provisioning-request and stale-workflow waits no longer stand in for the heptet frontier.

## Planner/app-ops outcome

Future blocked-frontier review can treat the compact holder and row49 holder as one blocker family with dual-holder scope truth:

- one compact-facing family holder for the seven-member frontier, and
- one exact spec-loop row49 holder as a downstream family member.
