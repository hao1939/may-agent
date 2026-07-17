# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3978

- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Alert id: `3978`
- Measured at: `2026-07-16T20:48:14Z`
- Baseline sample: `value=5`, `sampleSize=5`

## Current offenders

A fresh metric sample at triage time returned these exact overdue blocked waits:

1. `hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708`
2. `hold-spec-kms-v2-trust-service-node-subnet-http409-post-rerun-frontier-20260708`
3. `hold-spec-loop-pending-managementplane-addon-row60-nonlive-policy-frontier-20260706`
4. `hold-spec-loop-pending-network-acns-hubble-ui-runtime-frontier-20260708`
5. `hold-spec-network-acns-performance-cilium-upgrade-user-iptables-runtime-blocker-20260707c`

## Judgment

This breach is a blocked-wait hygiene issue inside `aks-spec-verification-loop`, not a new AKS product decision.

For all five waits, `task-tree show` confirms the same pattern:

- the wait is already the exact truthful holder for a reviewed same-path frontier,
- the last accepted blocked-frontier follow-up on `2026-07-15` still governs the exact blocker shape,
- no active or review successor currently covers the wait, and
- the stored `resume_at`, `next_check_at`, and `fallback_at` timestamps all expired at `2026-07-16T20:40:00Z`.

So the smallest truthful repair is to refresh those exact blocked waits in place and move their review window forward one day, while preserving their existing exact blocker descriptions and same-path resume conditions.

## Planned tree repair

Refresh each of the five exact holders so:

- `resume_at = 2026-07-17T20:40:00Z`
- `next_check_at = 2026-07-17T20:40:00Z`
- `fallback_at = 2026-07-17T20:40:00Z`

No rerun, reclassification, or closure is justified from this planner wake alone.
