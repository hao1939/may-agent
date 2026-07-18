# Metric alert triage — `aks-rp-e2e.task.blocked-actionable-count` — alert `4078`

## Chosen operation

- `calibrate_metric`

## Judgment

The alert was caused by a **measurement gap**, not a new blocked-work regression.

Earlier today app-ops repaired `hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier` so the holder now names one exact alternate execution-surface wait (`alternate.execution-surface.review`) and preserves the unsent `459172` owner-handoff tuple only as nested `sendProofGap` metadata. That shape is already an exact compact frontier, but the warning classifier still treated it like a generic environment-overblock because `alternate.execution-surface.review` was not in the compact exact-wait suppression set.

So the metric stayed at `1` even though the remaining holder had already been tightened into a truthful non-actionable compact frontier.

## Concrete calibration applied

Updated `workflows/lib/task-tree-tools.ts` so `isFeatureCompactNonEnvironmentFrontier()` treats `alternate.execution-surface.review` the same way as the other exact compact frontier waiting types.

Added a regression test in `workflows/task-tree-tools.test.ts` that models the repaired CCP VPA holder shape:

- compact exact wait
- `waiting_for.type = alternate.execution-surface.review`
- nested `sendProofGap.controllerVisibleSendProof = false`
- one real environment blocker alongside it

The test proves only the real generic blocker remains warned.

## Evidence checked

### Current holder truth

Current live `tasks/tree.json` for `hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier` shows:

- `blocker.waiting_for.type = alternate.execution-surface.review`
- exact alternate execution surfaces `398852` and `456531`
- nested `sendProofGap.controllerVisibleSendProof = false`
- `status = prepared-but-unsent`

That means the holder itself is no longer a vague environment blocker; the unsent packet is nested metadata inside an already-exact frontier.

### Regression test

`bun test workflows/task-tree-tools.test.ts -t "compact alternate execution-surface waits with separate send-proof metadata"`

Result:

- `1 pass`
- expected warning set contains only `real-env-blocker`

### Live metric recompute after calibration

`bun scripts/project-metrics.ts aks-rp-e2e.task.blocked-actionable-count --json`

Result:

- `value = 0`
- `sampleSize = 0`
- `actionableWarningTaskIds = []`

## Why this is calibrate, not another operation

- Not `fix_root_cause`: the task holder had already been repaired; the remaining problem was the metric classifier.
- Not `resolve_stale`: the pre-change recompute still returned `1`, so the alert was not a stale alert row.
- Not `upgrade_or_escalate`: there is no unsafe action or human decision required to correct the classifier.
- Not `waiting_with_evidence`: a concrete calibration was available and applied now.

## Next validation

- next `metrics-snapshot` after this source change is loaded by the app runtime
- or any manual recompute of `aks-rp-e2e.task.blocked-actionable-count`, which now returns `0`
