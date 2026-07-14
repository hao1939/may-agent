# Metric alert triage — `aks-rp-e2e.task.blocked-actionable-count` — alert `3654`

## Chosen operation

`fix_root_cause`

## Why this alert breached

The live recompute and planning packet both showed a single actionable warning for
`hold-compact-aad-rbac-reviewed-exception-trio-frontier`, even though the task
already had an active domain follow-up (`domain/aad-rbac-capacity-family-overblock-next-action-20260714`) and was meant to remain one exact compact reviewed-exception holder.

The breach was caused by **metadata drift on that compact holder**, not by a new
real blocked-work gap:

- `blocked_action_warnings` still classified the task as `environment-overblock`
- the holder was missing `context.featureCompactExactWait = true`
- its `waiting_for.type` was still `blocker.resolved` instead of the compact-loop
  representation used by other exact compact holders
- its `conflict_scope` lacked the normal `feature:*` and
  `feature-compact-wait:*` metadata that keeps exact compact waits recognizable

## Repair applied

Applied script:

- `scripts/ops-apply-normalize-aad-rbac-reviewed-exception-trio-warning-metadata-20260714c.ts`

The script normalized `hold-compact-aad-rbac-reviewed-exception-trio-frontier`
by:

1. setting `blocker.waiting_for.type = compact.frontier.changed`
2. adding compact-holder metadata:
   - `context.featureCompactExactWait = true`
   - `context.featureKey = aad-rbac`
   - `context.errorClass = reviewed-exception`
3. expanding `conflict_scope` to include:
   - `feature-compact:aad-rbac`
   - `feature:aad-rbac`
   - `feature-compact-wait:reviewed-exception`

## Validation

### Before repair

`bun run task-tree packet` showed:

- `blocked_action_warnings_count = 1`
- offender = `hold-compact-aad-rbac-reviewed-exception-trio-frontier`

`bun scripts/project-metrics.ts aks-rp-e2e.task.blocked-actionable-count --json` showed:

- `value = 1`
- `actionableWarningTaskIds = ["hold-compact-aad-rbac-reviewed-exception-trio-frontier"]`

### After repair

`bun run task-tree packet` showed:

- `blocked_action_warnings_count = 0`
- no offender for `hold-compact-aad-rbac-reviewed-exception-trio-frontier`

`bun scripts/project-metrics.ts aks-rp-e2e.task.blocked-actionable-count --json` showed:

- `value = 0`
- `sampleSize = 0`
- `actionableWarningTaskIds = []`

## Judgment

This alert was a **real metric breach** caused by app-side blocked-holder
metadata drift. It was safe for `app-ops` to repair directly, and the live
recompute now returns the metric to target without hiding a true blocked family.
