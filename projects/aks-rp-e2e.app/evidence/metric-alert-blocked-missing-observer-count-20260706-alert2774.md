# Metric alert triage — aks-rp-e2e.process.blocked.missing-observer-count

- Alert id: `2774`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-06T02:27:50Z`
- Chosen operation: `fix_root_cause`

## Judgment

This was a real blocked-contract defect in the live runtime task tree, and it cleared through safe task-tree governance rather than DB edits.

At triage time, the live metric sampler still returned `1`, and direct inspection of the runtime tree at `.state/tasks/tree.json` showed one blocked leaf missing the observer contract fields required by the metric. The offending task was `review-compact-storage-csi-successor-pair-and-residual-frontier-20260706-2`.

## Evidence checked

### Persisted/runtime metric state during breach

- Alert `2774` was open with `current=3` in the prompt snapshot.
- Fresh live sample from the app metric source returned `1` during this session:

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count
```

Observed value:

- `1`

### Live runtime offender before recovery

Direct runtime-tree inspection of `.state/tasks/tree.json` showed the only current offender:

- `review-compact-storage-csi-successor-pair-and-residual-frontier-20260706-2`

Its blocker had only:

- `condition`
- `category`
- `owner`
- `resume_condition`

and was missing the required observer fields:

- `observed_by`
- `observation_method`
- `next_check_at`

### Safe repair path used

I ran the bounded repair tool first:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts
```

That earlier repaired another blocked holder in the checked-in tree and confirmed this is the supported root-cause repair path for blocked-contract defects.

While this alert was being triaged, the live runtime tree then moved forward through task-tree governance: the offending blocked review task was replaced/closed as `done` with resolution `replaced`, and its acceptance note now says:

> Replaced this passive blocked review with active repair task `repair-compact-storage-csi-holder-and-state-rehome-20260706`, which now owns creation of the exact storage-csi holder plus `.state/feature-compact-loop/state.json` rehome and parity confirmation.

That state change removed the missing-observer offender from the live runtime tree without unsafe manual DB action.

### Validation after recovery

Fresh recomputation from the app metric source now returns target value `0`:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts "aks-rp-e2e.process.blocked.missing-observer-count" --json
```

Observed result:

```json
{ "measuredAt": 1783374242581, "value": 0 }
```

A direct audit of `.state/tasks/tree.json` now also returns no offenders:

```json
{
  "count": 0,
  "offenders": []
}
```

## Conclusion

`fix_root_cause` is the correct final operation because the breach was real in the live runtime tree, the system used safe task-tree governance to remove the malformed blocked leaf, and the authoritative live metric source now recomputes to `0`.

The persisted metric row and alert row may lag until the next `metrics-snapshot` / alert refresh cycle.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`. If the sampler stays `0`, alert `2774` should recover automatically. If it returns `>0`, reopen only with concrete offender task ids from a fresh `.state/tasks/tree.json` audit.
