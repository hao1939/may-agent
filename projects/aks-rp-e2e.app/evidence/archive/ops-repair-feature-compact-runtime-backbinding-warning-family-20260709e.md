# Feature-compact runtime backbinding repair — warning family (2026-07-09e)

- Task: `ops-repair-feature-compact-runtime-backbinding-warning-family-20260709e`
- Attempt: `a_ops-repair-feature-compact-runtime-backbinding-warning-family-20260709e_20260709104605`
- Scope: compact runtime/state projection repair only

## What changed

Updated feature-compact runtime projection logic so stale or missing feature state pointers can bind to:

- sharper compact-facing cross-loop carriers,
- shared reviewed-exception waits, and
- exact cross-loop frontier holders,

without reopening unchanged compact reruns or recreating retired generic holders.

## Code changes

File: `workflows/lib/feature-compact-runtime-projection.ts`

Key repairs:

- shared-wait discovery now inspects full task context text, not only goal/blocker text, so replaced-holder acceptance notes participate in backbinding;
- cross-loop frontier discovery now recognizes `feature-compact:<feature>` scopes and compact-facing cross-loop carriers;
- sharper projection detection now recognizes compact-facing exact carriers;
- shared reviewed-exception live-ready family waits can backbind even when the feature row currently has a generic `publish.auth.ready` waiting type;
- exact-wait blocker `waiting_for` rewrites remain limited to real compact exact-wait tasks, avoiding mutation of project/shared waits during state repair.

## Runtime before/after mapping

Derived from the repaired live app runtime after running the projection reconciler and saving the resulting state.

| feature | before taskId | after taskId | notes |
|---|---|---|---|
| `gpu` | `hold-compact-gpu-package-partial-frontier` | `null` | retired generic holder cleared; exact residue remains in `frontierTaskIds` |
| `cluster-autoscaler` | `hold-compact-cluster-autoscaler-package-partial-frontier-202607090657` | `wait-compact-cluster-autoscaler-vm-prerelease-environment-heptet-return-20260709` | re-bound to surviving compact-facing exact carrier |
| `planned-maintenance` | `null` | `wait-compact-reviewed-exception-live-ready-policy-family-20260702` | missing pointer restored to shared reviewed-exception wait |
| `ccp-coredns` | `null` | `wait-compact-reviewed-exception-live-ready-policy-family-20260702` | missing pointer restored to shared reviewed-exception wait |
| `ossku-migration` | `hold-compact-ossku-migration-package-partial-frontier` | `wait-compact-reviewed-exception-live-ready-policy-family-20260702` | stale missing holder replaced by surviving shared wait |

## Additional exact frontier projection saved

### gpu

`frontierTaskIds` now truthfully carry both surviving exact waits:

- `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
- `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`

This preserves the accepted two-cause split instead of pointing back at the retired generic compact holder.

### cluster-autoscaler

`frontierTaskIds` now include the compact-facing carrier plus the downstream exact waits/frontiers it summarizes, including:

- `wait-compact-cluster-autoscaler-vm-prerelease-environment-heptet-return-20260709`
- `wait-spec-cluster-autoscaler-vm-prerelease-autoscaling-base-reference-preflight-portability-return-20260708`
- `wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708`
- `wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708`
- `wait-spec-cluster-autoscaler-vm-prerelease-service-principal-reference-preflight-portability-return-20260708`
- `wait-spec-cluster-autoscaler-vm-prerelease-spot-reference-preflight-portability-return-20260708`
- and the preserved hold-frontiers already attached to that accepted seven-member environment slice.

## Remaining irreducible residue

- `gpu` intentionally has no single surviving `taskId`; it remains a split frontier represented by the two exact waits above.
- `ccp-coredns` still retains its existing feature-state `waitingFor` payload (`publish.auth.ready`), but its `taskId` now correctly binds to the surviving shared reviewed-exception live-ready wait rather than a missing holder. No rerun was reopened.
- No new shared waits were invented.
- No unchanged compact reruns were reopened.

## Verification

- Added/updated regression coverage in `workflows/feature-compact-loop.test.ts` for the warning-family survivor mapping.
- Ran `bun test workflows/feature-compact-loop.test.ts --timeout 30000` successfully after the projection changes.
