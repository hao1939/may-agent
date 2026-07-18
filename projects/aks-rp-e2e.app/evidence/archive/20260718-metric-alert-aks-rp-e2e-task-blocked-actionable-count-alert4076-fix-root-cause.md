# Metric alert triage — `aks-rp-e2e.task.blocked-actionable-count` — alert `4076`

## Chosen operation

- `fix_root_cause`

## Judgment

Alert `4076` was a real breach, but the specific PAF contributor named by the recent snapshots had become a **classifier false positive** after the 2026-07-18 holder-routing repair.

At triage start, a live recompute reported `value = 2` with:

- `hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier`
- `hold-compact-paf-throttling-reviewed-exception-frontier-owner-normalized-20260713`

The PAF holder was already repaired to point directly at the shared underlay/runtime-input family wait `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708`, but `blocked_action_warnings` still treated it as `source-exactness-overblock` because the shared-family suppression logic did not cover this exact compact-holder wording.

That made this a tooling/root-cause issue the owner could safely fix.

## Concrete fix applied

Updated `workflows/lib/task-tree-tools.ts` so source-exactness warnings now suppress compact holders already covered by an exact shared-family wait, and broadened shared-family wording recognition to include the current PAF repair shape:

- source-exactness suppression now checks `isSharedFamilyCoveredHolder(task)`
- shared-family holder detection now recognizes phrasing such as:
  - `keep this holder blocked until that shared wait returns`
  - `still depends on the live shared underlay/runtime-input family wait`
  - `governed by the shared underlay/runtime-input family wait`
  - `do not reopen an unchanged compact rerun`

Added a regression test in `workflows/task-tree-tools.test.ts` for the live PAF-style compact holder shape.

## Verification

### Targeted regression tests

`bun test workflows/task-tree-tools.test.ts --test-name-pattern "shared-family waits|feature-compact exact non-environment frontiers"`

Result:

- `planning packet suppresses source-exactness-overblock warning for compact projections governed by exact shared-family waits` ✅
- existing nearby suppression tests still pass ✅

### Live packet after the fix

`bun ./scripts/task-tree.ts packet` now reports only one blocked-action warning:

```json
[
  {
    "kind": "environment-overblock",
    "taskId": "hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier"
  }
]
```

The repaired PAF holder is no longer listed.

### Live metric recompute after the fix

`bun scripts/project-metrics.ts aks-rp-e2e.task.blocked-actionable-count --json` now returns:

- `value = 1`
- `actionableWarningTaskIds = ["hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier"]`

So the fix removed the false-positive PAF contributor and reduced the actionable count from `2` to `1`.

## Remaining open issue

The remaining breach is real and currently isolated to:

- `hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier`

That holder still truthfully represents an unsent owner-handoff/send-proof gap for the disabled/no-run `459172` pipeline plus unresolved ARM64 / Kubernetes `>=1.34` execution-surface ceiling. This triage session did not resolve that domain/process gap; it only removed the stale PAF false positive that was inflating the metric.

## Next validation

- Next `metrics-snapshot` for `aks-rp-e2e.task.blocked-actionable-count`
- or the next owner update that lands durable send proof / alternate execution-surface evidence for `hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier`
