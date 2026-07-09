# Metric alert follow-up — `aks-rp-e2e.process.blocked.overdue-unworked-count` (alert 3249)

- Alert id: `3249`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Recovery task: `ops-maintain-shared-jwt-authenticator-overdue-coverage-alert-3249-20260709`
- Reviewed at: `2026-07-09T18:00:05Z`
- Exact covered wait: `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`

## Result

This task **does** re-establish active app-ops coverage for the shared jwt wait itself, but the metric is **not currently back to 0** because two other overdue blocked waits are now uncovered in the same global metric family.

So the truthful outcome for this worker session is:

- **covered by this task:** `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`
- **no longer a live offender:** the shared jwt wait above
- **still preventing acceptance:** unrelated current offenders elsewhere in the tree
  1. `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
  2. `hold-spec-network-cni-cilium-enterprise-runtime-input-frontier-20260708`

That means the task's first acceptance condition is satisfied for the jwt wait coverage surface, but the second acceptance condition is no longer satisfied in current tree state because the metric now reflects other uncovered overdue waits.

## What this task still proves

The current task tree contains an active app-ops recovery task:

- task id: `ops-maintain-shared-jwt-authenticator-overdue-coverage-alert-3249-20260709`
- state: `active`
- owner: `app-ops`
- goal text explicitly names `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708`

Under the current metric logic in `scripts/project-metrics.ts`, an active/review task covers an overdue blocked wait when either:

1. the active task text explicitly names the blocked wait id, or
2. the active task carries the matching `ops:blocked-overdue:<scope>` conflict scope.

This task satisfies coverage by the first rule because its goal explicitly names the jwt wait id.

## Baseline for this task's own covered wait

Per the overdue-audit rule, compute the baseline as if the current recovery task did not exist.

Without `ops-maintain-shared-jwt-authenticator-overdue-coverage-alert-3249-20260709`, the shared jwt wait would still qualify as a real overdue-unworked contributor because:

- it is a leaf task in state `blocked` under `project`;
- its blocker clock is already past `resume_at = 2026-07-09T07:00:00Z`;
- the earlier chase task `ops-chase-shared-overdue-jwt-underlay-waits-20260709` is `done`, so it is not active coverage;
- no other current active/review task explicitly names that wait id or carries project-wide blocked-overdue coverage for it.

So this task still provides a truthful recovery surface for the exact jwt wait named in alert 3249.

## Fresh global recompute

Fresh local recompute at review time returned:

```json
{"measuredAt":1783582937652,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":2,"sampleSize":2,"note":"{\"offenderTaskIds\":[\"wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708\",\"hold-spec-network-cni-cilium-enterprise-runtime-input-frontier-20260708\"]}"}
```

Interpretation:

- the jwt wait is **not** in the offender set anymore;
- the metric remains red only because the current offender set has moved to:
  - `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`
  - `hold-spec-network-cni-cilium-enterprise-runtime-input-frontier-20260708`

## Why the current offenders are unrelated to this task

### 1) Shared underlay/runtime-input wait

`wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708` is still blocked past its watch window and currently has no active/review app-ops recovery task naming it.

The latest reviewed evidence for that family is still the completed chase note:

- `evidence/archive/ops-chase-shared-overdue-jwt-underlay-waits-20260709.md`

That note says the existing underlay escalation packet remains the active lineage, but the chase task itself is already `done`, so it no longer counts as active metric coverage.

### 2) Duplicate cilium-enterprise blocked holder

`hold-spec-network-cni-cilium-enterprise-runtime-input-frontier-20260708` is also overdue, but accepted reviewed evidence already says it is duplicative and should be replaced by the shared underlay wait rather than preserved as a second holder:

- `../aks-rp-e2e/evidence/archive/refresh-spec-network-cni-cilium-enterprise-runtime-input-frontier-20260709b.md`

That reviewed domain evidence concludes the cilium-enterprise pair is fully subsumed by `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`, so keeping the cilium-only blocked holder leaves an extra overdue surface in the metric.

## Current runtime evidence checked

I verified the following current facts:

1. `ops-maintain-shared-jwt-authenticator-overdue-coverage-alert-3249-20260709` is present in `/app/projects/aks-rp-e2e.app/.state/tasks/tree.json` and remains `active`.
2. `wait-shared-jwt-authenticator-go-e2ev3-egress-surface-return-20260708` remains `blocked` and still needs one active app-ops coverage surface while owner proof is pending.
3. Fresh metric recompute excludes the jwt wait from offender ids and instead reports the two different offenders above.
4. Runtime metric row still shows snapshot lag (`current = 9` at `updated_at = 1783582554279`), so the authoritative current state for this task is the live recompute, not the older persisted snapshot.

## Planner/app-ops follow-up needed

This worker session does **not** mutate the task tree.

To get the global metric back to `0`, planner/app-ops should repair the two remaining offenders, not this jwt coverage task:

1. add or restore one active app-ops coverage surface for `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`, or
2. replace/remove the duplicate blocked holder `hold-spec-network-cni-cilium-enterprise-runtime-input-frontier-20260708` in favor of the already-reviewed shared underlay wait, per `refresh-spec-network-cni-cilium-enterprise-runtime-input-frontier-20260709b` evidence,
3. then rerun the overdue-unworked metric recompute.

## Bottom line

This task still accomplishes its narrow purpose: the shared jwt wait named by alert 3249 is actively covered and is no longer a live overdue-unworked offender. However, the task cannot truthfully claim full success against the global acceptance clause because a fresh recompute now shows two different uncovered overdue waits elsewhere in the tree.