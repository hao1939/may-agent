# Metric alert triage — aks-rp-e2e.process.unpublished-change-count (alert 2948)

- Alert id: `2948`
- Metric id: `aks-rp-e2e.process.unpublished-change-count`
- Judged at: `2026-07-07T04:41:28Z`
- Chosen operation: `waiting_with_evidence`

## Current measurement

Direct checks during this triage confirm the breach is still real:

- runtime metric sample via `bun scripts/project-metrics.ts aks-rp-e2e.process.unpublished-change-count` in `/app/projects/aks-rp-e2e.app` returned `6`
- `git status --porcelain=v1 --branch` in `/app/projects/aks-rp-e2e` shows branch `ado/spec-runner-vm-size-defaults` with six modified tracked paths and no published counterpart information in the status header
- the sampler implementation in `scripts/project-metrics.ts` counts one point per dirty path plus any `[ahead N]` marker from `git status --porcelain=v1 --branch`; with no ahead marker present, the live value is the six dirty tracked paths

## Current dirty surface

The current unpublished tracked changes in `/app/projects/aks-rp-e2e` are exactly:

- `features/bootstrap-profile/compact/staging.summary.md`
- `features/oidc-issuer/compact/staging.summary.md`
- `features/secure-tls-bootstrap/compact/staging.summary.md`
- `features/serverless-schedulerctrl/compact/staging.summary.md`
- `features/traffic-azure-service-mesh/compact/staging.summary.md`
- `features/workload-identity/compact/staging.summary.md`

These are all compact summary writebacks, not an isolated forgotten one-file checkpoint.

## Why this stays waiting

This alert is a real current breach, but it is not safely fixable from this triage session:

1. Recent owner sessions in the alert context show three concurrent `aks-explorer` task-worker sessions still running, so the same project repo is actively being mutated during triage.
2. The remaining six paths are all compact summary artifacts, which are exactly the kind of review/writeback outputs that can still change while compact-loop or review work is in flight.
3. Publishing, reverting, or force-cleaning these files now would risk collapsing active owner slices into one misleading hygiene action.
4. The metric itself is behaving as implemented right now: the current `6` is explained by six dirty tracked paths, so this is not a stale alert and not a threshold-calibration issue.

## Concrete state change made by this triage

This triage records the refreshed durable judgment in:

- `projects/aks-rp-e2e.app/evidence/metric-alert-unpublished-change-count-20260707-alert2948.md`

That evidence updates the alert-specific state from the earlier alert-2575 snapshot to the current narrower six-file surface and explicitly accepts waiting until the active compact/review writers settle.

## Resume condition

Re-evaluate on the next `metrics-snapshot` after one of these happens:

1. the active compact/review sessions finish and the six summary files settle into one truthful publishable slice, or
2. those six files are intentionally published or cleared and the metric drops back to `0`.
