# Metric alert triage — `aks-rp-e2e.process.blocked.missing-owner-count` (alert 3203)

- Alert id: `3203`
- Metric id: `aks-rp-e2e.process.blocked.missing-owner-count`
- Judged at: `2026-07-08T22:08:52Z`
- Chosen operation: `fix_root_cause`
- Metric owner: `app-ops`

## Why this was a real breach

Runtime DB state during triage showed an active P0 breach:

- `metrics.current = 2`
- `metrics.threshold = 0`
- `metrics.target = 0`
- `metrics.updated_at = 1783548399965`
- open alert row `3203` had `resolved_at = null`

Latest snapshots named two current offenders:

- `hold-spec-network-cni-source-check-only-frontier-20260708`
- `wait-spec-network-cni-vm-prerelease-calico-eno-migration-ado171454434-review-20260708`

Initial live task-tree inspection showed both tasks were blocked leaves with task-level `owner`, but their `blocker` objects omitted `owner`, which is exactly what this metric counts.

## Concrete change made

Used the supported task-tree repair path:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts
```

The repair reported `repairedCount = 8` and explicitly included both current offenders:

- `hold-spec-network-cni-source-check-only-frontier-20260708`
- `wait-spec-network-cni-vm-prerelease-calico-eno-migration-ado171454434-review-20260708`

Post-repair task inspection confirmed the missing blocked-contract owner metadata was added:

- `hold-spec-network-cni-source-check-only-frontier-20260708` now has `blocker.owner = "aks-explorer"`
- `wait-spec-network-cni-vm-prerelease-calico-eno-migration-ado171454434-review-20260708` now has `blocker.owner = "ado"`

## Validation after the repair

A direct parse of the same runtime tree file at `.state/tasks/tree.json` found zero blocked leaves missing `blocker.owner`.

The supported metric sampler then converged to the same result:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-owner-count --json
```

Observed result after repair convergence:

```json
{
  "measuredAt": 1783548532524,
  "treePath": "/app/projects/aks-rp-e2e.app/.state/tasks/tree.json",
  "value": 0,
  "sampleSize": 0,
  "note": "{\"offenderTaskIds\":[]}"
}
```

The persisted runtime `metrics.current` row still showed `2` at triage end, so alert lifecycle closure must come from the next runtime `metrics-snapshot`, not from manual DB editing in this session.

## Judgment

`fix_root_cause` is correct because the breach was real, app-ops had a safe supported repair path, and the underlying blocked-task metadata defect was actually corrected in the live task tree.

## Next validation signal

Validate on the next `metrics-snapshot` for `aks-rp-e2e.process.blocked.missing-owner-count` after `2026-07-08T22:08:52Z`. Expected result: persisted metric value updates to `0` and alert `3203` clears or recovers automatically.
