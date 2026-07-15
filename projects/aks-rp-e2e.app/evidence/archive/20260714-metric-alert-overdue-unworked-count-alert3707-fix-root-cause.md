# Alert 3707 fix_root_cause — overdue blocked waits without active work

## Alert
- Metric: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Alert id: `3707`
- Trigger sample at 2026-07-14T18:50:21Z recompute: value `5`
- Offenders:
  - `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
  - `hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705`
  - `wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711`
  - `hold-spec-private-cluster-update-private-empty-aggregate-result-contract-frontier-20260711`
  - `hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705`

## Judgment
The breach is real but mechanical: all five offenders are still truthful blocked waits, and each one was overdue only because its `next_check_at` review window had expired at `2026-07-14T18:45:00Z`. No evidence showed a changed execution surface, returned approval/owner decision, narrower successor, or safe unblock. The correct app-ops action is to refresh the exact same waits in place through the supported task-tree mutation path, not to rerun domain work or create duplicate cover tasks.

## Applied repair
For each offender, app-ops preserved the existing wait lineage and refreshed the blocked-wait watch window to:
- `next_check_at`: `2026-07-15T18:45:00Z`
- `fallback_at`: `2026-07-16T18:45:00Z`

No blocker family membership, owner-return lineage, or runtime frontier scope was widened.

## Expected validation
A fresh recompute of `aks-rp-e2e.process.blocked.overdue-unworked-count` should return `0` with `offenderTaskIds=[]` once the refreshed task-tree state is sampled.
