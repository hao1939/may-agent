# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3571

- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Alert id: `3571`
- Operation: `fix_root_cause`
- Judged at: `2026-07-13T19:22Z`

## Why this was a real breach

A fresh local recompute at triage start still showed the metric live-breaching rather than stale:

```json
{"measuredAt":1783970366380,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708\"]}"}
```

The live offender had an expired watch window at triage time:

- `blocker.resume_at = 2026-07-13T19:15:00Z`
- `blocker.next_check_at = 2026-07-13T19:15:00Z`
- current runtime clock during triage was already after that gate

So this alert was not just alert-row lag; the blocked wait had become overdue again.

## Judgment on the underlying wait

`hold-spec-secops-fips-exact-13spec-mixed-frontier-20260708` is still the truthful exact residual holder. Current spec-loop state still matches the same five-member residual set already documented on July 12:

- `spec.secops-fips.advanced` → `repaired_ready`
- `spec.secops-fips.backwards-compat` → `repaired_ready`
- `spec.secops-fips.ubuntu-compat` → `repaired_ready`
- `spec.secops-fips.mixed-pool-coexistence` → `blocked_hypothesis`
- `spec.secops-fips.base-unaligned-pools-rejection` → `source_grounded_nonlive`

And the previously excluded narrower surfaces are still excluded from this umbrella:

- `spec.secops-fips.upgrade-survival` remains `pass` on recovered ADO run `171478411`
- `spec.secops-fips.blocked-addon-boundary.slice2` remains a reviewed `product_behavior_mismatch` on ADO run `171379609`
- `spec.secops-fips.version-gate` remains a reviewed `product_behavior_mismatch` on ADO run `171461207`
- `spec.secops-fips.blocked-addon-boundary.shared-cluster` still points at `ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized` for exact returned-run artifact recovery on ADO run `171755307`

So the root cause was not wrong scope; it was that the exact blocked holder remained truthful but its watch window had expired again with no newer same-lineage signal.

## Root-cause fix applied

I refreshed the same blocked holder in place through the supported task-tree CLI and preserved its exact residual scope.

Applied changes:

1. appended this memo to the holder outputs; and
2. advanced `blocker.resume_at`, `blocker.next_check_at`, and `blocker.fallback_at` one day forward so the wait is no longer immediately overdue.

Updated watch window:

- `resume_at = 2026-07-14T19:15:00Z`
- `next_check_at = 2026-07-14T19:15:00Z`
- `fallback_at = 2026-07-15T19:15:00Z`

No scope broadening, rerun reopening, or domain reclassification was performed.

## Immediate validation

After refreshing the holder timing, a fresh local recompute cleared the metric:

```json
{"measuredAt":1783970617838,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` with `offenderTaskIds=[]` until this same holder reaches its next review window or a materially different secops-fips signal arrives.
